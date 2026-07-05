from httpx import ASGITransport, AsyncClient
import pytest

from context_engine import active_window, context_builder, screenshot, selected_text
from context_engine.clipboard import ClipboardSnapshot
from main import app


@pytest.mark.asyncio
async def test_context_endpoint_returns_valid_json_with_screenshot_status():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/context/current")

    assert response.status_code == 200
    data = response.json()
    assert "active_window" in data
    assert "clipboard" in data
    assert "selected_text" in data
    assert "screenshot" in data
    assert "capture_status" in data
    assert "warnings" in data
    assert "timestamp" in data
    assert "screenshot" in data["capture_status"]


def test_screenshot_disabled_by_default(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(screenshot.settings, "screenshot_capture_enabled", False)
    result = screenshot.capture_screenshot_metadata()
    assert result["capture_status"] == "disabled"
    assert result["width"] == 0
    assert result["height"] == 0


def test_screenshot_failure_returns_warning_without_crashing(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(screenshot.settings, "screenshot_capture_enabled", True)
    monkeypatch.setattr(
        screenshot,
        "ImageGrab",
        type("BrokenGrab", (), {"grab": staticmethod(lambda: (_ for _ in ()).throw(RuntimeError("grab failed")))})(),
    )
    result = screenshot.capture_screenshot_metadata()
    assert result["capture_status"] == "failed"
    assert any("Screenshot capture failed" in warning for warning in result["warnings"])


def test_context_builder_handles_failures_gracefully(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(context_builder, "_normalize_active_window", lambda: (_ for _ in ()).throw(RuntimeError("boom")))
    monkeypatch.setattr(
        context_builder,
        "_normalize_clipboard_snapshot",
        lambda: (_ for _ in ()).throw(RuntimeError("clipboard boom")),
    )
    monkeypatch.setattr(
        context_builder,
        "get_selected_text",
        lambda: (_ for _ in ()).throw(RuntimeError("selection boom")),
    )
    monkeypatch.setattr(
        context_builder,
        "_normalize_screenshot",
        lambda: (_ for _ in ()).throw(RuntimeError("screenshot boom")),
    )

    context = context_builder.build_context()

    assert context["active_window_title"] == ""
    assert context["clipboard_text_preview"] == ""
    assert context["selected_text_preview"] == ""
    assert context["screenshot"]["capture_status"] == "failed"
    assert context["capture_status"]["active_window"] == "unavailable"
    assert context["capture_status"]["clipboard"] == "unavailable"
    assert context["capture_status"]["selected_text"] == "unavailable"
    assert context["capture_status"]["screenshot"] == "failed"


def test_clipboard_preview_truncation_works(monkeypatch: pytest.MonkeyPatch):
    long_text = "x" * 20
    monkeypatch.setattr(context_builder.settings, "context_preview_max_chars", 5)
    monkeypatch.setattr(context_builder.settings, "selected_text_preview_max_chars", 5)
    monkeypatch.setattr(
        context_builder,
        "_normalize_active_window",
        lambda: {
            "title": "Test Window",
            "process_name": "test.exe",
            "process_id": 12,
            "class_name": "TestClass",
            "capture_status": "ok",
            "warnings": [],
        },
    )
    monkeypatch.setattr(
        context_builder,
        "_normalize_clipboard_snapshot",
        lambda: ClipboardSnapshot(text=long_text, has_text=True, format_count=1, capture_status="ok", warnings=[]),
    )
    monkeypatch.setattr(
        context_builder,
        "get_selected_text",
        lambda: {"text": long_text, "available": True, "capture_status": "captured", "warnings": []},
    )
    monkeypatch.setattr(
        context_builder,
        "_normalize_screenshot",
        lambda: {
            "width": 0,
            "height": 0,
            "format": "png",
            "captured_at": None,
            "capture_status": "disabled",
            "warnings": [],
            "preview_available": False,
            "temp_path": None,
        },
    )

    context = context_builder.build_context()

    assert context["clipboard_text_length"] == len(long_text)
    assert context["clipboard_text_preview"] == "xxxxx..."
    assert context["clipboard"]["text"] == "xxxxx..."
    assert context["selected_text_preview"] == "xxxxx..."


def test_selected_text_capture_can_be_disabled_safely(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(selected_text.settings, "enable_selected_text_capture", False)
    result = selected_text.get_selected_text()
    assert result["available"] is False
    assert result["capture_status"] == "disabled"


def test_selected_text_failure_restores_clipboard_when_possible(monkeypatch: pytest.MonkeyPatch):
    restored: list[str] = []
    monkeypatch.setattr(selected_text.settings, "enable_selected_text_capture", True)
    monkeypatch.setattr(selected_text.settings, "selected_text_restore_clipboard", True)
    monkeypatch.setattr(
        selected_text,
        "get_clipboard_snapshot",
        lambda: ClipboardSnapshot(text="original clipboard", has_text=True, format_count=1, capture_status="ok", warnings=[]),
    )
    monkeypatch.setattr(selected_text, "clear_clipboard", lambda: True)
    monkeypatch.setattr(selected_text, "_send_ctrl_c", lambda: (_ for _ in ()).throw(RuntimeError("copy failed")))
    monkeypatch.setattr(selected_text, "set_clipboard_text", lambda text: restored.append(text) or True)
    monkeypatch.setattr(selected_text, "get_active_window", lambda: {"process_id": 1})

    result = selected_text.get_selected_text()

    assert result["capture_status"] == "failed"
    assert restored == ["original clipboard"]


def test_active_window_fallback_works_when_detection_fails(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(active_window, "_collect_active_window", lambda: (_ for _ in ()).throw(RuntimeError("fail")))
    result = active_window.get_active_window()
    assert result["title"] == ""
    assert result["process_name"] == "unknown"
    assert result["capture_status"] == "unavailable"


def test_secret_redaction_masks_common_tokens():
    text = "api_key=abc123456789 token=secretvalue sk-abcdefghijklmnopqrstuvwxyz"
    redacted = context_builder._redact_secrets(text)
    assert "abc123456789" not in redacted
    assert "secretvalue" not in redacted
    assert "sk-abcdefghijklmnopqrstuvwxyz" not in redacted


@pytest.mark.asyncio
async def test_context_endpoint_handles_rapid_calls():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for _ in range(5):
            response = await client.get("/context/current")
            assert response.status_code == 200
            data = response.json()
            assert "active_window" in data
            assert "warnings" in data


"""Backend tests for Phase 2A approval-based text actions."""
from __future__ import annotations

import asyncio
from typing import Any

from httpx import ASGITransport, AsyncClient
import pytest
import pytest_asyncio

from api import actions as actions_api
from main import app


async def _noop_log(**kwargs: Any) -> None:
    """No-op async log_action replacement for tests."""
    return None


def _make_log_capture(captured: list[dict[str, Any]]):
    async def log_action(**kwargs: Any) -> None:
        captured.append(kwargs)

    return log_action


def _fake_executor(*, copy_result: dict | None = None, paste_result: dict | None = None):
    class FakeExecutor:
        def __init__(self):
            self.copy_calls: list[str] = []
            self.paste_calls: list[str] = []

        def copy_text(self, text: str) -> dict:
            self.copy_calls.append(text)
            return copy_result or {"executed": True, "status": "ok", "warnings": [], "safe_message": "تم النسخ."}

        def paste_text(self, text: str) -> dict:
            self.paste_calls.append(text)
            return paste_result or {"executed": True, "status": "ok", "warnings": [], "safe_message": "تم اللصق."}

    return FakeExecutor()


@pytest.fixture
def fake_executor_factory():
    def make(copy_result=None, paste_result=None):
        return _fake_executor(copy_result=copy_result, paste_result=paste_result)

    return make


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_preview_allows_copy_to_clipboard(client: AsyncClient):
    response = await client.post("/actions/preview", json={"action_type": "copy_to_clipboard", "text": "hello"})
    assert response.status_code == 200
    data = response.json()
    assert data["action_type"] == "copy_to_clipboard"
    assert data["risk_level"] == "low"
    assert data["requires_confirmation"] is False
    assert data["allowed"] is True
    assert data["payload_length"] == 5
    assert "action_id" in data


@pytest.mark.asyncio
async def test_preview_allows_paste_text_approved_with_confirmation(client: AsyncClient):
    response = await client.post("/actions/preview", json={"action_type": "paste_text_approved", "text": "paste me", "target_hint": "notes"})
    assert response.status_code == 200
    data = response.json()
    assert data["action_type"] == "paste_text_approved"
    assert data["risk_level"] == "medium"
    assert data["requires_confirmation"] is True
    assert data["allowed"] is True
    assert data["payload_preview"] == "paste me"
    assert data["target_hint"] == "notes"


@pytest.mark.asyncio
async def test_preview_allows_paste_preview_only(client: AsyncClient):
    response = await client.post("/actions/preview", json={"action_type": "paste_preview_only", "text": "preview only"})
    assert response.status_code == 200
    data = response.json()
    assert data["action_type"] == "paste_preview_only"
    assert data["risk_level"] == "low"
    assert data["requires_confirmation"] is False
    assert data["allowed"] is True


@pytest.mark.asyncio
async def test_preview_rejects_unknown_action_type(client: AsyncClient):
    response = await client.post("/actions/preview", json={"action_type": "shell_exec", "text": "rm -rf /"})
    assert response.status_code == 200
    data = response.json()
    assert data["allowed"] is False
    assert data["risk_level"] == "unknown"
    assert any("غير مسموح" in warning for warning in data["warnings"])


@pytest.mark.asyncio
async def test_preview_rejects_destructive_and_system_keywords(client: AsyncClient):
    for action_type in ["delete_file", "run_shell_command", "send_email", "pay_invoice", "upload_system_config"]:
        response = await client.post("/actions/preview", json={"action_type": action_type, "text": "x"})
        data = response.json()
        assert data["allowed"] is False, f"{action_type} should be blocked"


@pytest.mark.asyncio
async def test_preview_rejects_empty_text(client: AsyncClient):
    response = await client.post("/actions/preview", json={"action_type": "copy_to_clipboard", "text": ""})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_preview_redacts_secret_like_text(client: AsyncClient):
    response = await client.post(
        "/actions/preview",
        json={"action_type": "copy_to_clipboard", "text": "api_key=sk-12345678901234567890abcdef"},
    )
    data = response.json()
    assert data["allowed"] is True
    assert "***REDACTED***" in data["payload_preview"]
    assert "sk-1234567890" not in data["payload_preview"]


@pytest.mark.asyncio
async def test_confirm_cancels_action(client: AsyncClient, monkeypatch: pytest.MonkeyPatch):
    preview_response = await client.post("/actions/preview", json={"action_type": "paste_text_approved", "text": "text"})
    action_id = preview_response.json()["action_id"]

    logged: list[dict] = []
    monkeypatch.setattr(actions_api, "log_action", _make_log_capture(logged))

    response = await client.post("/actions/confirm", json={"action_id": action_id, "confirm": False})
    data = response.json()
    assert data["status"] == "canceled"
    assert data["executed"] is False
    assert data["safe_message"] == "تم الإلغاء."
    assert logged[0]["status"] == "canceled"
    assert logged[0]["approved"] is False


@pytest.mark.asyncio
async def test_confirm_requires_valid_action_id(client: AsyncClient):
    response = await client.post("/actions/confirm", json={"action_id": "not-a-real-id", "confirm": True})
    data = response.json()
    assert data["status"] == "not_found"
    assert data["executed"] is False


@pytest.mark.asyncio
async def test_confirm_does_not_execute_unconfirmed_paste(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, fake_executor_factory
):
    preview_response = await client.post("/actions/preview", json={"action_type": "paste_text_approved", "text": "text"})
    action_id = preview_response.json()["action_id"]

    fake = fake_executor_factory()
    monkeypatch.setattr(actions_api, "get_executor", lambda: fake)
    monkeypatch.setattr(actions_api, "log_action", _noop_log)

    response = await client.post("/actions/confirm", json={"action_id": action_id, "confirm": False})
    data = response.json()
    assert data["status"] == "canceled"
    assert data["executed"] is False
    assert fake.paste_calls == []


@pytest.mark.asyncio
async def test_confirm_executes_copy_after_preview(client: AsyncClient, monkeypatch: pytest.MonkeyPatch, fake_executor_factory):
    preview_response = await client.post("/actions/preview", json={"action_type": "copy_to_clipboard", "text": "copy this"})
    action_id = preview_response.json()["action_id"]

    fake = fake_executor_factory()
    monkeypatch.setattr(actions_api, "get_executor", lambda: fake)
    monkeypatch.setattr(actions_api, "log_action", _noop_log)

    response = await client.post("/actions/confirm", json={"action_id": action_id, "confirm": True})
    data = response.json()
    assert data["status"] == "ok"
    assert data["executed"] is True
    assert fake.copy_calls == ["copy this"]


@pytest.mark.asyncio
async def test_confirm_executes_paste_after_approval(client: AsyncClient, monkeypatch: pytest.MonkeyPatch, fake_executor_factory):
    preview_response = await client.post("/actions/preview", json={"action_type": "paste_text_approved", "text": "paste this"})
    action_id = preview_response.json()["action_id"]

    fake = fake_executor_factory()
    monkeypatch.setattr(actions_api, "get_executor", lambda: fake)
    monkeypatch.setattr(actions_api, "log_action", _noop_log)

    response = await client.post("/actions/confirm", json={"action_id": action_id, "confirm": True})
    data = response.json()
    assert data["status"] == "ok"
    assert data["executed"] is True
    assert fake.paste_calls == ["paste this"]


@pytest.mark.asyncio
async def test_confirm_returns_warning_when_paste_shortcut_fails(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, fake_executor_factory
):
    preview_response = await client.post("/actions/preview", json={"action_type": "paste_text_approved", "text": "x"})
    action_id = preview_response.json()["action_id"]

    fake = fake_executor_factory(
        paste_result={
            "executed": False,
            "status": "error",
            "warnings": ["تعذر إرسال اختصار اللصق."],
            "safe_message": "تعذر اللصق، تأكد من مكان المؤشر.",
        }
    )
    monkeypatch.setattr(actions_api, "get_executor", lambda: fake)
    monkeypatch.setattr(actions_api, "log_action", _noop_log)

    response = await client.post("/actions/confirm", json={"action_id": action_id, "confirm": True})
    data = response.json()
    assert data["status"] == "error"
    assert data["executed"] is False
    assert "تعذر اللصق" in data["safe_message"]


@pytest.mark.asyncio
async def test_clipboard_restore_path_is_mocked_and_tested(client: AsyncClient, monkeypatch: pytest.MonkeyPatch):
    captured: list[tuple[str, str]] = []

    def fake_paste(text: str) -> dict:
        captured.append(("paste", text))
        return {"executed": True, "status": "ok", "warnings": [], "safe_message": "تم اللصق."}

    def fake_get() -> str:
        return "original"

    def fake_set(text: str) -> None:
        captured.append(("set", text))

    from actions import executor as executor_module

    fake_executor = executor_module.ActionExecutor(
        get_clipboard=fake_get,
        set_clipboard=fake_set,
        send_paste_shortcut=lambda: True,
    )
    monkeypatch.setattr(actions_api, "get_executor", lambda: fake_executor)
    monkeypatch.setattr(actions_api, "log_action", _noop_log)

    preview_response = await client.post("/actions/preview", json={"action_type": "paste_text_approved", "text": "new"})
    action_id = preview_response.json()["action_id"]

    response = await client.post("/actions/confirm", json={"action_id": action_id, "confirm": True})
    data = response.json()
    assert data["status"] == "ok"
    assert captured == [("set", "new"), ("set", "original")]


@pytest.mark.asyncio
async def test_action_logs_do_not_include_full_payload_by_default(client: AsyncClient, monkeypatch: pytest.MonkeyPatch):
    logged: list[dict] = []
    monkeypatch.setattr(actions_api, "log_action", _make_log_capture(logged))
    monkeypatch.setattr(actions_api, "get_executor", lambda: _fake_executor())

    secret_text = "secret=123456789012345"
    preview_response = await client.post("/actions/preview", json={"action_type": "copy_to_clipboard", "text": secret_text})
    action_id = preview_response.json()["action_id"]

    await client.post("/actions/confirm", json={"action_id": action_id, "confirm": True})

    assert logged
    entry = logged[-1]
    assert entry["payload_length"] == len(secret_text)
    assert "123456789012345" not in str(entry.get("payload_preview", ""))


@pytest.mark.asyncio
async def test_copy_endpoint_executes_and_logs(client: AsyncClient, monkeypatch: pytest.MonkeyPatch, fake_executor_factory):
    fake = fake_executor_factory()
    logged: list[dict] = []
    monkeypatch.setattr(actions_api, "get_executor", lambda: fake)
    monkeypatch.setattr(actions_api, "log_action", _make_log_capture(logged))

    response = await client.post("/actions/copy", json={"text": "copy via endpoint"})
    data = response.json()
    assert data["status"] == "ok"
    assert data["executed"] is True
    assert fake.copy_calls == ["copy via endpoint"]
    assert logged[0]["action_type"] == "copy_to_clipboard"


@pytest.mark.asyncio
async def test_paste_preview_endpoint_returns_safe_preview(client: AsyncClient):
    response = await client.post("/actions/paste-preview", json={"text": "long text " * 100})
    data = response.json()
    assert data["action_type"] == "paste_preview_only"
    assert data["requires_confirmation"] is False
    assert data["payload_length"] == len("long text " * 100)
    assert len(data["payload_preview"]) <= 501
    assert data["safe_message"] == "هذه معاينة لصق فقط. لن يتم اللصق تلقائيًا."


@pytest.mark.asyncio
async def test_action_log_includes_target_hint(client: AsyncClient, monkeypatch: pytest.MonkeyPatch):
    logged: list[dict] = []
    monkeypatch.setattr(actions_api, "log_action", _make_log_capture(logged))
    monkeypatch.setattr(actions_api, "get_executor", lambda: _fake_executor())

    preview_response = await client.post(
        "/actions/preview",
        json={"action_type": "paste_text_approved", "text": "hello", "target_hint": "Notepad"},
    )
    action_id = preview_response.json()["action_id"]

    await client.post("/actions/confirm", json={"action_id": action_id, "confirm": True})

    assert logged
    assert logged[-1]["target_hint"] == "Notepad"
    assert logged[-1]["payload_length"] == 5


@pytest.mark.asyncio
async def test_preview_accepts_target_metadata(client: AsyncClient):
    response = await client.post(
        "/actions/preview",
        json={
            "action_type": "paste_text_approved",
            "text": "hello",
            "target_hint": "Notepad",
            "target_window_title": "Untitled - Notepad",
            "target_process_name": "notepad.exe",
            "target_captured_at": "2026-06-22T10:00:00+00:00",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["target_hint"] == "Notepad"
    assert data["target_window_title"] == "Untitled - Notepad"
    assert data["target_process_name"] == "notepad.exe"
    assert data["target_captured_at"] == "2026-06-22T10:00:00+00:00"


@pytest.mark.asyncio
async def test_action_log_includes_target_metadata(client: AsyncClient, monkeypatch: pytest.MonkeyPatch):
    logged: list[dict] = []
    monkeypatch.setattr(actions_api, "log_action", _make_log_capture(logged))
    monkeypatch.setattr(actions_api, "get_executor", lambda: _fake_executor())

    preview_response = await client.post(
        "/actions/preview",
        json={
            "action_type": "paste_text_approved",
            "text": "hello",
            "target_hint": "Notepad",
            "target_window_title": "Untitled - Notepad",
            "target_process_name": "notepad.exe",
            "target_captured_at": "2026-06-22T10:00:00+00:00",
        },
    )
    action_id = preview_response.json()["action_id"]

    await client.post("/actions/confirm", json={"action_id": action_id, "confirm": True})

    assert logged
    assert logged[-1]["target_hint"] == "Notepad"
    assert logged[-1]["target_window_title"] == "Untitled - Notepad"
    assert logged[-1]["target_process_name"] == "notepad.exe"
    assert logged[-1]["target_captured_at"] == "2026-06-22T10:00:00+00:00"


@pytest.mark.asyncio
async def test_target_metadata_is_truncated_if_too_long(client: AsyncClient):
    long_hint = "x" * 250
    long_title = "y" * 250
    long_process = "z" * 120
    long_time = "t" * 60
    response = await client.post(
        "/actions/preview",
        json={
            "action_type": "paste_text_approved",
            "text": "hello",
            "target_hint": long_hint,
            "target_window_title": long_title,
            "target_process_name": long_process,
            "target_captured_at": long_time,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["target_hint"]) <= 201
    assert len(data["target_window_title"]) <= 201
    assert len(data["target_process_name"]) <= 101
    assert len(data["target_captured_at"]) <= 51

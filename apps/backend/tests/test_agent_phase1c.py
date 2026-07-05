from httpx import ASGITransport, AsyncClient
import pytest

from api import agent as agent_api
from main import app


@pytest.mark.asyncio
async def test_agent_run_rejects_unsafe_requests_without_calling_provider(monkeypatch: pytest.MonkeyPatch):
    async def fail_run_prompt(*args, **kwargs):
        raise AssertionError("Provider router should not be called for unsafe requests.")

    monkeypatch.setattr(agent_api, "run_prompt", fail_run_prompt)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/agent/run", json={"instruction": "Delete this folder for me."})

    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "safety-layer"
    assert data["model"] == "preview-only"
    assert data["status"] == "refused"
    assert "لا يمكنني تنفيذه" in data["output_text"]
    assert any("غير مسموح" in warning for warning in data["warnings"])


@pytest.mark.asyncio
async def test_agent_run_validates_request_shape():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/agent/run", json={"instruction": "Test", "unexpected": True})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_agent_run_uses_saved_provider_and_model(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(agent_api, "build_context", lambda: {})

    async def fake_run_prompt(prompt: str, provider_name: str | None = None, model_name: str | None = None):
        return {
            "provider": provider_name or "ollama",
            "model": model_name or "llama3.2:latest",
            "output_text": "نعم، النموذج يعمل.",
            "latency_ms": 8,
            "status": "ok",
            "warnings": [],
        }

    monkeypatch.setattr(agent_api, "run_prompt", fake_run_prompt)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/agent/run",
            json={"instruction": "اكتب جملة قصيرة تؤكد أن النموذج يعمل."},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["model"] == "llama3.2:latest"
    assert "يعمل" in data["output_text"]


@pytest.mark.asyncio
async def test_agent_run_handles_provider_error_gracefully(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        agent_api,
        "build_context",
        lambda: {
            "active_window_title": "Inbox",
            "active_process_name": "mail.exe",
            "active_process_id": 12,
            "clipboard_text_preview": "Hello world",
            "clipboard_text_length": 11,
            "selected_text_preview": "",
            "selected_text_length": 0,
            "capture_status": {"clipboard": "ok", "selected_text": "disabled"},
        },
    )

    async def fake_run_prompt(prompt: str, provider_name: str | None = None, model_name: str | None = None):
        assert "Hello world" in prompt
        return {
            "provider": provider_name or "ollama",
            "model": model_name or "llama3.2",
            "output_text": "",
            "latency_ms": 14,
            "status": "error",
            "warnings": ["تعذر الاتصال بمزود Ollama."],
            "raw_error": "Connection refused",
        }

    monkeypatch.setattr(agent_api, "run_prompt", fake_run_prompt)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/agent/run",
            json={
                "instruction": "Summarize this.",
                "mode": "summarize",
                "provider": "ollama",
                "include_clipboard_context": True,
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "ollama"
    assert data["model"] == "llama3.2"
    assert data["status"] == "error"
    assert data["warnings"] == ["تعذر الاتصال بمزود Ollama."]
    assert data["raw_error"] == "Connection refused"
    assert data["mode"] == "summarize"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_agent_run_supports_legacy_prompt(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(agent_api, "build_context", lambda: {})

    async def fake_run_prompt(prompt: str, provider_name: str | None = None, model_name: str | None = None):
        assert "Legacy prompt content" in prompt
        return {
            "provider": "ollama",
            "model": "llama3.2",
            "output_text": "Legacy path works",
            "latency_ms": 5,
            "status": "ok",
            "warnings": [],
        }

    monkeypatch.setattr(agent_api, "run_prompt", fake_run_prompt)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/agent/run", json={"prompt": "Legacy prompt content"})

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["output_text"] == "Legacy path works"


@pytest.mark.asyncio
async def test_agent_run_handles_provider_timeout_safely(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(agent_api, "build_context", lambda: {})

    async def fake_run_prompt(prompt: str, provider_name: str | None = None, model_name: str | None = None):
        return {
            "provider": "ollama",
            "model": "llama3.2",
            "output_text": "",
            "latency_ms": 0,
            "status": "timeout",
            "warnings": ["انتهت مهلة الطلب عند الاتصال بخادم Ollama المحلي."],
            "safe_error_message": "Request timed out",
        }

    monkeypatch.setattr(agent_api, "run_prompt", fake_run_prompt)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/agent/run", json={"instruction": "اكتب تحية قصيرة."})

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "timeout"
    assert data["warnings"] == ["انتهت مهلة الطلب عند الاتصال بخادم Ollama المحلي."]
    assert data["safe_error_message"] == "Request timed out"


@pytest.mark.asyncio
async def test_selected_input_rejects_unsupported_extension():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/agent/selected-input",
            json={
                "action": "summarize",
                "source_type": "file",
                "input_text": "dummy",
                "file_name": "report.pdf",
                "file_extension": ".pdf",
                "file_size": 1024,
            },
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_selected_input_runs_provider_with_sanitized_metadata(monkeypatch: pytest.MonkeyPatch):
    captured_prompt = {}

    async def fake_run_prompt(prompt: str, provider_name: str | None = None, model_name: str | None = None):
        captured_prompt["text"] = prompt
        captured_prompt["provider"] = provider_name
        captured_prompt["model"] = model_name
        return {
            "provider": provider_name or "lmstudio",
            "model": model_name or "google/gemma",
            "output_text": "هذا ملخص مختصر.",
            "status": "ok",
            "warnings": [],
        }

    monkeypatch.setattr(agent_api, "run_prompt", fake_run_prompt)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/agent/selected-input",
            json={
                "action": "summarize",
                "source_type": "file",
                "input_text": "نص طويل",
                "file_name": "notes.md",
                "file_extension": ".md",
                "file_size": 2048,
                "provider": "lmstudio",
                "model": "google/gemma",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["selected_input"]["file_name"] == "notes.md"
    assert data["selected_input"]["file_extension"] == ".md"
    assert "نص طويل" in captured_prompt["text"]
    assert captured_prompt["provider"] == "lmstudio"
    assert data["provider"] == "lmstudio"


@pytest.mark.asyncio
async def test_selected_input_truncates_large_payload(monkeypatch: pytest.MonkeyPatch):
    async def fake_run_prompt(prompt: str, provider_name: str | None = None, model_name: str | None = None):
        return {
            "provider": "ollama",
            "model": "llama3.2",
            "output_text": "تمام",
            "status": "ok",
            "warnings": [],
        }

    monkeypatch.setattr(agent_api, "run_prompt", fake_run_prompt)

    oversized_text = "a" * (agent_api.MAX_SELECTED_INPUT_CHARS + 1000)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/agent/selected-input",
            json={
                "action": "summarize",
                "source_type": "paste",
                "input_text": oversized_text,
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert any("تم تقليص" in warning for warning in data["warnings"])

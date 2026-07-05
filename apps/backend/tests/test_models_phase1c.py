from httpx import ASGITransport, AsyncClient
import pytest

from api import models as models_api
from main import app
from model_router import router as router_module
from core import provider_tests as provider_tests_module


def build_provider_settings(**overrides):
    return {
        "active_provider": "ollama",
        "active_model": "llama3.2",
        "ollama_base_url": "http://localhost:11434",
        "ollama_model": "llama3.2",
        "lmstudio_base_url": "http://localhost:1234/v1",
        "lmstudio_model": "local-model",
        "openai_compatible_base_url": "",
        "openai_compatible_model": "",
        "openai_compatible_api_key_env": "OPENAI_COMPATIBLE_API_KEY",
        "request_timeout_seconds": 60,
        **overrides,
    }


class DummyProvider:
    def __init__(
        self,
        *,
        label: str,
        base_url: str,
        default_model: str,
        configured: bool,
        health_status: str = "online",
        warnings: list[str] | None = None,
        models: list[str] | None = None,
        raise_on_list: bool = False,
        api_key_env: str | None = None,
        api_key: str = "",
    ) -> None:
        self.label = label
        self.base_url = base_url
        self.default_model = default_model
        self.configured = configured
        self.health_status = health_status
        self.warnings = warnings or []
        self.models = models or []
        self.raise_on_list = raise_on_list
        self.api_key_env = api_key_env
        self.api_key = api_key

    async def health_check(self) -> dict:
        payload = {"health_status": self.health_status, "warnings": self.warnings}
        if self.health_status == "online" and not self.raise_on_list:
            payload["models"] = self.models
        return payload

    async def list_models(self) -> list[str]:
        if self.raise_on_list:
            raise RuntimeError("list models failed")
        return self.models

    def resolve_model(self) -> str:
        return self.default_model


@pytest.mark.asyncio
async def test_models_settings_returns_safe_payload(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        models_api,
        "load_provider_settings",
        lambda: build_provider_settings(openai_compatible_api_key_env="CUSTOM_KEY_ENV"),
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/models/settings")

    assert response.status_code == 200
    data = response.json()
    assert data["active_provider"] == "ollama"
    assert data["active_model"] == "llama3.2"
    assert data["openai_compatible_api_key_env"] == "CUSTOM_KEY_ENV"
    assert "sk-secret" not in str(data)


@pytest.mark.asyncio
async def test_models_settings_rejects_secret_fields():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/models/settings", json={"api_key": "sk-secret"})

    assert response.status_code == 422
    assert "لا يمكن حفظ مفاتيح أو رموز سرية داخل التطبيق" in response.text


@pytest.mark.asyncio
async def test_models_settings_persists_only_safe_payload(monkeypatch: pytest.MonkeyPatch):
    captured: dict[str, object] = {}

    def fake_save_provider_settings(updates: dict[str, object]):
        captured.update(updates)
        return build_provider_settings(**updates)

    monkeypatch.setattr(models_api, "save_provider_settings", fake_save_provider_settings)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/models/settings",
            json={
                "active_provider": "lmstudio",
                "active_model": "qwen-local",
                "lmstudio_base_url": "http://127.0.0.1:1234/v1",
                "lmstudio_model": "qwen-local",
                "request_timeout_seconds": 45,
            },
        )

    assert response.status_code == 200
    assert captured == {
        "active_provider": "lmstudio",
        "active_model": "qwen-local",
        "lmstudio_base_url": "http://127.0.0.1:1234/v1",
        "lmstudio_model": "qwen-local",
        "request_timeout_seconds": 45,
    }
    assert response.json()["active_provider"] == "lmstudio"


@pytest.mark.asyncio
async def test_models_providers_reflects_online_and_offline_status(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        router_module,
        "load_provider_settings",
        lambda: build_provider_settings(active_provider="lmstudio", active_model="google/gemma-4-e2b"),
    )
    monkeypatch.setattr(
        router_module,
        "_build_provider_map",
        lambda provider_settings=None: {
            "lmstudio": DummyProvider(
                label="LM Studio",
                base_url="http://127.0.0.1:1234/v1",
                default_model="google/gemma-4-e2b",
                configured=True,
                health_status="online",
                warnings=[],
                models=["google/gemma-4-e2b"],
            ),
            "ollama": DummyProvider(
                label="Ollama",
                base_url="http://localhost:11434",
                default_model="llama3.2",
                configured=True,
                health_status="offline",
                warnings=["Ollama offline for test."],
                models=[],
            ),
        },
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/models/providers")

    assert response.status_code == 200
    data = response.json()
    providers = {provider["id"]: provider for provider in data["providers"]}
    assert providers["lmstudio"]["health_status"] == "online"
    assert providers["lmstudio"]["diagnostic_status"] == "online"
    assert providers["lmstudio"]["is_active"] is True
    assert providers["ollama"]["health_status"] == "offline"
    assert providers["ollama"]["diagnostic_status"] == "missing_server"
    assert providers["ollama"]["is_active"] is False


@pytest.mark.asyncio
async def test_models_providers_returns_safe_provider_data_without_secrets(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(router_module, "load_provider_settings", lambda: build_provider_settings())
    monkeypatch.setattr(
        router_module,
        "_build_provider_map",
        lambda provider_settings=None: {
            "ollama": DummyProvider(
                label="Ollama",
                base_url="https://user:password@example.test/v1?api_key=secret",
                default_model="llama3.2",
                configured=True,
                warnings=["Using local test stub."],
                models=["stub-model"],
                api_key_env="OPENAI_COMPATIBLE_API_KEY",
                api_key="super-secret-key",
            )
        },
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/models/providers")

    assert response.status_code == 200
    data = response.json()
    provider = data["providers"][0]
    serialized = str(data)

    assert data["active_provider"] == "ollama"
    assert data["active_model"] == "llama3.2"
    assert provider["id"] == "ollama"
    assert provider["display_name"] == "أولاما"
    assert provider["base_url"] == "https://example.test/v1"
    assert provider["selected_model"] == "llama3.2"
    assert provider["models"] == ["stub-model"]
    assert provider["discovered_models"] == ["stub-model"]
    assert provider["api_key_env"] == "OPENAI_COMPATIBLE_API_KEY"
    assert provider["api_key_configured"] is True
    assert "secret" not in serialized
    assert "password" not in serialized
    assert "super-secret-key" not in serialized


@pytest.mark.asyncio
async def test_models_providers_returns_graceful_offline_ollama_warning(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(router_module, "load_provider_settings", lambda: build_provider_settings())
    monkeypatch.setattr(
        router_module,
        "_build_provider_map",
        lambda provider_settings=None: {
            "ollama": DummyProvider(
                label="Ollama",
                base_url="http://localhost:11434",
                default_model="llama3.2",
                configured=True,
                health_status="offline",
                warnings=["يتعذر الوصول إلى خادم Ollama المحلي حاليًا."],
            )
        },
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/models/providers")

    assert response.status_code == 200
    provider = response.json()["providers"][0]
    assert provider["diagnostic_status"] == "missing_server"
    assert provider["warnings"] == ["يتعذر الوصول إلى خادم Ollama المحلي حاليًا."]
    assert provider["guidance"]["provider"] == "ollama"
    assert provider["guidance"]["severity"] == "error"
    assert "ollama serve" in provider["guidance"].get("command_hint", "")


@pytest.mark.asyncio
async def test_models_providers_returns_online_ollama_without_models_warning(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(router_module, "load_provider_settings", lambda: build_provider_settings())
    monkeypatch.setattr(
        router_module,
        "_build_provider_map",
        lambda provider_settings=None: {
            "ollama": DummyProvider(
                label="Ollama",
                base_url="http://localhost:11434",
                default_model="llama3.2",
                configured=True,
                health_status="online",
                warnings=["خادم Ollama يعمل، لكن لا توجد نماذج محلية مثبتة حاليًا."],
                models=[],
            )
        },
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/models/providers")

    assert response.status_code == 200
    provider = response.json()["providers"][0]
    assert provider["diagnostic_status"] == "no_model_loaded"
    assert provider["warnings"] == ["خادم Ollama يعمل، لكن لا توجد نماذج محلية مثبتة حاليًا."]
    assert provider["guidance"]["severity"] == "warning"
    assert "ollama pull" in provider["guidance"].get("command_hint", "")
    assert any("النموذج" in step for step in provider["guidance"].get("steps", []))


@pytest.mark.asyncio
async def test_models_providers_returns_graceful_offline_lmstudio_warning(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        router_module,
        "load_provider_settings",
        lambda: build_provider_settings(active_provider="lmstudio", active_model="local-model"),
    )
    monkeypatch.setattr(
        router_module,
        "_build_provider_map",
        lambda provider_settings=None: {
            "lmstudio": DummyProvider(
                label="LM Studio",
                base_url="http://localhost:1234/v1",
                default_model="local-model",
                configured=True,
                health_status="offline",
                warnings=["يتعذر الوصول إلى مزود LM Studio حاليًا."],
            )
        },
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/models/providers")

    assert response.status_code == 200
    provider = response.json()["providers"][0]
    assert provider["diagnostic_status"] == "missing_server"
    assert provider["warnings"] == ["يتعذر الوصول إلى مزود LM Studio حاليًا."]
    assert provider["guidance"]["provider"] == "lmstudio"
    assert provider["guidance"]["severity"] == "error"
    assert any("Local Server" in step or "LM Studio" in step for step in provider["guidance"].get("steps", []))


@pytest.mark.asyncio
async def test_models_providers_returns_graceful_unconfigured_openai_warning(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        router_module,
        "load_provider_settings",
        lambda: build_provider_settings(active_provider="openai_compatible", active_model=""),
    )
    monkeypatch.setattr(
        router_module,
        "_build_provider_map",
        lambda provider_settings=None: {
            "openai_compatible": DummyProvider(
                label="OpenAI Compatible",
                base_url="",
                default_model="",
                configured=False,
                health_status="unconfigured",
                warnings=["عنوان OpenAI Compatible غير مهيأ."],
                api_key_env="OPENAI_COMPATIBLE_API_KEY",
                api_key="",
            )
        },
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/models/providers")

    assert response.status_code == 200
    provider = response.json()["providers"][0]
    assert provider["diagnostic_status"] == "misconfigured"
    assert provider["warnings"] == ["عنوان OpenAI Compatible غير مهيأ."]
    assert provider["api_key_configured"] is False
    assert provider["guidance"] is None


@pytest.mark.asyncio
async def test_models_providers_model_discovery_failure_does_not_crash_backend(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(router_module, "load_provider_settings", lambda: build_provider_settings())
    monkeypatch.setattr(
        router_module,
        "_build_provider_map",
        lambda provider_settings=None: {
            "ollama": DummyProvider(
                label="Ollama",
                base_url="http://localhost:11434",
                default_model="llama3.2",
                configured=True,
                raise_on_list=True,
            )
        },
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/models/providers")

    assert response.status_code == 200
    provider = response.json()["providers"][0]
    assert provider["models"] == []
    assert "تعذر تحميل قائمة النماذج من مزود Ollama." in provider["warnings"]


@pytest.mark.asyncio
async def test_models_diagnostics_endpoint_returns_checklist(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(router_module, "load_provider_settings", lambda: build_provider_settings())
    monkeypatch.setattr(
        router_module,
        "_build_provider_map",
        lambda provider_settings=None: {
            "ollama": DummyProvider(
                label="Ollama",
                base_url="http://localhost:11434",
                default_model="llama3.2",
                configured=True,
                health_status="online",
                warnings=[],
                models=["llama3.2"],
            )
        },
    )
    monkeypatch.setattr(
        provider_tests_module,
        "load_provider_test_history",
        lambda: {
            "ollama": {
                "tested_at": "2026-06-22T12:00:00+00:00",
                "success": True,
                "status": "ok",
                "message": "جاهز",
                "latency_ms": 42,
            }
        },
    )
    monkeypatch.setattr(
        provider_tests_module,
        "load_diagnostics_history",
        lambda limit=10: [
            {
                "provider": "ollama",
                "provider_label": "أولاما",
                "diagnostic_status": "online",
                "success": True,
                "message": "جاهز",
                "tested_at": "2026-06-22T12:00:00+00:00",
            }
        ],
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/models/diagnostics")

    assert response.status_code == 200
    payload = response.json()
    assert payload["active_provider"] == "ollama"
    assert len(payload["checklist"]) > 0
    assert payload["history"][0]["provider_label"] == "أولاما"


@pytest.mark.asyncio
async def test_models_test_persists_successful_result(monkeypatch: pytest.MonkeyPatch):
    captured_history: dict[str, dict] = {}

    def fake_load_history():
        return captured_history

    def fake_save(provider_id: str, record: dict):
        captured_history[provider_id] = record
        return record

    async def fake_run_prompt(prompt: str, provider_name: str | None = None, model_name: str | None = None, provider_settings=None):
        return {
            "provider": provider_name or "ollama",
            "model": model_name or "llama3.2",
            "output_text": "جاهز",
            "latency_ms": 42,
            "status": "ok",
        }

    monkeypatch.setattr(provider_tests_module, "load_provider_test_history", fake_load_history)
    monkeypatch.setattr(provider_tests_module, "save_provider_test_result", fake_save)
    monkeypatch.setattr(router_module, "save_provider_test_result", fake_save)
    monkeypatch.setattr(router_module, "run_prompt", fake_run_prompt)
    monkeypatch.setattr(router_module, "load_provider_settings", lambda: build_provider_settings())
    monkeypatch.setattr(router_module, "get_provider", lambda *_, **__: DummyProvider(label="Ollama", base_url="http://localhost:11434", default_model="llama3.2", configured=True))

    result = await router_module.test_provider(provider_name="ollama")

    assert result["status"] == "ok"
    assert "tested_at" in result
    assert "ollama" in captured_history
    assert captured_history["ollama"]["success"] is True
    assert captured_history["ollama"]["diagnostic_status"] == "online"
    assert captured_history["ollama"]["tested_model"] == "llama3.2"


@pytest.mark.asyncio
async def test_models_test_persists_failed_result(monkeypatch: pytest.MonkeyPatch):
    captured_history: dict[str, dict] = {}

    def fake_load_history():
        return captured_history

    def fake_save(provider_id: str, record: dict):
        captured_history[provider_id] = record
        return record

    async def fake_run_prompt(prompt: str, provider_name: str | None = None, model_name: str | None = None, provider_settings=None):
        return {
            "provider": provider_name or "ollama",
            "model": model_name or "llama3.2",
            "output_text": "",
            "latency_ms": 0,
            "status": "error",
            "safe_error_message": "Connection refused",
        }

    monkeypatch.setattr(provider_tests_module, "load_provider_test_history", fake_load_history)
    monkeypatch.setattr(provider_tests_module, "save_provider_test_result", fake_save)
    monkeypatch.setattr(router_module, "save_provider_test_result", fake_save)
    monkeypatch.setattr(router_module, "load_provider_test_history", fake_load_history)
    monkeypatch.setattr(router_module, "run_prompt", fake_run_prompt)
    monkeypatch.setattr(router_module, "load_provider_settings", lambda: build_provider_settings())
    monkeypatch.setattr(router_module, "get_provider", lambda *_, **__: DummyProvider(label="Ollama", base_url="http://localhost:11434", default_model="llama3.2", configured=True))

    result = await router_module.test_provider(provider_name="ollama")

    assert result["status"] == "error"
    assert "tested_at" in result
    assert captured_history["ollama"]["success"] is False
    assert captured_history["ollama"]["diagnostic_status"] == "error"
    assert captured_history["ollama"]["message"] == "Connection refused"


@pytest.mark.asyncio
async def test_models_providers_includes_last_test_metadata(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(router_module, "load_provider_settings", lambda: build_provider_settings())
    monkeypatch.setattr(
        router_module,
        "_build_provider_map",
        lambda provider_settings=None: {
            "ollama": DummyProvider(
                label="Ollama",
                base_url="http://localhost:11434",
                default_model="llama3.2",
                configured=True,
                health_status="online",
                warnings=[],
                models=["llama3.2"],
            )
        },
    )
    monkeypatch.setattr(
        provider_tests_module,
        "load_provider_test_history",
        lambda: {
            "ollama": {
                "tested_at": "2026-06-22T12:00:00+00:00",
                "success": True,
                "status": "ok",
                "message": "جاهز",
                "latency_ms": 50,
            }
        },
    )
    monkeypatch.setattr(
        router_module,
        "load_provider_test_history",
        lambda: {
            "ollama": {
                "tested_at": "2026-06-22T12:00:00+00:00",
                "success": True,
                "status": "ok",
                "message": "جاهز",
                "latency_ms": 50,
            }
        },
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/models/providers")

    assert response.status_code == 200
    provider = response.json()["providers"][0]
    assert provider["last_test_success"] is True
    assert provider["last_test_status"] == "ok"
    assert provider["last_test_message"] == "جاهز"
    assert provider["last_test_latency_ms"] == 50


@pytest.mark.asyncio
async def test_models_test_validates_request_shape():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/models/test", json={"unexpected": True})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_models_test_does_not_include_context_data(monkeypatch: pytest.MonkeyPatch):
    captured: dict[str, str | None] = {}

    async def fake_test_provider(provider_name: str | None = None, model_name: str | None = None, test_prompt: str | None = None):
        captured["provider_name"] = provider_name
        captured["model_name"] = model_name
        captured["test_prompt"] = test_prompt
        return {
            "provider": provider_name or "ollama",
            "model": model_name or "llama3.2",
            "status": "ok",
            "latency_ms": 12,
            "output_text": "جاهز",
            "output_preview": "جاهز",
            "warnings": [],
        }

    monkeypatch.setattr(models_api, "test_provider", fake_test_provider)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/models/test",
            json={"provider": "ollama", "model": "llama3.2", "test_prompt": "اختبر الاتصال"},
        )

    assert response.status_code == 200
    data = response.json()
    assert captured == {
        "provider_name": "ollama",
        "model_name": "llama3.2",
        "test_prompt": "اختبر الاتصال",
    }
    assert "clipboard" not in data
    assert "selected_text" not in data
    assert "screenshot" not in data


@pytest.mark.asyncio
async def test_models_test_handles_offline_provider_gracefully(monkeypatch: pytest.MonkeyPatch):
    async def fake_test_provider(provider_name: str | None = None, model_name: str | None = None, test_prompt: str | None = None):
        return {
            "provider": provider_name or "ollama",
            "model": model_name or "llama3.2",
            "status": "error",
            "latency_ms": 0,
            "output_text": "",
            "output_preview": "",
            "warnings": ["تعذر الاتصال بمزود Ollama."],
            "safe_error_message": "Connection refused",
        }

    monkeypatch.setattr(models_api, "test_provider", fake_test_provider)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/models/test", json={"provider": "ollama"})

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "error"
    assert data["warnings"] == ["تعذر الاتصال بمزود Ollama."]
    assert data["safe_error_message"] == "Connection refused"

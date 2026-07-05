import pytest
import httpx

from model_router.base import BaseProvider
from model_router import router as router_module


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


class ExplodingProvider(BaseProvider):
    async def generate(self, prompt: str, model: str | None = None):
        raise RuntimeError("Authorization: Bearer sk-secret-token")

    async def list_models(self) -> list[str]:
        return []

    async def health_check(self) -> dict:
        return {"health_status": "online", "warnings": []}


class SanitizingProvider(BaseProvider):
    async def generate(self, prompt: str, model: str | None = None):
        return self._build_result(
            model=self.resolve_model(model),
            output_text="",
            status="error",
            warnings=["Provider failed."],
            raw_error="api_key=abc123 sk-abcdefghijklmnopqrstuvwxyz",
            started_at=0.0,
        )

    async def list_models(self) -> list[str]:
        return []

    async def health_check(self) -> dict:
        return {"health_status": "online", "warnings": []}


class RecordingProvider(BaseProvider):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.last_model: str | None = None

    async def generate(self, prompt: str, model: str | None = None):
        self.last_model = model
        return self._build_result(
            model=self.resolve_model(model),
            output_text="جاهز",
            status="ok",
            warnings=[],
            started_at=0.0,
        )

    async def list_models(self) -> list[str]:
        return []

    async def health_check(self) -> dict:
        return {"health_status": "online", "warnings": [], "models": [self.default_model]}


class TimeoutProvider(BaseProvider):
    async def generate(self, prompt: str, model: str | None = None):
        raise httpx.TimeoutException("timed out")

    async def list_models(self) -> list[str]:
        return []

    async def health_check(self) -> dict:
        return {"health_status": "online", "warnings": [], "models": [self.default_model]}

    def _timeout_warning(self) -> str:
        return "انتهت مهلة الطلب عند الاتصال بخادم Ollama المحلي."


class MalformedProvider(BaseProvider):
    async def generate(self, prompt: str, model: str | None = None):
        return self._build_result(
            model=self.resolve_model(model),
            output_text="",
            status="error",
            warnings=[self._malformed_response_warning()],
            raw_error="Malformed provider response.",
            started_at=0.0,
        )

    async def list_models(self) -> list[str]:
        return []

    async def health_check(self) -> dict:
        return {"health_status": "online", "warnings": [], "models": [self.default_model]}


class FakeOllamaHTTPClient:
    def __init__(self, status_code: int = 404):
        self.status_code = status_code

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def post(self, *args, **kwargs):
        request = httpx.Request("POST", "http://localhost:11434/api/generate")
        response = httpx.Response(self.status_code, request=request)
        raise httpx.HTTPStatusError("Client error '404 Not Found'", request=request, response=response)


@pytest.mark.asyncio
async def test_router_returns_normalized_error_for_unknown_provider():
    result = await router_module.run_prompt("hello", provider_name="missing-provider")

    assert result["provider"] == "missing-provider"
    assert result["status"] == "error"
    assert result["warnings"] == ["مزود النموذج 'missing-provider' غير معروف."]
    assert result["raw_error"] == "Unknown provider."


@pytest.mark.asyncio
async def test_ollama_provider_returns_model_not_found_guidance_for_404(monkeypatch: pytest.MonkeyPatch):
    from model_router.ollama_provider import OllamaProvider

    provider = OllamaProvider("ollama", "Ollama", "http://localhost:11434", "llama3.2", 60)
    monkeypatch.setattr(provider, "_http_client", lambda: FakeOllamaHTTPClient(404))

    result = await provider.generate("hello", model="llama3.2")

    assert result.provider == "ollama"
    assert result.model == "llama3.2"
    assert result.status == "model_not_found"
    assert any("llama3.2" in warning and "ollama pull" in warning for warning in result.warnings)
    assert "sk-" not in (result.raw_error or "")


@pytest.mark.asyncio
async def test_router_uses_saved_active_provider_and_model_when_no_override(monkeypatch: pytest.MonkeyPatch):
    provider = RecordingProvider("ollama", "Ollama", "http://localhost:11434", "llama3.2:latest", 60)
    monkeypatch.setattr(
        router_module,
        "load_provider_settings",
        lambda: build_provider_settings(active_provider="ollama", active_model="llama3.2:latest"),
    )
    monkeypatch.setattr(
        router_module,
        "get_provider",
        lambda name, provider_settings=None: provider if name == "ollama" else None,
    )

    result = await router_module.run_prompt("hello")

    assert result["provider"] == "ollama"
    assert result["model"] == "llama3.2:latest"
    assert provider.last_model is None


@pytest.mark.asyncio
async def test_router_prefers_explicit_model_override(monkeypatch: pytest.MonkeyPatch):
    provider = RecordingProvider("ollama", "Ollama", "http://localhost:11434", "llama3.2", 60)
    monkeypatch.setattr(router_module, "load_provider_settings", lambda: build_provider_settings())
    monkeypatch.setattr(
        router_module,
        "get_provider",
        lambda name, provider_settings=None: provider if name == "ollama" else None,
    )

    result = await router_module.run_prompt("hello", provider_name="ollama", model_name="override-model")

    assert result["provider"] == "ollama"
    assert result["model"] == "override-model"
    assert provider.last_model == "override-model"


@pytest.mark.asyncio
async def test_router_test_provider_uses_saved_provider_and_model_when_no_override(monkeypatch: pytest.MonkeyPatch):
    provider = RecordingProvider("ollama", "Ollama", "http://localhost:11434", "llama3.2:latest", 60)
    monkeypatch.setattr(
        router_module,
        "load_provider_settings",
        lambda: build_provider_settings(active_provider="ollama", active_model="llama3.2:latest"),
    )
    monkeypatch.setattr(
        router_module,
        "get_provider",
        lambda name, provider_settings=None: provider if name == "ollama" else None,
    )

    result = await router_module.test_provider()

    assert result["provider"] == "ollama"
    assert result["model"] == "llama3.2:latest"
    assert result["status"] == "ok"
    assert provider.last_model is None


@pytest.mark.asyncio
async def test_router_returns_timeout_status_for_provider_timeout(monkeypatch: pytest.MonkeyPatch):
    provider = TimeoutProvider("ollama", "Ollama", "http://localhost:11434", "llama3.2", 60)
    monkeypatch.setattr(router_module, "load_provider_settings", lambda: build_provider_settings())
    monkeypatch.setattr(
        router_module,
        "get_provider",
        lambda name, provider_settings=None: provider if name == "ollama" else None,
    )

    result = await router_module.run_prompt("hello", provider_name="ollama")

    assert result["provider"] == "ollama"
    assert result["status"] == "timeout"
    assert result["warnings"] == ["انتهت مهلة الطلب عند الاتصال بخادم Ollama المحلي."]


@pytest.mark.asyncio
async def test_test_provider_handles_malformed_provider_response_safely(monkeypatch: pytest.MonkeyPatch):
    provider = MalformedProvider("ollama", "Ollama", "http://localhost:11434", "llama3.2", 60)
    monkeypatch.setattr(router_module, "load_provider_settings", lambda: build_provider_settings())
    monkeypatch.setattr(
        router_module,
        "get_provider",
        lambda name, provider_settings=None: provider if name == "ollama" else None,
    )

    result = await router_module.test_provider(provider_name="ollama")

    assert result["provider"] == "ollama"
    assert result["status"] == "error"
    assert result["output_preview"] == ""
    assert "استجابة غير صالحة" in result["warnings"][0]
    assert result["safe_error_message"] == "Malformed provider response."


@pytest.mark.asyncio
async def test_router_catches_provider_exceptions_and_redacts_secrets(monkeypatch: pytest.MonkeyPatch):
    provider = ExplodingProvider("ollama", "Ollama", "http://localhost:11434", "llama3.2", 60)
    monkeypatch.setattr(router_module, "load_provider_settings", lambda: build_provider_settings())
    monkeypatch.setattr(
        router_module,
        "get_provider",
        lambda name, provider_settings=None: provider if name == "ollama" else None,
    )

    result = await router_module.run_prompt("hello", provider_name="ollama")

    assert result["provider"] == "ollama"
    assert result["model"] == "llama3.2"
    assert result["status"] == "error"
    assert result["warnings"] == ["تعذر الاتصال بمزود Ollama."]
    assert "sk-secret-token" not in result["raw_error"]
    assert "[REDACTED]" in result["raw_error"]


@pytest.mark.asyncio
async def test_provider_results_redact_api_keys(monkeypatch: pytest.MonkeyPatch):
    provider = SanitizingProvider("ollama", "Ollama", "http://localhost:11434", "llama3.2", 60)
    monkeypatch.setattr(router_module, "load_provider_settings", lambda: build_provider_settings())
    monkeypatch.setattr(
        router_module,
        "get_provider",
        lambda name, provider_settings=None: provider if name == "ollama" else None,
    )

    result = await router_module.run_prompt("hello", provider_name="ollama")

    assert result["provider"] == "ollama"
    assert result["status"] == "error"
    assert "abc123" not in result["raw_error"]
    assert "sk-abcdefghijklmnopqrstuvwxyz" not in result["raw_error"]
    assert "[REDACTED]" in result["raw_error"]

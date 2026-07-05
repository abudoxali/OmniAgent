from pathlib import Path

import pytest

from config import settings
from core import provider_settings as provider_settings_module
from model_router.base import normalize_model_identifiers


def test_normalize_model_identifiers_trims_and_deduplicates():
    models = normalize_model_identifiers([" llama3.2 ", "qwen", "llama3.2", "", " qwen "])

    assert models == ["llama3.2", "qwen"]


def test_load_provider_settings_returns_defaults_when_runtime_file_missing(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    settings_file = tmp_path / "runtime" / "provider_settings.json"
    monkeypatch.setattr(settings, "provider_settings_path", str(settings_file))
    monkeypatch.setattr(settings, "active_provider", "lmstudio")
    monkeypatch.setattr(settings, "active_model", "local-model")
    monkeypatch.setattr(settings, "lmstudio_model", "local-model")

    loaded = provider_settings_module.load_provider_settings()

    assert loaded["active_provider"] == "lmstudio"
    assert loaded["active_model"] == "local-model"
    assert loaded["lmstudio_model"] == "local-model"


def test_save_provider_settings_persists_non_secret_runtime_file(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    settings_file = tmp_path / "runtime" / "provider_settings.json"
    monkeypatch.setattr(settings, "provider_settings_path", str(settings_file))

    saved = provider_settings_module.save_provider_settings(
        {
            "active_provider": "openai_compatible",
            "active_model": "gpt-4o-mini",
            "openai_compatible_base_url": "https://example.test/v1",
            "openai_compatible_model": "gpt-4o-mini",
            "openai_compatible_api_key_env": "OPENAI_COMPATIBLE_API_KEY",
            "request_timeout_seconds": 45,
        }
    )

    assert settings_file.exists()
    serialized = settings_file.read_text(encoding="utf-8")
    assert '"active_provider": "openai_compatible"' in serialized
    assert "sk-" not in serialized
    assert saved["request_timeout_seconds"] == 45

    loaded = provider_settings_module.load_provider_settings()
    assert loaded["active_provider"] == "openai_compatible"
    assert loaded["active_model"] == "gpt-4o-mini"
    assert loaded["openai_compatible_base_url"] == "https://example.test/v1"


def test_get_effective_model_uses_active_model_only_for_active_provider():
    payload = {
        "active_provider": "ollama",
        "active_model": "llama3.2:latest",
        "ollama_model": "llama3.2",
        "lmstudio_model": "qwen-local",
        "openai_compatible_model": "gpt-4o-mini",
    }

    assert provider_settings_module.get_effective_model(payload, "ollama") == "llama3.2:latest"
    assert provider_settings_module.get_effective_model(payload, "lmstudio") == "qwen-local"

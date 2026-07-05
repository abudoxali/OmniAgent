"""Safe persistence for non-secret provider settings."""
from __future__ import annotations

from pathlib import Path
import json
import re
from typing import Any
from urllib.parse import urlsplit

from config import settings


VALID_PROVIDER_IDS = {"ollama", "lmstudio", "openai_compatible"}
SAFE_PROVIDER_SETTING_FIELDS = (
    "active_provider",
    "active_model",
    "ollama_base_url",
    "ollama_model",
    "lmstudio_base_url",
    "lmstudio_model",
    "openai_compatible_base_url",
    "openai_compatible_model",
    "openai_compatible_api_key_env",
    "request_timeout_seconds",
)
PROVIDER_MODEL_FIELDS = {
    "ollama": "ollama_model",
    "lmstudio": "lmstudio_model",
    "openai_compatible": "openai_compatible_model",
}
FORBIDDEN_SECRET_FIELDS = {"api_key", "token", "password", "secret"}
ENV_VAR_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def get_provider_settings_path() -> Path:
    backend_root = Path(__file__).resolve().parents[1]
    configured_path = Path(settings.provider_settings_path)
    if configured_path.is_absolute():
        return configured_path
    return backend_root / configured_path


def get_default_provider_settings() -> dict[str, Any]:
    return {
        "active_provider": settings.active_provider,
        "active_model": settings.active_model,
        "ollama_base_url": settings.ollama_base_url,
        "ollama_model": settings.ollama_model,
        "lmstudio_base_url": settings.lmstudio_base_url,
        "lmstudio_model": settings.lmstudio_model,
        "openai_compatible_base_url": settings.openai_compatible_base_url,
        "openai_compatible_model": settings.openai_compatible_model,
        "openai_compatible_api_key_env": settings.openai_compatible_api_key_env,
        "request_timeout_seconds": settings.request_timeout_seconds,
    }


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _validate_url(name: str, value: Any) -> str:
    normalized = _normalize_text(value).rstrip("/")
    if not normalized:
        return ""
    parts = urlsplit(normalized)
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        raise ValueError(f"قيمة {name} يجب أن تكون رابط HTTP أو HTTPS صالحًا.")
    return normalized


def _validate_model(name: str, value: Any) -> str:
    normalized = _normalize_text(value)
    if len(normalized) > 200:
        raise ValueError(f"قيمة {name} طويلة جدًا.")
    if any(ord(char) < 32 for char in normalized):
        raise ValueError(f"قيمة {name} تحتوي على أحرف غير صالحة.")
    return normalized


def _validate_env_var_name(value: Any) -> str:
    normalized = _normalize_text(value)
    if not normalized:
        return "OPENAI_COMPATIBLE_API_KEY"
    if not ENV_VAR_PATTERN.match(normalized):
        raise ValueError("اسم متغير البيئة لمفتاح API غير صالح.")
    return normalized


def _validate_timeout(value: Any) -> int:
    try:
        normalized = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("مهلة الطلب يجب أن تكون رقمًا صحيحًا.") from exc
    if normalized < 1 or normalized > 300:
        raise ValueError("مهلة الطلب يجب أن تكون بين 1 و300 ثانية.")
    return normalized


def validate_provider_setting(key: str, value: Any) -> Any:
    if key == "active_provider":
        normalized = _normalize_text(value) or "ollama"
        if normalized not in VALID_PROVIDER_IDS:
            raise ValueError("معرّف المزود النشط غير صالح.")
        return normalized
    if key in {"active_model", "ollama_model", "lmstudio_model", "openai_compatible_model"}:
        return _validate_model(key, value)
    if key in {"ollama_base_url", "lmstudio_base_url", "openai_compatible_base_url"}:
        return _validate_url(key, value)
    if key == "openai_compatible_api_key_env":
        return _validate_env_var_name(value)
    if key == "request_timeout_seconds":
        return _validate_timeout(value)
    raise ValueError(f"الحقل {key} غير مدعوم.")


def load_provider_settings() -> dict[str, Any]:
    resolved = get_default_provider_settings()
    path = get_provider_settings_path()
    if not path.exists():
        return resolved

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return resolved

    if not isinstance(payload, dict):
        return resolved

    for key in SAFE_PROVIDER_SETTING_FIELDS:
        if key not in payload:
            continue
        try:
            resolved[key] = validate_provider_setting(key, payload[key])
        except ValueError:
            continue

    return resolved


def save_provider_settings(updates: dict[str, Any]) -> dict[str, Any]:
    current = load_provider_settings()
    for key, value in updates.items():
        if key not in SAFE_PROVIDER_SETTING_FIELDS:
            continue
        current[key] = validate_provider_setting(key, value)

    path = get_provider_settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = {key: current[key] for key in SAFE_PROVIDER_SETTING_FIELDS}
    path.write_text(json.dumps(serialized, ensure_ascii=False, indent=2), encoding="utf-8")
    return serialized


def get_effective_model(settings_payload: dict[str, Any], provider_id: str) -> str:
    if provider_id == settings_payload.get("active_provider") and settings_payload.get("active_model"):
        return settings_payload["active_model"]
    provider_model_field = PROVIDER_MODEL_FIELDS[provider_id]
    return settings_payload.get(provider_model_field, "")

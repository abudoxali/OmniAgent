"""Model providers endpoint."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

from core.provider_settings import (
    FORBIDDEN_SECRET_FIELDS,
    SAFE_PROVIDER_SETTING_FIELDS,
    load_provider_settings,
    save_provider_settings,
)
from model_router.router import get_provider_summaries, get_provider_diagnostics_payload, test_provider

router = APIRouter()


class ProviderTestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: str | None = None
    model: str | None = None
    test_prompt: str | None = Field(default=None, min_length=1, max_length=500)


class ProviderSettingsUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    active_provider: str | None = None
    active_model: str | None = None
    ollama_base_url: str | None = None
    ollama_model: str | None = None
    lmstudio_base_url: str | None = None
    lmstudio_model: str | None = None
    openai_compatible_base_url: str | None = None
    openai_compatible_model: str | None = None
    openai_compatible_api_key_env: str | None = None
    request_timeout_seconds: int | None = None

    @model_validator(mode="before")
    @classmethod
    def reject_secret_fields(cls, values):
        if not isinstance(values, dict):
            return values

        for key in values:
            lowered = str(key).lower()
            if lowered == "openai_compatible_api_key_env":
                continue
            if any(secret_key in lowered for secret_key in FORBIDDEN_SECRET_FIELDS):
                raise ValueError("لا يمكن حفظ مفاتيح أو رموز سرية داخل التطبيق. استخدم متغيرات البيئة فقط.")
        return values


@router.get("/models/settings")
async def get_model_settings():
    """Return safe persisted provider settings without secrets."""
    return load_provider_settings()


@router.get("/models/providers")
async def get_providers():
    """Return safe provider status and configuration summaries."""
    return await get_provider_summaries()


@router.get("/models/diagnostics")
async def get_diagnostics():
    """Return safe provider diagnostics checklist and recent history."""
    return await get_provider_diagnostics_payload()


@router.post("/models/settings")
async def save_model_settings(request: ProviderSettingsUpdateRequest):
    """Persist safe provider settings without storing any secrets."""
    updates = request.model_dump(exclude_unset=True)
    safe_updates = {key: value for key, value in updates.items() if key in SAFE_PROVIDER_SETTING_FIELDS}

    try:
        return save_provider_settings(safe_updates)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/models/test")
async def run_provider_test(request: ProviderTestRequest):
    """Run a safe provider-readiness prompt without desktop context."""
    return await test_provider(
        provider_name=request.provider,
        model_name=request.model,
        test_prompt=request.test_prompt,
    )

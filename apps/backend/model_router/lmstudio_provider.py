"""LM Studio provider using OpenAI-compatible endpoints."""
from __future__ import annotations

from .openai_compatible_provider import OpenAICompatibleProvider


class LMStudioProvider(OpenAICompatibleProvider):
    """Provider for local LM Studio servers."""

    def __init__(self, base_url: str, default_model: str, timeout_seconds: int) -> None:
        super().__init__(
            provider_id="lmstudio",
            label="LM Studio",
            base_url=base_url,
            default_model=default_model,
            timeout_seconds=timeout_seconds,
            api_key_env=None,
            require_api_key=False,
        )

    def _models_missing_warning(self) -> str:
        return "خادم LM Studio يعمل، لكن لا يوجد نموذج محمّل حاليًا."

    def _selected_model_missing_warning(self) -> str:
        return "النموذج المحدد في LM Studio لا يظهر ضمن النماذج المكتشفة من الخادم."

    def _unconfigured_warnings(self) -> list[str]:
        warnings: list[str] = []
        if not self.base_url:
            warnings.append("عنوان LM Studio غير مهيأ.")
        if not self.default_model:
            warnings.append("النموذج الافتراضي لـ LM Studio غير مهيأ.")
        return warnings or ["إعدادات LM Studio غير مكتملة."]

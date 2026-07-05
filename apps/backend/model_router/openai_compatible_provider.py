"""OpenAI-compatible provider implementation."""
from __future__ import annotations

import os
import time

import httpx

from .base import BaseProvider, normalize_model_identifiers


class OpenAICompatibleProvider(BaseProvider):
    """Provider for OpenAI-compatible chat completion APIs."""

    def __init__(
        self,
        provider_id: str,
        label: str,
        base_url: str,
        default_model: str,
        timeout_seconds: int,
        *,
        api_key_env: str | None = None,
        require_api_key: bool = True,
    ) -> None:
        super().__init__(provider_id, label, base_url, default_model, timeout_seconds)
        self.api_key_env = api_key_env
        self.require_api_key = require_api_key

    @property
    def api_key(self) -> str:
        if not self.api_key_env:
            return ""
        return os.getenv(self.api_key_env, "")

    @property
    def configured(self) -> bool:
        if not super().configured:
            return False
        if self.require_api_key and not self.api_key:
            return False
        return True

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _models_missing_warning(self) -> str:
        return f"مزود {self.label} متاح، لكن لم يتم اكتشاف نماذج قابلة للاستخدام."

    def _selected_model_missing_warning(self) -> str:
        return f"النموذج المحدد لمزود {self.label} غير موجود ضمن النماذج المكتشفة."

    def _unconfigured_warnings(self) -> list[str]:
        warnings: list[str] = []
        if not self.base_url:
            warnings.append(f"عنوان {self.label} غير مهيأ.")
        if not self.default_model:
            warnings.append(f"النموذج الافتراضي لمزود {self.label} غير مهيأ.")
        if self.require_api_key and not self.api_key:
            env_name = self.api_key_env or "OPENAI_COMPATIBLE_API_KEY"
            warnings.append(f"متغير البيئة {env_name} غير متاح لمزود {self.label}.")
        return warnings or [f"إعدادات مزود {self.label} غير مكتملة."]

    async def generate(self, prompt: str, model: str | None = None):
        selected_model = self.resolve_model(model)
        started_at = time.perf_counter()

        if not self.configured or not selected_model:
            warnings = self._unconfigured_warnings()
            return self._build_result(
                model=selected_model or "unconfigured",
                output_text="",
                status="unconfigured",
                warnings=warnings,
                started_at=started_at,
            )

        try:
            async with self._http_client() as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json={
                        "model": selected_model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.2,
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except Exception as exc:
            return self._build_result(
                model=selected_model,
                output_text="",
                status="timeout" if isinstance(exc, httpx.TimeoutException) else "error",
                warnings=self._error_warnings_for_exception(exc),
                raw_error=str(exc),
                started_at=started_at,
            )

        if not isinstance(payload, dict):
            return self._build_result(
                model=selected_model,
                output_text="",
                status="error",
                warnings=[self._malformed_response_warning()],
                raw_error="Malformed provider response.",
                started_at=started_at,
            )

        choices = payload.get("choices")
        if not isinstance(choices, list) or not choices:
            return self._build_result(
                model=selected_model,
                output_text="",
                status="error",
                warnings=[self._malformed_response_warning()],
                raw_error="Malformed provider response.",
                started_at=started_at,
            )

        first_choice = choices[0]
        if not isinstance(first_choice, dict):
            return self._build_result(
                model=selected_model,
                output_text="",
                status="error",
                warnings=[self._malformed_response_warning()],
                raw_error="Malformed provider response.",
                started_at=started_at,
            )

        message = first_choice.get("message")
        if not isinstance(message, dict) or not isinstance(message.get("content"), str):
            return self._build_result(
                model=selected_model,
                output_text="",
                status="error",
                warnings=[self._malformed_response_warning()],
                raw_error="Malformed provider response.",
                started_at=started_at,
            )

        content = message.get("content", "").strip()

        return self._build_result(
            model=selected_model,
            output_text=content,
            status="ok",
            warnings=[],
            started_at=started_at,
        )

    async def list_models(self) -> list[str]:
        if not self.base_url:
            return []
        if self.require_api_key and not self.api_key:
            return []
        try:
            async with self._http_client(timeout_seconds=min(self.timeout_seconds, 2)) as client:
                response = await client.get(f"{self.base_url}/models", headers=self._headers())
                response.raise_for_status()
                payload = response.json()
            discovered = normalize_model_identifiers([item.get("id", "") for item in payload.get("data", [])])
            if discovered:
                return discovered
            if self.default_model:
                return normalize_model_identifiers([self.default_model])
            return []
        except Exception:
            if self.default_model:
                return normalize_model_identifiers([self.default_model])
            return []

    async def health_check(self) -> dict:
        if not self.base_url:
            return {"health_status": "unconfigured", "warnings": self._unconfigured_warnings(), "models": []}

        if self.require_api_key and not self.api_key:
            return {
                "health_status": "unconfigured",
                "warnings": self._unconfigured_warnings(),
                "models": [],
            }

        try:
            async with self._http_client(timeout_seconds=min(self.timeout_seconds, 2)) as client:
                response = await client.get(f"{self.base_url}/models", headers=self._headers())
                response.raise_for_status()
                payload = response.json()
            models = normalize_model_identifiers([item.get("id", "") for item in payload.get("data", [])])
            if not models and self.default_model:
                models = normalize_model_identifiers([self.default_model])
            warnings: list[str] = []
            if not self.default_model:
                warnings.append(f"النموذج الافتراضي لمزود {self.label} غير مهيأ.")
            if not models:
                warnings.append(self._models_missing_warning())
            elif self.default_model and self.default_model not in models:
                warnings.append(self._selected_model_missing_warning())
            return {"health_status": "online", "warnings": warnings, "models": models}
        except Exception:
            return {
                "health_status": "offline",
                "warnings": [f"يتعذر الوصول إلى مزود {self.label} حاليًا."],
                "models": [],
            }

"""Ollama local model provider."""
from __future__ import annotations

import time

import httpx

from .base import BaseProvider, normalize_model_identifiers


class OllamaProvider(BaseProvider):
    """Provider for local Ollama models."""

    async def generate(self, prompt: str, model: str | None = None):
        selected_model = self.resolve_model(model)
        started_at = time.perf_counter()

        if not self.configured or not selected_model:
            return self._build_result(
                model=selected_model or "unconfigured",
                output_text="",
                status="unconfigured",
                warnings=["Ollama غير مهيأ بعنوان ونموذج صالحين."],
                started_at=started_at,
            )

        try:
            async with self._http_client() as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={"model": selected_model, "prompt": prompt, "stream": False},
                )
                response.raise_for_status()
                payload = response.json()
        except Exception as exc:
            status = "timeout" if isinstance(exc, httpx.TimeoutException) else "error"
            warnings = self._error_warnings_for_exception(exc)
            if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 404:
                status = "model_not_found"
                warnings = [
                    f"النموذج '{selected_model}' غير مثبت في Ollama. ثبّته يدويًا عبر: ollama pull {selected_model}"
                ]
            return self._build_result(
                model=selected_model,
                output_text="",
                status=status,
                warnings=warnings,
                raw_error=str(exc),
                started_at=started_at,
            )

        if not isinstance(payload, dict) or not isinstance(payload.get("response"), str):
            return self._build_result(
                model=selected_model,
                output_text="",
                status="error",
                warnings=[self._malformed_response_warning()],
                raw_error="Malformed provider response.",
                started_at=started_at,
            )

        return self._build_result(
            model=selected_model,
            output_text=(payload.get("response") or "").strip(),
            status="ok",
            warnings=[],
            started_at=started_at,
        )

    async def list_models(self) -> list[str]:
        if not self.base_url:
            return []
        try:
            async with self._http_client(timeout_seconds=min(self.timeout_seconds, 2)) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                payload = response.json()
            return normalize_model_identifiers([model.get("name", "") for model in payload.get("models", [])])
        except Exception:
            return []

    async def health_check(self) -> dict:
        if not self.base_url:
            return {"health_status": "unconfigured", "warnings": ["عنوان Ollama غير مهيأ."], "models": []}

        try:
            async with self._http_client(timeout_seconds=min(self.timeout_seconds, 2)) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                payload = response.json()
            models = normalize_model_identifiers([model.get("name", "") for model in payload.get("models", [])])
            warnings: list[str] = []
            if not self.default_model:
                warnings.append("خادم Ollama متاح، لكن النموذج الافتراضي غير مهيأ بعد.")
            if not models:
                warnings.append("خادم Ollama يعمل، لكن لا توجد نماذج محلية مثبتة حاليًا.")
            elif self.default_model and self.default_model not in models:
                warnings.append("النموذج المحدد لـ Ollama غير موجود ضمن النماذج المحلية المكتشفة.")
            return {"health_status": "online", "warnings": warnings, "models": models}
        except Exception:
            return {
                "health_status": "offline",
                "warnings": ["يتعذر الوصول إلى خادم Ollama المحلي حاليًا."],
                "models": [],
            }

    def _connection_warning(self) -> str:
        return "تعذر الاتصال بمزود Ollama."

    def _timeout_warning(self) -> str:
        return "انتهت مهلة الطلب عند الاتصال بخادم Ollama المحلي."

    def _malformed_response_warning(self) -> str:
        return "أرجع خادم Ollama استجابة غير صالحة."

"""Base utilities and abstractions for AI model providers."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
import re
import time
from urllib.parse import urlsplit, urlunsplit

import httpx


_SECRET_PATTERNS = [
    re.compile(r"(?i)\b(api[_-]?key|token|password|secret)\b\s*[:=]\s*([^\s,;]+)"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{12,}\b"),
    re.compile(r"\bghp_[A-Za-z0-9]{20,}\b"),
    re.compile(r"Bearer\s+[A-Za-z0-9._-]+", re.IGNORECASE),
]


def sanitize_error_message(message: str) -> str:
    sanitized = message or "Unknown provider error."
    sanitized = _SECRET_PATTERNS[0].sub(lambda match: f"{match.group(1)}=[REDACTED]", sanitized)
    for pattern in _SECRET_PATTERNS[1:]:
        sanitized = pattern.sub("[REDACTED]", sanitized)
    return sanitized[:500]


def sanitize_base_url(url: str) -> str:
    if not url:
        return ""

    parts = urlsplit(url)
    netloc = parts.netloc.split("@")[-1]
    return urlunsplit((parts.scheme, netloc, parts.path, "", ""))


def normalize_model_identifiers(values: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        item = (value or "").strip()
        if not item or item in seen:
            continue
        seen.add(item)
        normalized.append(item)
    return normalized


@dataclass
class ProviderResult:
    provider: str
    model: str
    output_text: str
    latency_ms: int
    status: str
    warnings: list[str] = field(default_factory=list)
    raw_error: str | None = None

    def to_dict(self) -> dict:
        preview = (self.output_text or "").strip()
        payload = {
            "provider": self.provider,
            "model": self.model,
            "output_text": self.output_text,
            "output_preview": preview[:500],
            "latency_ms": self.latency_ms,
            "status": self.status,
            "warnings": self.warnings,
        }
        if self.raw_error:
            payload["raw_error"] = self.raw_error
            payload["safe_error_message"] = self.raw_error
        return payload


class BaseProvider(ABC):
    """Abstract base class for text-generation providers."""

    def __init__(self, provider_id: str, label: str, base_url: str, default_model: str, timeout_seconds: int) -> None:
        self.provider_id = provider_id
        self.label = label
        self.base_url = base_url.rstrip("/")
        self.default_model = default_model
        self.timeout_seconds = timeout_seconds

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.default_model)

    def resolve_model(self, override_model: str | None = None) -> str:
        return (override_model or self.default_model or "").strip()

    def _connection_warning(self) -> str:
        return f"تعذر الاتصال بمزود {self.label}."

    def _timeout_warning(self) -> str:
        return f"انتهت مهلة الطلب عند الاتصال بمزود {self.label}."

    def _http_status_warning(self) -> str:
        return f"أعاد مزود {self.label} استجابة HTTP غير متوقعة."

    def _malformed_response_warning(self) -> str:
        return f"أرجع مزود {self.label} استجابة غير صالحة."

    def _error_warnings_for_exception(self, exc: Exception) -> list[str]:
        if isinstance(exc, httpx.TimeoutException):
            return [self._timeout_warning()]
        if isinstance(exc, httpx.HTTPStatusError):
            return [self._http_status_warning()]
        return [self._connection_warning()]

    def _build_result(
        self,
        *,
        model: str,
        output_text: str,
        status: str,
        warnings: list[str] | None = None,
        raw_error: str | None = None,
        started_at: float | None = None,
    ) -> ProviderResult:
        latency_ms = int((time.perf_counter() - started_at) * 1000) if started_at is not None else 0
        return ProviderResult(
            provider=self.provider_id,
            model=model,
            output_text=output_text,
            latency_ms=latency_ms,
            status=status,
            warnings=warnings or [],
            raw_error=sanitize_error_message(raw_error) if raw_error else None,
        )

    def _http_client(self, timeout_seconds: float | None = None) -> httpx.AsyncClient:
        timeout = timeout_seconds if timeout_seconds is not None else self.timeout_seconds
        return httpx.AsyncClient(timeout=timeout)

    @abstractmethod
    async def generate(self, prompt: str, model: str | None = None) -> ProviderResult:
        """Generate a response from the provider."""

    @abstractmethod
    async def list_models(self) -> list[str]:
        """Return available model identifiers."""

    @abstractmethod
    async def health_check(self) -> dict:
        """Return a quick health summary for the provider."""

"""Optional screenshot capture metadata for safe local context collection."""
from __future__ import annotations

from datetime import datetime, timezone
import os
import tempfile
import uuid

from config import settings

try:
    from PIL import ImageGrab
except Exception:  # pragma: no cover - import availability varies by environment
    ImageGrab = None


def _base_result(status: str, warning: str | None = None) -> dict:
    warnings = [warning] if warning else []
    return {
        "width": 0,
        "height": 0,
        "format": settings.screenshot_format,
        "captured_at": None,
        "capture_status": status,
        "warnings": warnings,
        "preview_available": False,
        "temp_path": None,
    }


def capture_screenshot_metadata() -> dict:
    """Capture screenshot metadata without exposing raw image bytes in API responses."""
    if not settings.screenshot_capture_enabled:
        return _base_result("disabled", "التقاط لقطة الشاشة معطل في الإعدادات.")

    if ImageGrab is None:
        return _base_result("unavailable", "التقاط لقطة الشاشة يتطلب دعم Pillow ImageGrab.")

    try:
        image = ImageGrab.grab()
        width, height = image.size
        captured_at = datetime.now(timezone.utc).isoformat()
        temp_path = None

        if settings.screenshot_save_temp:
            suffix = f".{settings.screenshot_format.lower()}"
            temp_path = os.path.join(
                tempfile.gettempdir(),
                f"abud-omniagent-{uuid.uuid4().hex}{suffix}",
            )
            image.save(temp_path, format=settings.screenshot_format.upper())

        return {
            "width": width,
            "height": height,
            "format": settings.screenshot_format,
            "captured_at": captured_at,
            "capture_status": "captured",
            "warnings": [],
            "preview_available": bool(settings.screenshot_preview_enabled),
            "temp_path": temp_path,
        }
    except Exception as exc:  # pragma: no cover - exercised via tests with monkeypatch
        return _base_result("failed", f"Screenshot capture failed: {exc}")

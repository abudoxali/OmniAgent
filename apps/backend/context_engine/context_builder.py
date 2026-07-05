"""Build a safe unified context payload from local Windows signals."""
from __future__ import annotations

from datetime import datetime, timezone
import re

from config import settings
from context_engine.active_window import get_active_window
from context_engine.clipboard import ClipboardSnapshot, get_clipboard_snapshot
from context_engine.screenshot import capture_screenshot_metadata
from context_engine.selected_text import get_selected_text


def _truncate_preview(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars]}..."


_SECRET_PATTERNS = [
    re.compile(r"(?i)\b(api[_-]?key|token|password|secret)\b\s*[:=]\s*([^\s,;]+)"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{12,}\b"),
    re.compile(r"\bghp_[A-Za-z0-9]{20,}\b"),
]


def _redact_secrets(text: str) -> str:
    redacted = text
    redacted = _SECRET_PATTERNS[0].sub(lambda match: f"{match.group(1)}=[REDACTED]", redacted)
    for pattern in _SECRET_PATTERNS[1:]:
        redacted = pattern.sub("[REDACTED]", redacted)
    return redacted


def _normalize_clipboard_snapshot() -> ClipboardSnapshot:
    if not settings.clipboard_capture_enabled:
        return ClipboardSnapshot(
            text="",
            has_text=False,
            format_count=0,
            capture_status="disabled",
            warnings=["Clipboard capture is disabled in config."],
        )

    return get_clipboard_snapshot()


def _normalize_active_window() -> dict:
    if not settings.active_window_capture_enabled:
        return {
            "title": "",
            "process_name": "disabled",
            "process_id": 0,
            "class_name": "",
            "capture_status": "disabled",
            "warnings": ["Active window capture is disabled in config."],
        }

    return get_active_window()


def _normalize_screenshot() -> dict:
    return capture_screenshot_metadata()


def build_context() -> dict:
    """Aggregate all context sources into a single context object."""
    warnings: list[str] = []

    try:
        active_window = _normalize_active_window()
    except Exception as exc:
        active_window = {
            "title": "",
            "process_name": "unknown",
            "process_id": 0,
            "class_name": "",
            "capture_status": "unavailable",
            "warnings": [],
        }
        warnings.append(f"Active window capture failed: {exc}")

    try:
        clipboard_snapshot = _normalize_clipboard_snapshot()
    except Exception as exc:
        clipboard_snapshot = ClipboardSnapshot(
            text="",
            has_text=False,
            format_count=0,
            capture_status="unavailable",
            warnings=[],
        )
        warnings.append(f"Clipboard capture failed: {exc}")

    try:
        selected_text = get_selected_text()
    except Exception as exc:
        selected_text = {
            "text": "",
            "available": False,
            "capture_status": "unavailable",
            "warnings": [],
        }
        warnings.append(f"Selected text capture failed: {exc}")

    try:
        screenshot = _normalize_screenshot()
    except Exception as exc:
        screenshot = {
            "width": 0,
            "height": 0,
            "format": settings.screenshot_format,
            "captured_at": None,
            "capture_status": "failed",
            "warnings": [],
            "preview_available": False,
            "temp_path": None,
        }
        warnings.append(f"Screenshot capture failed: {exc}")

    warnings.extend(active_window.get("warnings", []))
    warnings.extend(clipboard_snapshot.warnings)
    warnings.extend(selected_text.get("warnings", []))
    warnings.extend(screenshot.get("warnings", []))

    clipboard_text = _redact_secrets(clipboard_snapshot.text or "")
    selected_text_value = _redact_secrets(selected_text.get("text", "") or "")
    clipboard_preview = _truncate_preview(clipboard_text, settings.context_preview_max_chars)
    selected_preview = _truncate_preview(selected_text_value, settings.selected_text_preview_max_chars)

    return {
        "active_window": {
            "title": active_window.get("title", ""),
            "process_name": active_window.get("process_name", "unknown"),
            "process_id": active_window.get("process_id", 0),
            "class_name": active_window.get("class_name", ""),
        },
        "clipboard": {
            "text": clipboard_preview,
            "has_text": clipboard_snapshot.has_text,
            "length": len(clipboard_text),
            "capture_status": clipboard_snapshot.capture_status,
        },
        "selected_text": {
            "text": selected_preview,
            "available": bool(selected_text.get("available", False)),
            "length": len(selected_text_value),
            "capture_status": selected_text.get("capture_status", "unknown"),
        },
        "screenshot": {
            "width": screenshot.get("width", 0),
            "height": screenshot.get("height", 0),
            "format": screenshot.get("format", settings.screenshot_format),
            "captured_at": screenshot.get("captured_at"),
            "capture_status": screenshot.get("capture_status", "unknown"),
            "preview_available": bool(screenshot.get("preview_available", False)),
        },
        "active_window_title": active_window.get("title", ""),
        "active_process_name": active_window.get("process_name", "unknown"),
        "active_process_id": active_window.get("process_id", 0),
        "clipboard_text_preview": clipboard_preview,
        "clipboard_text_length": len(clipboard_text),
        "selected_text_preview": selected_preview,
        "selected_text_length": len(selected_text_value),
        "capture_status": {
            "active_window": active_window.get("capture_status", "unknown"),
            "clipboard": clipboard_snapshot.capture_status,
            "selected_text": selected_text.get("capture_status", "unknown"),
            "screenshot": screenshot.get("capture_status", "unknown"),
        },
        "warnings": warnings,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

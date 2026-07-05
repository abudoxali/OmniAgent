"""Safety validation and preview generation for Phase 2A actions."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from config import settings


RISK_LEVELS: dict[str, str] = {
    "copy_to_clipboard": "low",
    "paste_text_approved": "medium",
    "paste_preview_only": "low",
}

REQUIRES_CONFIRMATION: dict[str, bool] = {
    "copy_to_clipboard": False,
    "paste_text_approved": True,
    "paste_preview_only": False,
}


def _is_blocked_action_type(action_type: str) -> tuple[bool, str]:
    """Return (blocked, reason) if action_type contains forbidden keywords."""
    lowered = action_type.lower()
    for keyword in settings.blocked_action_keywords:
        if keyword in lowered:
            return True, f"نوع الإجراء {action_type} غير مسموح في المرحلة 2A."
    return False, ""


def _is_allowed_action_type(action_type: str) -> bool:
    return action_type in settings.allowed_action_types


def _redact_secrets(text: str) -> str:
    """Redact obvious secret-like patterns from text."""
    redacted = text
    for pattern in settings.secret_redaction_patterns:
        redacted = re.sub(pattern, "***REDACTED***", redacted)
    return redacted


def _truncate_preview(text: str) -> str:
    limit = settings.paste_preview_max_chars
    preview = text[:limit]
    if len(text) > limit:
        preview += "…"
    return preview


def _arabic_summary(action_type: str, length: int) -> str:
    if action_type == "copy_to_clipboard":
        return f"نسخ {length} حرف إلى الحافظة."
    if action_type == "paste_text_approved":
        return f"لصق {length} حرف في الحقل النشط بعد الموافقة."
    if action_type == "paste_preview_only":
        return f"معاينة {length} حرف قبل اللصق."
    return f"إجراء {action_type} (طول النص: {length})."


def validate_action(action_type: str, text: str) -> dict[str, Any]:
    """Return safety metadata for an action."""
    result = {
        "allowed": False,
        "risk_level": "unknown",
        "requires_confirmation": True,
        "warnings": [],
        "reason": "",
    }

    if not text:
        result["reason"] = "النص فارغ."
        result["warnings"].append("لا يمكن تنفيذ إجراء على نص فارغ.")
        return result

    blocked, reason = _is_blocked_action_type(action_type)
    if blocked:
        result["reason"] = reason
        result["warnings"].append(reason)
        return result

    if not _is_allowed_action_type(action_type):
        result["reason"] = f"نوع الإجراء {action_type} غير مسموح في المرحلة 2A."
        result["warnings"].append(result["reason"])
        return result

    result["allowed"] = True
    result["risk_level"] = RISK_LEVELS.get(action_type, "unknown")
    result["requires_confirmation"] = REQUIRES_CONFIRMATION.get(action_type, True)
    return result


def _truncate_target_value(value: str | None, max_length: int) -> str | None:
    if value is None:
        return None
    if len(value) <= max_length:
        return value
    return f"{value[:max_length]}…"


def build_action_preview(
    action_type: str,
    text: str,
    target_hint: str | None = None,
    target_window_title: str | None = None,
    target_process_name: str | None = None,
    target_captured_at: str | None = None,
) -> dict[str, Any]:
    """Create a preview object for an action without executing it."""
    validation = validate_action(action_type, text)
    action_id = str(uuid.uuid4())
    safe_text = _redact_secrets(text)
    preview = _truncate_preview(safe_text)

    return {
        "action_id": action_id,
        "action_type": action_type,
        "risk_level": validation["risk_level"],
        "requires_confirmation": validation["requires_confirmation"],
        "allowed": validation["allowed"],
        "user_visible_summary_ar": _arabic_summary(action_type, len(text)),
        "payload_preview": preview,
        "payload_length": len(text),
        "text": text,
        "target_hint": _truncate_target_value(target_hint, 200),
        "target_window_title": _truncate_target_value(target_window_title, 200),
        "target_process_name": _truncate_target_value(target_process_name, 100),
        "target_captured_at": _truncate_target_value(target_captured_at, 50),
        "warnings": validation["warnings"],
        "reason": validation["reason"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def new_preview_object(
    action_type: str,
    text: str,
    target_hint: str | None = None,
    target_window_title: str | None = None,
    target_process_name: str | None = None,
    target_captured_at: str | None = None,
) -> dict[str, Any]:
    """Public alias for build_action_preview."""
    return build_action_preview(
        action_type,
        text,
        target_hint,
        target_window_title,
        target_process_name,
        target_captured_at,
    )

"""Phase 2A action execution endpoints.

Only three action types are allowed:
- copy_to_clipboard
- paste_text_approved
- paste_preview_only

Paste actions always require explicit user confirmation. No arbitrary automation,
no destructive actions, and no secret exposure are permitted.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel, Field

from actions.executor import get_executor
from actions.safety import build_action_preview, validate_action
from actions.store import (
    get_pending_action,
    get_recent_action_logs,
    log_action,
    remove_pending_action,
    store_pending_action,
)
from config import settings

router = APIRouter()


class PreviewRequest(BaseModel):
    action_type: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)
    target_hint: str | None = Field(default=None)
    target_window_title: str | None = Field(default=None)
    target_process_name: str | None = Field(default=None)
    target_captured_at: str | None = Field(default=None)


class ConfirmRequest(BaseModel):
    action_id: str = Field(..., min_length=1)
    confirm: bool = Field(default=False)


class LegacyCopyRequest(BaseModel):
    text: str = Field(..., min_length=1)


class LegacyPastePreviewRequest(BaseModel):
    text: str = Field(..., min_length=1)


def _normalize_result(
    action_type: str,
    status: str,
    executed: bool,
    warnings: list[str],
    safe_message: str,
) -> dict:
    return {
        "status": status,
        "action_type": action_type,
        "executed": executed,
        "warnings": warnings,
        "safe_message": safe_message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/actions/preview")
async def preview_action(request: PreviewRequest):
    """Create a safe action preview without executing anything."""
    preview = build_action_preview(
        action_type=request.action_type,
        text=request.text,
        target_hint=request.target_hint,
        target_window_title=request.target_window_title,
        target_process_name=request.target_process_name,
        target_captured_at=request.target_captured_at,
    )

    if preview["allowed"]:
        store_pending_action(preview["action_id"], preview)

    return {
        "action_id": preview["action_id"],
        "action_type": preview["action_type"],
        "risk_level": preview["risk_level"],
        "requires_confirmation": preview["requires_confirmation"],
        "user_visible_summary_ar": preview["user_visible_summary_ar"],
        "payload_preview": preview["payload_preview"],
        "payload_length": preview["payload_length"],
        "target_hint": preview["target_hint"],
        "target_window_title": preview["target_window_title"],
        "target_process_name": preview["target_process_name"],
        "target_captured_at": preview["target_captured_at"],
        "warnings": preview["warnings"],
        "allowed": preview["allowed"],
    }


@router.post("/actions/confirm")
async def confirm_action(request: ConfirmRequest):
    """Confirm or cancel a previously previewed action."""
    action = get_pending_action(request.action_id)
    if action is None:
        return _normalize_result(
            action_type="unknown",
            status="not_found",
            executed=False,
            warnings=["لم يتم العثور على الإجراء المطلوب أو انتهت صلاحيته."],
            safe_message="تعذر تأكيد الإجراء، المعاينة غير موجودة.",
        )

    action_type = action["action_type"]
    text = action.get("text", "")
    target_hint = action.get("target_hint")
    target_window_title = action.get("target_window_title")
    target_process_name = action.get("target_process_name")
    target_captured_at = action.get("target_captured_at")
    risk_level = action.get("risk_level", "unknown")
    warnings = []

    if not request.confirm:
        remove_pending_action(request.action_id)
        await log_action(
            action_type=action_type,
            risk_level=risk_level,
            status="canceled",
            payload_length=len(text),
            target_hint=target_hint,
            target_window_title=target_window_title,
            target_process_name=target_process_name,
            target_captured_at=target_captured_at,
            warnings=warnings,
            approved=False,
        )
        return _normalize_result(
            action_type=action_type,
            status="canceled",
            executed=False,
            warnings=warnings,
            safe_message="تم الإلغاء.",
        )

    validation = validate_action(action_type, text)
    if not validation["allowed"]:
        remove_pending_action(request.action_id)
        return _normalize_result(
            action_type=action_type,
            status="rejected",
            executed=False,
            warnings=validation["warnings"],
            safe_message="تم رفض الإجراء لأسباب أمان.",
        )

    executor = get_executor()
    if action_type == "copy_to_clipboard":
        outcome = executor.copy_text(text)
    elif action_type == "paste_text_approved":
        outcome = executor.paste_text(text)
    else:
        outcome = {"executed": False, "status": "error", "warnings": ["نوع الإجراء غير معروف."], "safe_message": "نوع الإجراء غير معروف."}

    remove_pending_action(request.action_id)
    warnings.extend(outcome.get("warnings", []))
    await log_action(
        action_type=action_type,
        risk_level=risk_level,
        status="ok" if outcome.get("executed") else outcome.get("status", "error"),
        payload_length=len(text),
        target_hint=target_hint,
        target_window_title=target_window_title,
        target_process_name=target_process_name,
        target_captured_at=target_captured_at,
        warnings=warnings,
        payload_preview=action.get("payload_preview"),
        approved=True,
    )

    return _normalize_result(
        action_type=action_type,
        status="ok" if outcome.get("executed") else outcome.get("status", "error"),
        executed=outcome.get("executed", False),
        warnings=warnings,
        safe_message=outcome.get("safe_message", "تم تنفيذ الإجراء."),
    )


@router.post("/actions/copy")
async def copy_action(request: LegacyCopyRequest):
    """Copy text to the clipboard after creating a safety preview.

    This is a low-risk action and is executed immediately when the user clicks
    the copy button.
    """
    preview = build_action_preview(action_type="copy_to_clipboard", text=request.text)
    if not preview["allowed"]:
        return _normalize_result(
            action_type="copy_to_clipboard",
            status="rejected",
            executed=False,
            warnings=preview["warnings"],
            safe_message="تم رفض نسخ النص.",
        )

    outcome = get_executor().copy_text(request.text)
    await log_action(
        action_type="copy_to_clipboard",
        risk_level="low",
        status="ok" if outcome.get("executed") else outcome.get("status", "error"),
        payload_length=len(request.text),
        warnings=outcome.get("warnings", []),
        payload_preview=preview["payload_preview"],
        approved=True,
    )

    return _normalize_result(
        action_type="copy_to_clipboard",
        status="ok" if outcome.get("executed") else outcome.get("status", "error"),
        executed=outcome.get("executed", False),
        warnings=outcome.get("warnings", []),
        safe_message=outcome.get("safe_message", "تم النسخ إلى الحافظة."),
    )


@router.post("/actions/paste-preview")
async def paste_preview_action(request: LegacyPastePreviewRequest):
    """Return a safe paste preview without executing the paste."""
    preview = build_action_preview(
        action_type="paste_preview_only",
        text=request.text,
    )
    return {
        "action_id": preview["action_id"],
        "action_type": "paste_preview_only",
        "risk_level": "low",
        "requires_confirmation": False,
        "user_visible_summary_ar": preview["user_visible_summary_ar"],
        "payload_preview": preview["payload_preview"],
        "payload_length": preview["payload_length"],
        "warnings": preview["warnings"],
        "safe_message": "هذه معاينة لصق فقط. لن يتم اللصق تلقائيًا.",
    }


@router.get("/actions/logs")
async def get_action_logs(limit: int = 50):
    """Return recent action log entries without full payload content."""
    logs = await get_recent_action_logs(limit=limit)
    return {"logs": logs, "content_logging_enabled": settings.action_log_content_enabled}

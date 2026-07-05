"""In-memory pending action store and safe action logging."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import aiosqlite

from config import settings
from storage.db import DB_PATH


# Pending actions keyed by action_id. These are short-lived previews created by
# POST /actions/preview and resolved by POST /actions/confirm.
_pending_actions: dict[str, dict[str, Any]] = {}


def store_pending_action(action_id: str, action: dict[str, Any]) -> None:
    """Store a preview action so it can be confirmed or cancelled later."""
    _pending_actions[action_id] = action


def get_pending_action(action_id: str) -> dict[str, Any] | None:
    """Retrieve a pending preview action."""
    return _pending_actions.get(action_id)


def remove_pending_action(action_id: str) -> bool:
    """Remove a pending action. Returns True if it existed."""
    return _pending_actions.pop(action_id, None) is not None


async def log_action(
    action_type: str,
    risk_level: str,
    status: str,
    payload_length: int,
    target_hint: str | None = None,
    target_window_title: str | None = None,
    target_process_name: str | None = None,
    target_captured_at: str | None = None,
    warnings: list[str] | None = None,
    payload_preview: str | None = None,
    approved: bool = False,
) -> None:
    """Write a safe action log entry to the database.

    Full payload text is never logged unless explicitly enabled.
    """
    details = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action_type": action_type,
        "status": status,
        "risk_level": risk_level,
        "payload_length": payload_length,
        "target_hint": target_hint,
        "target_window_title": target_window_title,
        "target_process_name": target_process_name,
        "target_captured_at": target_captured_at,
        "warnings": warnings or [],
    }
    if settings.action_log_content_enabled and payload_preview:
        details["payload_preview"] = payload_preview

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO action_log (timestamp, action_type, risk_level, approved, details) VALUES (?, ?, ?, ?, ?)",
            (
                details["timestamp"],
                action_type,
                risk_level,
                1 if approved else 0,
                json.dumps(details, ensure_ascii=False),
            ),
        )
        await db.commit()


async def get_recent_action_logs(limit: int = 50) -> list[dict[str, Any]]:
    """Return recent action log entries without full payload content."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT id, timestamp, action_type, risk_level, approved, details FROM action_log ORDER BY timestamp DESC LIMIT ?",
            (limit,),
        )
        rows = await cursor.fetchall()

    logs = []
    for row in rows:
        details = json.loads(row["details"] or "{}")
        # Always strip full payload previews if content logging is disabled.
        if not settings.action_log_content_enabled:
            details.pop("payload_preview", None)
        logs.append(
            {
                "id": row["id"],
                "timestamp": row["timestamp"],
                "action_type": row["action_type"],
                "risk_level": row["risk_level"],
                "approved": bool(row["approved"]),
                "status": details.get("status", "unknown"),
                "payload_length": details.get("payload_length", 0),
                "target_hint": details.get("target_hint"),
                "target_window_title": details.get("target_window_title"),
                "target_process_name": details.get("target_process_name"),
                "target_captured_at": details.get("target_captured_at"),
                "warnings": details.get("warnings", []),
            }
        )
    return logs

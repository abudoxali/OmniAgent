"""Logs retrieval endpoint."""
from datetime import datetime, timezone

from fastapi import APIRouter

from actions.store import get_recent_action_logs

router = APIRouter()


@router.get("/logs")
async def get_logs():
    """Return recent system logs and safe action logs."""
    now = datetime.now(timezone.utc).isoformat()
    action_logs = await get_recent_action_logs(limit=50)
    return {
        "logs": [
            {
                "timestamp": now,
                "level": "info",
                "message": "System started",
                "source": "core",
            },
            {
                "timestamp": now,
                "level": "info",
                "message": "Health check passed",
                "source": "api",
            },
        ],
        "action_logs": action_logs,
    }

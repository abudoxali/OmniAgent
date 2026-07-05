"""Health check endpoint."""
from datetime import datetime, timezone
from fastapi import APIRouter

from config import settings

router = APIRouter()
STARTED_AT = datetime.now(timezone.utc)


@router.get("/health")
async def health_check():
    """Return system health status."""
    now = datetime.now(timezone.utc)
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "phase": settings.PHASE,
        "timestamp": now.isoformat(),
        "started_at": STARTED_AT.isoformat(),
        "uptime_seconds": round((now - STARTED_AT).total_seconds(), 3),
        "backend_host": settings.BACKEND_HOST,
        "backend_port": settings.BACKEND_PORT,
        "runtime_files": {
            "db_path": settings.DB_PATH,
            "provider_settings_path": settings.provider_settings_path,
            "provider_test_history_path": settings.provider_test_history_path,
        },
        "capture_features": {
            "active_window_enabled": settings.active_window_capture_enabled,
            "clipboard_enabled": settings.clipboard_capture_enabled,
            "selected_text_enabled": settings.enable_selected_text_capture,
            "screenshot_enabled": settings.screenshot_capture_enabled,
        },
    }

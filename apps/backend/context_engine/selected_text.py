"""Optional selected text capture using clipboard-preserving Ctrl+C."""
from __future__ import annotations

import ctypes
import os
import sys
import time
from typing import Callable

from config import settings
from context_engine.active_window import get_active_window
from context_engine.clipboard import ClipboardSnapshot, clear_clipboard, get_clipboard_snapshot, set_clipboard_text

VK_CONTROL = 0x11
VK_C = 0x43
KEYEVENTF_KEYUP = 0x0002
POLL_INTERVAL_SECONDS = 0.05


def _disabled_result(reason: str) -> dict:
    return {
        "text": "",
        "available": False,
        "capture_status": "disabled",
        "warnings": [reason],
    }


def _send_ctrl_c() -> None:
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    user32.keybd_event(VK_CONTROL, 0, 0, 0)
    user32.keybd_event(VK_C, 0, 0, 0)
    user32.keybd_event(VK_C, 0, KEYEVENTF_KEYUP, 0)
    user32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)


def _restore_clipboard_snapshot(snapshot: ClipboardSnapshot) -> tuple[bool, str | None]:
    if not settings.selected_text_restore_clipboard:
        return True, None

    if not snapshot.restore_supported:
        return False, "Original clipboard state could not be safely restored."

    if snapshot.has_text:
        if set_clipboard_text(snapshot.text):
            return True, None
        return False, "Failed to restore original clipboard text."

    if snapshot.format_count == 0:
        if clear_clipboard():
            return True, None
        return False, "Failed to restore empty clipboard state."

    return False, "Original clipboard state could not be safely restored."


def _wait_for_copied_text(timeout_ms: int, reader: Callable[[], ClipboardSnapshot]) -> ClipboardSnapshot:
    deadline = time.monotonic() + (timeout_ms / 1000)
    latest_snapshot = ClipboardSnapshot(
        text="",
        has_text=False,
        format_count=0,
        capture_status="empty",
        warnings=["Selected text capture timed out before clipboard text became available."],
    )

    while time.monotonic() <= deadline:
        latest_snapshot = reader()
        if latest_snapshot.has_text:
            return latest_snapshot
        time.sleep(POLL_INTERVAL_SECONDS)

    return ClipboardSnapshot(
        text="",
        has_text=False,
        format_count=latest_snapshot.format_count,
        capture_status="timeout",
        warnings=["Selected text capture timed out before clipboard text became available."],
    )


def get_selected_text() -> dict:
    """Capture selected text without permanently overwriting the clipboard."""
    if not settings.enable_selected_text_capture:
        return _disabled_result("التقاط النص المحدد معطل في الإعدادات.")

    if os.name != "nt" or sys.platform != "win32":
        return _disabled_result("التقاط النص المحدد مدعوم على Windows فقط.")

    original_clipboard = get_clipboard_snapshot()
    warnings = list(original_clipboard.warnings)

    if settings.selected_text_restore_clipboard and not original_clipboard.restore_supported:
        warnings.append(
            "تم تخطي التقاط النص المحدد لأن محتوى الحافظة الحالي لا يمكن استعادته بأمان."
        )
        return {
            "text": "",
            "available": False,
            "capture_status": "skipped",
            "warnings": warnings,
        }

    initial_window = get_active_window()
    result = {
        "text": "",
        "available": False,
        "capture_status": "failed",
        "warnings": warnings,
    }

    try:
        if not clear_clipboard():
            raise RuntimeError("Clipboard could not be cleared before capture.")

        _send_ctrl_c()
        captured_clipboard = _wait_for_copied_text(
            settings.selected_text_capture_timeout_ms,
            get_clipboard_snapshot,
        )

        current_window = get_active_window()
        if (
            initial_window.get("process_id")
            and current_window.get("process_id")
            and initial_window.get("process_id") != current_window.get("process_id")
        ):
            warnings.append("تغير التركيز أثناء التقاط النص المحدد، وقد تكون النتيجة غير دقيقة.")

        if not captured_clipboard.has_text:
            warnings.extend(captured_clipboard.warnings)
            result["capture_status"] = captured_clipboard.capture_status or "empty"
            return result

        result["text"] = captured_clipboard.text
        result["available"] = True
        result["capture_status"] = "captured"
        return result
    except Exception as exc:  # pragma: no cover - exercised via tests with monkeypatch
        warnings.append(f"Selected text capture failed: {exc}")
        result["capture_status"] = "failed"
        return result
    finally:
        restored, restore_warning = _restore_clipboard_snapshot(original_clipboard)
        if not restored and restore_warning:
            warnings.append(restore_warning)

"""Safe clipboard access helpers for Windows text capture."""
from __future__ import annotations

import ctypes
import os
import sys
import time
from ctypes import wintypes
from dataclasses import dataclass, field

CF_UNICODETEXT = 13
GMEM_MOVEABLE = 0x0002
CLIPBOARD_RETRY_COUNT = 5
CLIPBOARD_RETRY_DELAY_SECONDS = 0.02


@dataclass
class ClipboardSnapshot:
    text: str = ""
    has_text: bool = False
    format_count: int = 0
    capture_status: str = "empty"
    warnings: list[str] = field(default_factory=list)

    @property
    def restore_supported(self) -> bool:
        return self.has_text or self.format_count == 0


def _load_windows_apis() -> tuple[ctypes.WinDLL, ctypes.WinDLL]:
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

    user32.OpenClipboard.argtypes = [wintypes.HWND]
    user32.OpenClipboard.restype = wintypes.BOOL
    user32.CloseClipboard.argtypes = []
    user32.CloseClipboard.restype = wintypes.BOOL
    user32.GetClipboardData.argtypes = [wintypes.UINT]
    user32.GetClipboardData.restype = wintypes.HANDLE
    user32.IsClipboardFormatAvailable.argtypes = [wintypes.UINT]
    user32.IsClipboardFormatAvailable.restype = wintypes.BOOL
    user32.CountClipboardFormats.argtypes = []
    user32.CountClipboardFormats.restype = ctypes.c_int
    user32.EmptyClipboard.argtypes = []
    user32.EmptyClipboard.restype = wintypes.BOOL
    user32.SetClipboardData.argtypes = [wintypes.UINT, wintypes.HANDLE]
    user32.SetClipboardData.restype = wintypes.HANDLE

    kernel32.GlobalLock.argtypes = [wintypes.HGLOBAL]
    kernel32.GlobalLock.restype = wintypes.LPVOID
    kernel32.GlobalUnlock.argtypes = [wintypes.HGLOBAL]
    kernel32.GlobalUnlock.restype = wintypes.BOOL
    kernel32.GlobalAlloc.argtypes = [wintypes.UINT, ctypes.c_size_t]
    kernel32.GlobalAlloc.restype = wintypes.HGLOBAL
    kernel32.GlobalFree.argtypes = [wintypes.HGLOBAL]
    kernel32.GlobalFree.restype = wintypes.HGLOBAL

    return user32, kernel32


def _open_clipboard(user32: ctypes.WinDLL) -> None:
    for _ in range(CLIPBOARD_RETRY_COUNT):
        if user32.OpenClipboard(None):
            return
        time.sleep(CLIPBOARD_RETRY_DELAY_SECONDS)
    raise RuntimeError("Clipboard could not be opened.")


def _empty_snapshot(status: str, warning: str) -> ClipboardSnapshot:
    return ClipboardSnapshot(
        text="",
        has_text=False,
        format_count=0,
        capture_status=status,
        warnings=[warning],
    )


def get_clipboard_snapshot() -> ClipboardSnapshot:
    """Capture text clipboard state without logging sensitive content."""
    if os.name != "nt" or sys.platform != "win32":
        return _empty_snapshot("unsupported", "التقاط الحافظة مدعوم على Windows فقط.")

    user32, kernel32 = _load_windows_apis()

    try:
        _open_clipboard(user32)
    except Exception as exc:  # pragma: no cover - exercised via tests with monkeypatch
        return _empty_snapshot("unavailable", f"Clipboard capture failed: {exc}")

    locked_pointer = None
    clipboard_handle = None

    try:
        format_count = max(user32.CountClipboardFormats(), 0)
        if not user32.IsClipboardFormatAvailable(CF_UNICODETEXT):
            status = "non_text" if format_count > 0 else "empty"
            warning = (
                "محتوى الحافظة ليس نصًا."
                if format_count > 0
                else "الحافظة فارغة."
            )
            return ClipboardSnapshot(
                text="",
                has_text=False,
                format_count=format_count,
                capture_status=status,
                warnings=[warning],
            )

        clipboard_handle = user32.GetClipboardData(CF_UNICODETEXT)
        if not clipboard_handle:
            raise RuntimeError("Clipboard text handle was not available.")

        locked_pointer = kernel32.GlobalLock(clipboard_handle)
        if not locked_pointer:
            raise RuntimeError("Clipboard text buffer could not be locked.")

        text = ctypes.wstring_at(locked_pointer) or ""
        status = "ok" if text else "empty"
        warnings = [] if text else ["نص الحافظة فارغ."]
        return ClipboardSnapshot(
            text=text,
            has_text=bool(text),
            format_count=format_count,
            capture_status=status,
            warnings=warnings,
        )
    except Exception as exc:
        return _empty_snapshot("unavailable", f"Clipboard capture failed: {exc}")
    finally:
        if locked_pointer:
            kernel32.GlobalUnlock(clipboard_handle)
        user32.CloseClipboard()


def get_clipboard_text() -> str:
    """Return clipboard text or an empty string when text is unavailable."""
    return get_clipboard_snapshot().text


def clear_clipboard() -> bool:
    """Clear the clipboard to safely detect copied selection state."""
    if os.name != "nt" or sys.platform != "win32":
        return False

    user32, _ = _load_windows_apis()
    _open_clipboard(user32)
    try:
        return bool(user32.EmptyClipboard())
    finally:
        user32.CloseClipboard()


def set_clipboard_text(text: str) -> bool:
    """Set Unicode clipboard text safely."""
    if os.name != "nt" or sys.platform != "win32":
        return False

    user32, kernel32 = _load_windows_apis()
    payload = (text or "") + "\0"
    payload_bytes = payload.encode("utf-16-le")
    global_memory = None
    locked_pointer = None

    _open_clipboard(user32)
    try:
        if not user32.EmptyClipboard():
            return False

        global_memory = kernel32.GlobalAlloc(GMEM_MOVEABLE, len(payload_bytes))
        if not global_memory:
            return False

        locked_pointer = kernel32.GlobalLock(global_memory)
        if not locked_pointer:
            kernel32.GlobalFree(global_memory)
            return False

        ctypes.memmove(locked_pointer, payload_bytes, len(payload_bytes))
        kernel32.GlobalUnlock(global_memory)
        locked_pointer = None

        if not user32.SetClipboardData(CF_UNICODETEXT, global_memory):
            kernel32.GlobalFree(global_memory)
            return False

        global_memory = None
        return True
    finally:
        if locked_pointer:
            kernel32.GlobalUnlock(global_memory)
        if global_memory:
            kernel32.GlobalFree(global_memory)
        user32.CloseClipboard()

"""Windows foreground window capture with safe fallbacks."""
from __future__ import annotations

import ctypes
import os
import sys
from ctypes import wintypes
from pathlib import Path

PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
MAX_WINDOW_TEXT = 1024
MAX_CLASS_NAME = 256


def _fallback(status: str, warning: str) -> dict:
    return {
        "title": "",
        "process_name": "unknown",
        "process_id": 0,
        "class_name": "",
        "capture_status": status,
        "warnings": [warning],
    }


def _load_windows_apis() -> tuple[ctypes.WinDLL, ctypes.WinDLL]:
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

    user32.GetForegroundWindow.restype = wintypes.HWND
    user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
    user32.GetWindowTextLengthW.restype = ctypes.c_int
    user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    user32.GetWindowTextW.restype = ctypes.c_int
    user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    user32.GetClassNameW.restype = ctypes.c_int
    user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    user32.GetWindowThreadProcessId.restype = wintypes.DWORD

    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.QueryFullProcessImageNameW.argtypes = [
        wintypes.HANDLE,
        wintypes.DWORD,
        wintypes.LPWSTR,
        ctypes.POINTER(wintypes.DWORD),
    ]
    kernel32.QueryFullProcessImageNameW.restype = wintypes.BOOL
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL

    return user32, kernel32


def _get_window_title(user32: ctypes.WinDLL, hwnd: wintypes.HWND) -> str:
    length = user32.GetWindowTextLengthW(hwnd)
    if length <= 0:
        return ""
    buffer = ctypes.create_unicode_buffer(min(length + 1, MAX_WINDOW_TEXT))
    user32.GetWindowTextW(hwnd, buffer, len(buffer))
    return buffer.value.strip()


def _get_class_name(user32: ctypes.WinDLL, hwnd: wintypes.HWND) -> str:
    buffer = ctypes.create_unicode_buffer(MAX_CLASS_NAME)
    if user32.GetClassNameW(hwnd, buffer, len(buffer)) <= 0:
        return ""
    return buffer.value.strip()


def _get_process_name(kernel32: ctypes.WinDLL, process_id: int) -> str:
    if process_id <= 0:
        return "unknown"

    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, process_id)
    if not handle:
        return "unknown"

    try:
        buffer = ctypes.create_unicode_buffer(32768)
        size = wintypes.DWORD(len(buffer))
        success = kernel32.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(size))
        if not success or not buffer.value:
            return "unknown"
        return Path(buffer.value).name or buffer.value
    finally:
        kernel32.CloseHandle(handle)


def _collect_active_window() -> dict:
    user32, kernel32 = _load_windows_apis()
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        raise RuntimeError("Foreground window handle was not available.")

    process_id = wintypes.DWORD(0)
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(process_id))

    title = _get_window_title(user32, hwnd)
    class_name = _get_class_name(user32, hwnd)
    process_name = _get_process_name(kernel32, int(process_id.value))

    warnings: list[str] = []
    status = "ok"

    if not title:
        warnings.append("عنوان النافذة النشطة فارغ.")
        status = "partial"

    if process_name == "unknown":
        warnings.append("تعذر تحديد اسم البرنامج النشط.")
        status = "partial"

    return {
        "title": title,
        "process_name": process_name,
        "process_id": int(process_id.value),
        "class_name": class_name,
        "capture_status": status,
        "warnings": warnings,
    }


def get_active_window() -> dict:
    """Return information about the currently active window."""
    if os.name != "nt" or sys.platform != "win32":
        return _fallback(
            "unsupported",
            "التقاط النافذة النشطة مدعوم على Windows فقط.",
        )

    try:
        return _collect_active_window()
    except Exception as exc:  # pragma: no cover - exercised via tests with monkeypatch
        return _fallback("unavailable", f"Active window capture failed: {exc}")

"""Safe action execution primitives for Phase 2A.

This module provides clipboard access and an explicit paste shortcut for Windows.
It is intentionally narrow: only copy and approved paste are supported. No mouse
movement, no arbitrary keyboard automation, no application control.
"""
from __future__ import annotations

import ctypes
import time
from typing import Callable

import pyperclip

from config import settings


def _default_send_paste_shortcut() -> bool:
    """Send Ctrl+V on Windows using SendInput.

    Returns True if the input was sent. Focus must already be in the target
    text field; the caller is responsible for warning the user if focus cannot be
    guaranteed.
    """
    try:
        # Windows virtual-key codes
        VK_CONTROL = 0x11
        VK_V = 0x56
        KEYEVENTF_EXTENDEDKEY = 0x0001
        KEYEVENTF_KEYUP = 0x0002

        INPUT_KEYBOARD = 1

        class KEYBDINPUT(ctypes.Structure):
            _fields_ = [
                ("wVk", ctypes.c_ushort),
                ("wScan", ctypes.c_ushort),
                ("dwFlags", ctypes.c_ulong),
                ("time", ctypes.c_ulong),
                ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong)),
            ]

        class INPUT_I(ctypes.Union):
            _fields_ = [("ki", KEYBDINPUT)]

        class INPUT(ctypes.Structure):
            _fields_ = [("type", ctypes.c_ulong), ("_input", INPUT_I)]

            def __init__(self, *args, **kw):
                super().__init__(*args, **kw)
                self._input = INPUT_I()

        def make_key_input(vk: int, flags: int) -> INPUT:
            inp = INPUT()
            inp.type = INPUT_KEYBOARD
            inp._input.ki = KEYBDINPUT(wVk=vk, wScan=0, dwFlags=flags, time=0, dwExtraInfo=None)
            return inp

        inputs = [
            make_key_input(VK_CONTROL, 0),
            make_key_input(VK_V, 0),
            make_key_input(VK_V, KEYEVENTF_KEYUP),
            make_key_input(VK_CONTROL, KEYEVENTF_KEYUP),
        ]
        n_inputs = len(inputs)
        size = ctypes.sizeof(INPUT)
        arr = (INPUT * n_inputs)(*inputs)
        user32 = ctypes.windll.user32
        if user32.SendInput(n_inputs, ctypes.byref(arr), size) != n_inputs:
            return False
        return True
    except Exception:
        return False


class ActionExecutor:
    """Executes the small set of allowed Phase 2A actions.

    The clipboard and paste shortcut helpers are instance attributes so tests can
    inject safe mocks without touching the real system clipboard or keyboard.
    """

    def __init__(
        self,
        get_clipboard: Callable[[], str] | None = None,
        set_clipboard: Callable[[str], None] | None = None,
        send_paste_shortcut: Callable[[], bool] | None = None,
    ) -> None:
        self._get_clipboard = get_clipboard or pyperclip.paste
        self._set_clipboard = set_clipboard or pyperclip.copy
        self._send_paste_shortcut = send_paste_shortcut or _default_send_paste_shortcut

    def copy_text(self, text: str) -> dict:
        """Copy text to the system clipboard."""
        if not text:
            return {"executed": False, "status": "validation_error", "warnings": ["لا يوجد نص للنسخ."], "safe_message": "لا يوجد نص للنسخ."}
        try:
            self._set_clipboard(text)
            return {"executed": True, "status": "ok", "warnings": [], "safe_message": "تم النسخ إلى الحافظة."}
        except Exception as exc:
            return {"executed": False, "status": "error", "warnings": ["تعذر الوصول إلى الحافظة."], "safe_message": f"تعذر النسخ: {exc}"}

    def paste_text(self, text: str) -> dict:
        """Copy text to clipboard and send Ctrl+V after a short delay.

        If configured, the original clipboard content is restored afterwards.
        """
        if not text:
            return {"executed": False, "status": "validation_error", "warnings": ["لا يوجد نص للصق."], "safe_message": "لا يوجد نص للصق."}

        original = ""
        try:
            original = self._get_clipboard()
        except Exception:
            original = ""

        try:
            self._set_clipboard(text)
        except Exception as exc:
            return {"executed": False, "status": "error", "warnings": ["تعذر وضع النص في الحافظة."], "safe_message": f"تعذر اللصق: {exc}"}

        if settings.paste_delay_ms > 0:
            time.sleep(settings.paste_delay_ms / 1000.0)

        shortcut_ok = self._send_paste_shortcut()
        if not shortcut_ok:
            return {
                "executed": False,
                "status": "error",
                "warnings": ["تعذر إرسال اختصار اللصق. تأكد من مكان المؤشر."],
                "safe_message": "تعذر اللصق، تأكد من مكان المؤشر.",
            }

        if settings.paste_restore_clipboard:
            try:
                self._set_clipboard(original)
            except Exception:
                pass

        return {"executed": True, "status": "ok", "warnings": [], "safe_message": "تم اللصق في الحقل النشط."}


def get_executor() -> ActionExecutor:
    """Return the default executor instance."""
    return ActionExecutor()

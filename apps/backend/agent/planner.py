"""Agent safety planning helpers for the current preview-only phase."""
from __future__ import annotations

import re

UNSAFE_PATTERNS = [
    (re.compile(r"(?i)\b(delete|remove|erase|format|wipe)\b.*\b(file|folder|directory|disk)\b"), "حذف الملفات أو المجلدات أو تهيئة الأقراص غير مسموح في المرحلة 2A."),
    (re.compile(r"(?i)\b(run|execute|launch)\b.*\b(command|powershell|cmd|terminal|script|batch)\b"), "تشغيل الأوامر أو السكربتات غير مسموح في المرحلة 2A."),
    (re.compile(r"(?i)\b(send|forward)\b.*\b(email|message|dm|sms|whatsapp|telegram)\b"), "إرسال الرسائل غير مسموح في المرحلة 2A."),
    (re.compile(r"(?i)\b(pay|purchase|buy|checkout|charge|transfer)\b"), "عمليات الدفع أو الشراء غير مسموحة في المرحلة 2A."),
    (re.compile(r"(?i)\b(click|press|submit|upload|change|modify)\b.*\b(system|settings|registry|browser|form)\b"), "التحكم المباشر في التطبيقات أو إعدادات النظام غير مسموح في المرحلة 2A."),
]


def detect_unsafe_request(instruction: str) -> str | None:
    """Return a refusal reason when the request asks for unsafe automation."""
    for pattern, reason in UNSAFE_PATTERNS:
        if pattern.search(instruction):
            return reason
    return None

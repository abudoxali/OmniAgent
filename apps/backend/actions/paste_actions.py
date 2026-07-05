"""Paste-related actions with preview."""

from config import settings


def build_paste_preview(text: str) -> dict:
    """Return a safe preview of text that could be pasted."""
    preview = text[: settings.paste_preview_max_chars]
    if len(text) > settings.paste_preview_max_chars:
        preview += "…"
    return {"preview": preview, "approved": False, "length": len(text)}

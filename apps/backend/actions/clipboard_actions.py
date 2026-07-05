"""Clipboard-related actions (copy, read)."""

from actions.executor import get_executor


def copy_to_clipboard(text: str) -> dict:
    """Copy the given text to the system clipboard."""
    return get_executor().copy_text(text)

import pytest

from agent.prompts import build_prompt


def test_prompt_truncation_and_redaction_work():
    prompt, warnings = build_prompt(
        instruction="Please summarize " + ("X" * 60) + " api_key=secret123",
        mode="summarize",
        context={
            "active_window_title": "Secrets.txt",
            "active_process_name": "notepad.exe",
            "active_process_id": 88,
            "clipboard_text_preview": "token=abcd1234",
            "clipboard_text_length": 14,
            "selected_text_preview": "sk-abcdefghijklmnopqrstuvwxyz",
            "selected_text_length": 29,
            "capture_status": {"clipboard": "ok", "selected_text": "captured"},
        },
        include_clipboard_context=True,
        include_selected_text_context=True,
        include_active_window_context=True,
        max_prompt_chars=40,
        max_context_chars=140,
    )

    assert "secret123" not in prompt
    assert "abcd1234" not in prompt
    assert "sk-abcdefghijklmnopqrstuvwxyz" not in prompt
    assert "[REDACTED]" in prompt
    assert "Instruction was truncated" in warnings[0]
    assert any("Context block was truncated" in warning for warning in warnings)


"""Prompt construction for controlled text-only model calls."""
from __future__ import annotations

from context_engine.context_builder import _redact_secrets

MODE_INSTRUCTIONS = {
    "custom": "Follow the user's request directly using only the provided desktop context.",
    "summarize": "Summarize the provided content clearly and concisely.",
    "rewrite": "Rewrite the provided content while preserving intent and improving clarity.",
    "explain": "Explain the content or situation in a practical, easy-to-follow way.",
    "translate": "Translate the provided content accurately and preserve important meaning.",
    "generate_reply": "Draft a helpful reply based on the provided context.",
}

SYSTEM_PROMPT = (
    "You are OmniAgent, a Windows desktop copilot operating in a safe preview-only phase. "
    "You can read the provided text context and produce useful text output, but you cannot control the computer, "
    "run commands, send messages, or perform destructive actions."
)


def _truncate(text: str, max_chars: int) -> tuple[str, bool]:
    if len(text) <= max_chars:
        return text, False

    truncated = text[:max_chars]
    marker = "[REDACTED]"
    for prefix_length in range(len(marker) - 1, 0, -1):
        if truncated.endswith(marker[:prefix_length]):
            truncated = truncated[:-prefix_length]
            remaining_budget = max_chars - len(marker)
            if len(truncated) > remaining_budget:
                truncated = truncated[:remaining_budget]
            truncated = f"{truncated}{marker}"
            break

    return truncated.rstrip(), True


def build_prompt(
    *,
    instruction: str,
    mode: str,
    context: dict | None,
    include_clipboard_context: bool,
    include_selected_text_context: bool,
    include_active_window_context: bool,
    max_prompt_chars: int,
    max_context_chars: int,
) -> tuple[str, list[str]]:
    warnings: list[str] = []
    safe_instruction, instruction_truncated = _truncate(_redact_secrets(instruction.strip()), max_prompt_chars)
    if instruction_truncated:
        warnings.append("Instruction was truncated to the configured prompt limit.")

    context_sections: list[str] = []
    context = context or {}

    if include_active_window_context:
        window_title = context.get("active_window_title") or context.get("active_window", {}).get("title", "")
        process_name = context.get("active_process_name") or context.get("active_window", {}).get("process_name", "")
        process_id = context.get("active_process_id") or context.get("active_window", {}).get("process_id", 0)
        context_sections.append(
            f"Active Window:\n- Title: {window_title or 'Unknown'}\n- Process: {process_name or 'Unknown'}\n- PID: {process_id}"
        )

    if include_clipboard_context:
        context_sections.append(
            "Clipboard Preview:\n"
            f"- Status: {context.get('capture_status', {}).get('clipboard', 'unknown')}\n"
            f"- Length: {context.get('clipboard_text_length', 0)}\n"
            f"- Preview: {context.get('clipboard_text_preview', '') or 'No clipboard preview available'}"
        )

    if include_selected_text_context:
        context_sections.append(
            "Selected Text Preview:\n"
            f"- Status: {context.get('capture_status', {}).get('selected_text', 'unknown')}\n"
            f"- Length: {context.get('selected_text_length', 0)}\n"
            f"- Preview: {context.get('selected_text_preview', '') or 'No selected-text preview available'}"
        )

    joined_context = "\n\n".join(section for section in context_sections if section)
    safe_context, context_truncated = _truncate(_redact_secrets(joined_context), max_context_chars)
    if context_truncated:
        warnings.append("Context block was truncated to the configured context limit.")

    mode_instruction = MODE_INSTRUCTIONS.get(mode, MODE_INSTRUCTIONS["custom"])

    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"Mode: {mode}\n"
        f"Mode Guidance: {mode_instruction}\n\n"
        f"User Instruction:\n{safe_instruction}\n\n"
        f"Desktop Context:\n{safe_context or 'No context requested.'}\n\n"
        "Return text only. Do not claim you can execute actions."
    )
    return prompt, warnings

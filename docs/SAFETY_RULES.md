# OmniAgent - Safety Rules

Version: `0.1.0`
Updated: `2026-06-22`
Applies from: `Phase 1C onward` (Phase 2C — global overlay target capture + UX reliability; explicit user approval before text-only copy/paste actions; no automation, no secrets)

## Non-Negotiable Rules

1. No destructive automation.
2. No terminal or shell command execution features.
3. No file deletion, overwrite, move, or rename actions.
4. No payment, email sending, browser submission, or system-control actions.
5. No secrets in source, logs, committed config, or example files.
6. No hidden background behavior that acts without user awareness.
7. No auto-paste, auto-submit, or arbitrary mouse/keyboard automation.
8. No clicking or controlling other applications' windows.

## Phase 2C Allowed Actions

Only safe local capture, preview, and explicit user-approved text actions are allowed:

- health checks
- local active-window reads
- local clipboard preview reads
- disabled-by-default selected-text capture with clipboard restoration safeguards
- disabled-by-default screenshot metadata capture
- real provider listing with safe status summaries
- safe provider readiness tests using short prompts without desktop context
- preview-only text generation through configured model providers
- `copy_to_clipboard` after the user clicks a copy button
- `paste_text_approved` only after the user previews the action and clicks an approve button
- `paste_preview_only` without any execution
- controlled agent response preview
- local log retrieval and safe action metadata
- Arabic setup guidance when providers are offline or unconfigured
- compact global overlay opened with `Ctrl + Alt + A` that captures the previous active target context before taking focus and runs the same approval-based text actions
- safe target metadata (window title, process name, capture timestamp) stored in action previews and logs only

These actions may simulate future behavior, but they must not perform irreversible changes or automatically send captured data to external providers.

## Approval Model

Phase 2A and 2B introduce real approval for medium-risk actions:

- read-only or preview-only actions are the only auto-safe category
- `copy_to_clipboard` is low-risk and may execute directly on a user click
- `paste_text_approved` is medium-risk and requires a two-step preview + confirm flow in both the Home page and the overlay
- the overlay only opens on an explicit global hotkey and does not perform actions automatically
- the overlay captures the previous active target context before taking focus; it does not click, focus, or control the target app
- anything that would mutate user data outside the clipboard must require explicit user approval
- destructive actions remain prohibited until explicitly designed and reviewed

## Secret Handling

- Use environment variables or user-local files excluded from version control.
- Keep `.env.example` value-free and non-sensitive.
- Never place API keys, passwords, or tokens in docs, tests, or sample payloads.
- The runtime file `apps/backend/runtime/provider_settings.json` may store only non-secret provider preferences.
- OpenAI-compatible credentials may be read only from environment variables and must never be returned in API responses.
- Provider setup UX may show only environment variable names, never their secret values.
- `/models/settings` must reject secret-like fields such as `api_key`, `token`, `password`, or `secret`.
- Action payload previews must redact obvious secret-like patterns.

## Logging Rules

- Logs may include route activity and placeholder metadata.
- Logs must not include secrets.
- Logs should remain local to the machine.
- Clipboard, selected text, and screenshots must not be persisted unless an explicit later feature adds that behavior with review.
- Screenshot bytes or base64 payloads must not be returned from `/context/current` by default.
- Full clipboard or selected text must not be logged; only redacted previews are allowed in prompt construction.
- Action logs must store only metadata (type, status, risk level, payload length, target hint) by default. Full payload content logging requires `ACTION_LOG_CONTENT_ENABLED=true`.
- Target metadata in logs (`target_hint`, `target_window_title`, `target_process_name`, `target_captured_at`) must be truncated and must not expose secrets.
- `/models/test` must not include clipboard text, selected text, or screenshots in its outbound payload.
- `/agent/run` and `/models/providers` must not echo stored secrets because no stored secrets are allowed in provider settings.
- Timeout and malformed-provider failures must be normalized to safe Arabic guidance without stack traces in the UI.
- Model-not-found failures may include only the public model name and a generic install command hint, never secrets or raw provider error bodies.

## Future Capability Gate

A new action type cannot be added unless all of the following exist first:

1. an action schema entry
2. a risk classification rule
3. a permission policy
4. an explicit UX plan for user approval when needed
5. a log trail for execution outcomes
6. a test that verifies the action is rejected when unapproved or unsafe

## Explicitly Prohibited Examples

- `shell_execute`
- `delete_file`
- `overwrite_file`
- `send_email`
- `process_kill`
- `system_shutdown`
- `payment_charge`
- `browser_click`
- `auto_paste`
- `mouse_move`
- `keyboard_auto_type`
- `window_click`
- `window_focus`
- `control_other_app`

If a future phase ever introduces one of these categories, it requires a new safety review and must not be smuggled in through a generic action endpoint.

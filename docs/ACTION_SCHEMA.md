# Abud OmniAgent - Action Schema

Version: `0.1.0`
Updated: `2026-06-22`

## Purpose

Every future agent action must be representable as a structured object before it can be evaluated for safety or executed. Phase 2A enables the first execution layer: explicit user-approved text actions only. Phase 2B surfaces these actions through a compact global overlay. Phase 2C adds safe target metadata fields to the action preview so the overlay can record the target app/window without exposing full payload text.

## Canonical Shape

```json
{
  "action_id": "550e8400-e29b-41d4-a716-446655440000",
  "action_type": "copy_to_clipboard",
  "risk_level": "low",
  "requires_confirmation": false,
  "user_visible_summary_ar": "نسخ 12 حرف إلى الحافظة.",
  "payload_preview": "Example output",
  "payload_length": 12,
  "target_hint": null,
  "created_at": "2026-06-22T10:00:00+00:00",
  "status": "ok"
}
```

## Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `action_id` | `string` | yes | UUID used for the preview/confirm cycle |
| `action_type` | `string` | yes | Stable snake_case identifier |
| `risk_level` | `safe \| low \| medium \| high \| critical` | yes | Used by the safety layer |
| `requires_confirmation` | `boolean` | yes | `true` for medium-risk actions such as paste |
| `user_visible_summary_ar` | `string` | yes | Arabic user-facing summary |
| `payload_preview` | `string` | yes | Truncated preview with secrets redacted |
| `payload_length` | `integer` | yes | Length of the original payload |
| `target_hint` | `string \| null` | no | Active window or target field hint |
| `target_window_title` | `string \| null` | no | Captured target window title (truncated) |
| `target_process_name` | `string \| null` | no | Captured target process name (truncated) |
| `target_captured_at` | `string \| null` | no | ISO timestamp of target context capture |
| `created_at` | `string` | yes | ISO timestamp |
| `status` | `string` | yes | `ok`, `canceled`, `rejected`, `error`, `not_found` |

## Phase 2A Allowed Actions

### `copy_to_clipboard`

```json
{
  "action_id": "550e8400-e29b-41d4-a716-446655440000",
  "action_type": "copy_to_clipboard",
  "risk_level": "low",
  "requires_confirmation": false,
  "user_visible_summary_ar": "نسخ 12 حرف إلى الحافظة.",
  "payload_preview": "Generated output",
  "payload_length": 12,
  "target_hint": null,
  "created_at": "2026-06-22T10:00:00+00:00",
  "status": "ok"
}
```

### `paste_text_approved`

```json
{
  "action_id": "550e8400-e29b-41d4-a716-446655440001",
  "action_type": "paste_text_approved",
  "risk_level": "medium",
  "requires_confirmation": true,
  "user_visible_summary_ar": "لصق 12 حرف في الحقل النشط بعد الموافقة.",
  "payload_preview": "Generated output",
  "payload_length": 12,
  "target_hint": "Notepad",
  "target_window_title": "Untitled - Notepad",
  "target_process_name": "notepad.exe",
  "target_captured_at": "2026-06-22T10:00:00+00:00",
  "created_at": "2026-06-22T10:00:00+00:00",
  "status": "ok"
}
```

### `paste_preview_only`

```json
{
  "action_id": "550e8400-e29b-41d4-a716-446655440002",
  "action_type": "paste_preview_only",
  "risk_level": "low",
  "requires_confirmation": false,
  "user_visible_summary_ar": "معاينة 12 حرف قبل اللصق.",
  "payload_preview": "Generated output",
  "payload_length": 12,
  "target_hint": null,
  "created_at": "2026-06-22T10:00:00+00:00",
  "status": "ok"
}
```

## Risk Mapping For Phase 2A

- `safe`: read-only context reads and preview-only text generation
- `low`: clipboard-oriented actions or reversible local actions, such as `copy_to_clipboard` and `paste_preview_only`
- `medium`: actions that affect another application, such as `paste_text_approved`; requires explicit confirmation
- `high` and `critical`: reserved for future phases and must be rejected now

## Invalid Action Categories In Phase 2A

The following action families are out of scope and must be rejected by the safety layer:

- shell execution
- file deletion or overwrite
- system configuration changes
- network side effects
- browser submission flows
- terminal command execution
- destructive file operations
- app-control actions such as clicking or auto-paste
- arbitrary mouse movement or keyboard automation

## Implementation Notes

- `docs/SAFETY_RULES.md` defines what is allowed. This document defines how an allowed action must be described. Both documents must stay aligned.
- `POST /actions/preview` never executes the action; it only validates the type and returns a safe preview object.
- `POST /actions/confirm` executes only actions that have been previewed and explicitly confirmed by the user.
- Paste execution is limited to setting the clipboard and sending a Ctrl+V shortcut; it does not click or focus arbitrary UI.
- Safe target metadata (`target_hint`, `target_window_title`, `target_process_name`, `target_captured_at`) may be stored in action logs and preview responses; values are truncated to avoid abuse.
- Full payload text is never stored in logs unless `ACTION_LOG_CONTENT_ENABLED` is explicitly set to `true`.

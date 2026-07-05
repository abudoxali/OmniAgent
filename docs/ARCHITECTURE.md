# Abud OmniAgent - Architecture

Version: `0.1.0`
Updated: `2026-06-22`
Current phase: `Phase 2C - Overlay Target Capture + UX Reliability`

Phase 1G was validated end-to-end using LM Studio with the model `google/gemma-4-e2b` at `http://127.0.0.1:1234/v1`. Phase 1H stabilized the preview-only MVP. Phase 2A introduced explicit user approval before copy/paste text actions. Phase 2B turned the assistant into a global overlay: `Ctrl + Alt + A` opens a compact Arabic RTL window above any active app, captures safe context, runs AI, and lets the user manually copy or approve paste. Phase 2C improves overlay reliability by capturing the previous active window as the target context before the overlay takes focus, displaying target context separately from current context, and hardening the approval-based paste UX. The overlay remains approval-based and text-only.

## System Shape

Abud OmniAgent uses a two-process local architecture:

```text
Desktop App (Electron + React + TypeScript)
        |
        | HTTP on localhost
        v
Backend API (FastAPI + Python)
```

The desktop app is the user-facing shell. The backend owns local context capture, safety boundaries, and storage setup. This split keeps Windows-specific integrations out of the renderer and makes the backend independently testable.

## Project Layout

```text
apps/
  backend/
    api/
    core/
    context_engine/
    model_router/
    agent/
    safety/
    actions/
    storage/
    tests/
  desktop/
    electron/
    src/
docs/
scripts/
```

## Backend Modules

### `api/`

Thin FastAPI route modules:

- `health.py`
- `context.py`
- `agent.py`
- `models.py`
- `actions.py`
- `logs.py`

### `context_engine/`

Windows context collectors:

- `active_window.py`
- `clipboard.py`
- `selected_text.py`
- `screenshot.py`
- `context_builder.py`

These modules return real local metadata where possible and disabled or failure states where capture is not available.

### `model_router/`

Provider abstraction layer for real text-only model execution:

- `base.py`
- `ollama_provider.py`
- `openai_compatible_provider.py`
- `lmstudio_provider.py`
- `router.py`

The router normalizes provider output to a stable payload:

- `provider`
- `model`
- `output_text`
- `output_preview`
- `latency_ms`
- `status`
- `warnings`
- `raw_error` only when safe
- `safe_error_message` only when safe

Provider routing in Phase 1G supports:

- Ollama local generation via `/api/generate`
- LM Studio via OpenAI-compatible chat completions
- configurable OpenAI-compatible backends with API keys from environment variables only

When a local provider is reachable but the requested model is not installed (for example, Ollama returns `404`), the router returns a `model_not_found` status with Arabic guidance and a safe install command hint, without exposing secrets or stack traces.

### `core/`

Safe provider settings persistence:

- `provider_settings.py`

This module owns the runtime-safe provider settings file, validation of non-secret fields, secret-field rejection, and effective-model resolution for the active provider.

### `agent/`

Planning and prompt construction:

- `planner.py`
- `prompts.py`

The agent layer now:

- refuses unsafe automation requests for this phase
- builds redacted text prompts from selected context previews only
- excludes screenshot data from provider prompts
- returns preview-only model output to the desktop UI

### `safety/`

Shared safety definitions:

- `action_schema.py`
- `risk_classifier.py`
- `permissions.py`

### `actions/`

Phase 2A approval-based text action handlers:

- `safety.py`: action validation, risk classification, preview generation, and secret redaction
- `executor.py`: clipboard copy, clipboard restore, and Windows Ctrl+V paste shortcut
- `store.py`: short-lived pending action preview store and safe action logging
- `clipboard_actions.py`: copy_to_clipboard implementation
- `paste_actions.py`: paste preview builder

Allowed action types in Phase 2A:

- `copy_to_clipboard` (low risk, no confirmation required)
- `paste_text_approved` (medium risk, requires explicit confirmation)
- `paste_preview_only` (low risk, no execution)

All other action types are rejected. The executor does not move the mouse, click arbitrary UI elements, or run shell commands.

### `storage/`

Local SQLite initialization:

- `db.py`

The local SQLite schema remains minimal while context capture stays memory-only for clipboard, selected text, and screenshots.

## Desktop Modules

### `electron/`

- `main.ts`: creates the main window and a separate compact overlay window; registers the global `Ctrl + Alt + A` shortcut to capture the target context and then show/focus the overlay; hides the overlay on `Escape` via IPC; destroys the overlay when the main window closes so the app can quit cleanly
- `preload.ts`: exposes safe IPC helpers including `hideOverlay`, `onShowOverlay`, `getOverlayTargetContext`, and `onOverlayTargetContext`

### `src/`

- `App.tsx`: router shell; detects `?overlay=1` query parameter and renders the compact overlay page instead of the main app
- `pages/`: Home, Settings, Logs, OverlayPage
- `components/`: Sidebar, Overlay, HealthIndicator, ProviderSelector, ActionButtons, ResultPreview
- `i18n/`: Arabic-first UI text and status translation helpers

The desktop app talks directly to the local backend over HTTP. The main window remains the full Arabic-first app. The overlay window (`OverlayPage`) is a compact, frameless, always-on-top surface that reuses `ProviderSelector`, `ActionButtons`, and `ResultPreview` to run the same safe AI flow. It does not click or control other applications.

Before the overlay is shown, the main process calls `GET /context/current` to capture the target context (the previous active window). This context is passed to the overlay renderer via IPC. The overlay displays the target context (captured before opening) separately from the current context (refreshed while the overlay is open). The current context may show the overlay itself because it has become the foreground window. Paste actions still use the existing `/actions/preview` + `/actions/confirm` flow, and the preview request now includes safe target metadata (`target_hint`, `target_window_title`, `target_process_name`, `target_captured_at`) so the action log can record the target without storing full payload text.

## API Contract In Phase 2C

Required routes:

- `GET /health`
- `GET /context/current`
- `POST /agent/run`
- `GET /models/settings`
- `POST /models/settings`
- `GET /models/providers`
- `POST /models/test`
- `POST /actions/preview`
- `POST /actions/confirm`
- `POST /actions/copy`
- `POST /actions/paste-preview`
- `GET /logs`
- `GET /actions/logs`

The route names remain stable. `/context/current` now returns real local context metadata with graceful fallbacks, disabled statuses, and warning messages instead of failing hard.

`GET /models/settings` and `POST /models/settings` read and write only non-secret provider preferences inside the local runtime file. `GET /models/providers` returns safe provider summaries without secrets, including Arabic display names, readiness metadata, discovered models when available, and safe environment-variable hints. `POST /models/test` performs a short provider-readiness prompt without desktop context, clipboard text, selected text, or screenshots. `POST /agent/run` still performs real provider-backed text generation and continues to refuse unsafe automation instructions.

`POST /actions/preview` creates a safe action preview without executing anything. The preview request may include safe target metadata (`target_hint`, `target_window_title`, `target_process_name`, `target_captured_at`) which is stored in the pending action and logged without exposing the full payload. `POST /actions/confirm` resolves a pending preview: when `confirm=false` the action is canceled and logged; when `confirm=true` only allowed low-risk copy or explicitly approved medium-risk paste actions are executed. `POST /actions/copy` executes a copy immediately because it is low-risk and triggered by a direct user click. `POST /actions/paste-preview` returns a preview only. `GET /logs` and `GET /actions/logs` return safe metadata; full payload text is not logged unless `action_log_content_enabled` is explicitly set.

## Storage

The backend initializes a local SQLite database file using the configured `DB_PATH`.

- `sessions`
- `action_log`

This supports health verification and future logging without introducing external dependencies.

## Safety Boundary

The architecture intentionally blocks risky capability from entering Phase 2C:

- no shell execution route
- no file mutation route
- no external network side-effect route
- no secret storage mechanism or API key echoing
- no automatic screenshot transmission
- no automatic pasting or app control
- no arbitrary window focus or click manipulation
- the overlay only displays safe context metadata and does not control other applications
- target context is captured before the overlay takes focus where possible; the app does not focus or click the target app
- paste actions use explicit `/actions/preview` + `/actions/confirm` and only send Ctrl+V after user approval
- action logs store metadata only by default; full payload content requires explicit opt-in

Any future feature that crosses these boundaries must first be defined in `docs/SAFETY_RULES.md` and `docs/ACTION_SCHEMA.md`.

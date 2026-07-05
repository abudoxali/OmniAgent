# Abud OmniAgent - MVP Acceptance Criteria

Version: `0.1.0`
Updated: `2026-06-22`
Scope: `Phase 1G + Phase 1H + Phase 2A + Phase 2B + Phase 2C - Overlay Target Capture + UX Reliability`

Status: `Phase 1G achieved` — validated end-to-end with LM Studio using `google/gemma-4-e2b` at `http://127.0.0.1:1234/v1`. Both `/models/test` and `/agent/run` returned real provider output.

Phase 1H is complete. Phase 2A is complete. Phase 2B is complete. Phase 2C criteria are in progress. `STATUS.md` records the current pass/fail state. This document defines the target acceptance bar.

## Phase 2C Acceptance Criteria

### C1. Target capture before overlay focus

- Before the overlay is shown, the Electron main process captures the previous active window context via `GET /context/current`.
- Target context includes previous active window title, process name, process ID, and capture timestamp.
- If capture fails, the overlay displays a clear Arabic warning.
- The overlay itself does not click or focus the target app.

### C2. Overlay target display

- Overlay shows a separate "السياق المستهدف" section with target app/window, process name, process ID, and capture time.
- Overlay shows a separate "السياق الحالي" section that can be refreshed while the overlay is open.
- A clear Arabic warning appears if the captured target context is the overlay itself.
- Technical values (process names, IDs, timestamps) remain LTR.

### C3. Paste approval UX

- Paste-after-approval preview includes the captured target hint in the action metadata.
- Confirmation panel displays the required Arabic warning about placing the cursor in the target app.
- Paste does not execute without confirmation.
- The app does not move the mouse or focus another window automatically.

### C4. Overlay reliability

- `Ctrl + Alt + A` opens or focuses the overlay; if already visible, the hotkey focuses it.
- `Escape` hides the overlay.
- Closing the overlay does not close the main app.
- The main window remains usable.

### C5. Safety and tests

- No new unsafe actions are added.
- Backend tests pass.
- Desktop build passes.
- No secrets are exposed.
- Action logs include target metadata by default but not full payload text.

## Phase 2B Acceptance Criteria

### B1. Global overlay window

- `Ctrl + Alt + A` opens or focuses a compact Arabic RTL overlay window.
- The overlay is a separate frameless always-on-top window, not a modal inside the main window.
- `Escape` or the close button hides the overlay.

### B2. Overlay UI

- Overlay shows the active app/window summary.
- Overlay shows a provider/model summary.
- Overlay includes the mode selector, instruction input, and Run AI button.
- Overlay shows the result preview.
- Overlay includes copy, paste-after-approval, and cancel buttons.
- Confirmation panel appears before paste.

### B3. Safe context

- Overlay calls `GET /context/current` and displays only safe metadata.
- A refresh button updates the context.
- No long sensitive content is displayed by default.

### B4. Reuse and consistency

- Overlay reuses `ProviderSelector`, `ActionButtons`, and `ResultPreview` from the Home page.
- Main Home page remains fully functional.

### B5. Safety and tests

- No new unsafe actions are added.
- Backend tests pass.
- Desktop build passes.
- No secrets are exposed.

## Phase 2A Acceptance Criteria

### A2A1. Action schema is hardened

- Allowed action types are `copy_to_clipboard`, `paste_text_approved`, and `paste_preview_only`.
- Unknown action types are rejected.
- Destructive/system/terminal action types are rejected.
- Each action has `action_id`, `action_type`, `risk_level`, `requires_confirmation`, `user_visible_summary_ar`, `payload_preview`, `payload_length`, and `status`.

### A2A2. Safety checker works

- Paste actions require confirmation.
- Empty payloads are rejected.
- Previews are truncated.
- Secret-like patterns are redacted.
- Full payload text is not logged by default.

### A2A3. Backend endpoints are correct

- `POST /actions/preview` returns a preview without executing.
- `POST /actions/confirm` with `confirm=false` cancels.
- `POST /actions/confirm` with `confirm=true` executes allowed copy or approved paste.
- `POST /actions/copy` and `POST /actions/paste-preview` remain aligned.

### A2A4. Paste is safe

- Paste uses clipboard + Ctrl+V only after explicit user click.
- Original clipboard is restored when configured.
- Failed paste returns a clear Arabic cursor warning.
- No mouse clicking or focus manipulation.

### A2A5. Desktop UI shows approval flow

- Result preview shows copy, paste-after-approval, and cancel options.
- Confirmation panel shows Arabic warnings and truncated preview.
- Action status messages are clear.
- Safe-mode badge remains visible.

### A2A6. Safety refusal remains

- `/agent/run` refuses instructions for deletion, commands, sending, payments, system changes, and submit/upload.

### A2A7. Tests and checks pass

- Backend tests pass.
- Desktop build passes.
- `npm run health` passes.
- No secrets appear in responses, logs, or UI.

## Phase 1H Stabilization Criteria

### H1. Preview MVP startup guidance is clear

- The Settings page shows a step-by-step Arabic checklist for starting LM Studio and the Local Server.
- Technical values (URLs, model IDs, endpoint paths) remain LTR.
- README.md includes the same startup checklist.

### H2. Provider readiness UX is visible

- Settings shows the current active provider and active model.
- Settings shows the last provider test status (success, failure, or not tested yet).
- Arabic status messages include: "المزود جاهز", "السيرفر غير شغال", "النموذج غير محمّل", "اختبر المزود قبل استخدام الصفحة الرئيسية".

### H3. Packaging is clean

- `apps/desktop/package.json` includes `author`, `productName`, and `appId`.
- Desktop build passes without missing-author warnings.
- Windows installer output is generated.

### H4. Safety remains intact

- No auto-paste, no screenshot sending, no selected-text capture by default, no terminal execution feature, no API key storage in runtime settings.
- `/models/test` does not send desktop context.
- `/agent/run` remains preview-only.

### H5. Tests and checks pass

- Backend tests pass.
- Desktop build passes.
- `npm run health` passes when the backend is running.
- Real provider path works when LM Studio is running; offline path returns clear Arabic guidance when it is stopped.

## Phase 1G Acceptance Criteria

### A1. Root structure is present

Required root items:

- `README.md`
- `STATUS.md`
- `.gitignore`
- `.env.example`
- `package.json`
- `apps/backend`
- `apps/desktop`
- `docs`
- `scripts`

### A2. Backend is runnable

The backend must:

- install from `apps/backend/requirements.txt`
- start with Uvicorn on port `8000`
- initialize the local SQLite database

### A3. Required backend routes exist

- `GET /health`
- `GET /context/current`
- `POST /agent/run`
- `GET /models/settings`
- `POST /models/settings`
- `GET /models/providers`
- `POST /models/test`
- `POST /actions/copy`
- `POST /actions/paste-preview`
- `GET /logs`

`GET /context/current` must return stable JSON with active-window, clipboard, selected-text, and screenshot capture status fields.
`GET /models/settings` must return safe persisted provider settings without secrets.
`POST /models/settings` must reject secret-like fields and persist only allowed non-secret provider settings.
`GET /models/providers` must return safe provider summaries without secrets.
`POST /models/test` must return a normalized provider-readiness result without desktop context.
`POST /agent/run` must return real provider-backed text output or a graceful normalized error.

### A4. Required backend modules exist and are wired

The following modules must exist and support the current context and provider pipeline:

- `active_window.py`
- `clipboard.py`
- `selected_text.py`
- `screenshot.py`
- `context_builder.py`
- `base.py`
- `ollama_provider.py`
- `openai_compatible_provider.py`
- `lmstudio_provider.py`
- `router.py`
- `provider_settings.py`
- `planner.py`
- `prompts.py`
- `action_schema.py`
- `risk_classifier.py`
- `permissions.py`
- `clipboard_actions.py`
- `paste_actions.py`
- `db.py`

### A5. Desktop shell is runnable or buildable

The desktop app must provide:

- Home page
- Overlay component
- Settings page
- Logs page
- Provider selector with health and warning display
- Editable provider settings with local save state and model selection persistence
- Result preview for provider-backed output
- AI run controls with mode selection and manual copy or paste-preview support
- Current context panel with safe preview labels and refresh support

The `Ctrl + Alt + A` shortcut may only trigger a placeholder overlay in Phase 1G.

### A6. Setup scripts are usable

Required scripts:

- `scripts/install-backend.ps1`
- `scripts/install-desktop.ps1`
- `scripts/dev-start.ps1`
- `scripts/health-check.ps1`

### A7. Documentation is complete and aligned

Required docs:

- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/SAFETY_RULES.md`
- `docs/ACTION_SCHEMA.md`
- `docs/MVP_ACCEPTANCE_CRITERIA.md`

These docs must match the current `apps/*` structure and must not promise forbidden Phase 1G behavior.

### A8. Safety restrictions are preserved

The codebase must not include Phase 1G features for:

- destructive automation
- terminal command execution
- secret storage
- payment
- email sending
- file deletion
- system-control actions
- automatic screenshot transmission

### A9. Screenshot capture is optional and disabled by default

The backend must:

- return screenshot status in `/context/current`
- default screenshot capture to disabled
- return warnings instead of crashing if screenshot capture fails

### A10. Selected-text capture is hardened and disabled by default

The backend must:

- keep selected-text capture disabled by default
- preserve or restore clipboard state when possible
- return failure warnings without crashing the route
- expose only preview and length in `/context/current`

### A11. Prompt safety is enforced

The backend must:

- redact common secret patterns before prompt construction
- enforce configured prompt and context length limits
- refuse unsafe requests such as deletion, command execution, payments, or direct app control
- exclude screenshot payloads from model prompts

### A12. Provider failures are graceful

The backend must:

- return normalized provider error payloads
- avoid leaking API keys in responses
- pass tests without Ollama or LM Studio running
- allow `/models/settings` to fall back to defaults when the runtime file is missing or invalid
- allow `/models/providers` to surface offline or unconfigured providers without crashing
- return useful Arabic setup guidance when no provider is reachable
- return a clear `model_not_found` status with a safe install hint when the provider is reachable but the requested model is not installed
- keep `/models/test` free of clipboard, selected-text, and screenshot context

### A13. Arabic renderer polish is complete

The desktop renderer must:

- use Arabic as the primary visible UI language
- set the document to RTL
- apply the Estedad-centered font stack with Arabic fallbacks
- keep technical values readable in LTR where needed
- preserve the Phase 1G preview-only AI behavior without adding unsafe automation
- expose Arabic provider readiness, discovered models, editable persisted settings, setup guidance, and safe provider testing in Settings

## Verification Commands

Suggested checks:

```powershell
npm run install:all
npm run dev:backend
npm run health
cd apps/backend
.venv\Scripts\python.exe -m pytest
cd ..\desktop
npm run build
```

Manual checks:

- open the desktop shell
- confirm routing between Home, Settings, and Logs
- confirm context panel labels remain stable
- confirm screenshot status is visible and disabled by default
- confirm `/models/settings` reads and saves safe provider preferences
- confirm `/models/providers` shows safe provider metadata
- confirm `/models/test` performs a safe prompt without desktop context
- confirm `/agent/run` returns preview-only output and graceful offline or timeout errors
- confirm docs are non-empty and consistent

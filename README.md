# Abud OmniAgent

**Important: This is a Desktop-first project.** 
This project must remain a Windows-first desktop tool, not a VPS web deployment and not a normal SaaS web app. The browser URL / Vite preview is only for local renderer development. The real product direction is an Electron desktop app with a local FastAPI backend. Release means a Windows desktop packaging/installer.

Abud OmniAgent is a Windows-first desktop assistant scaffold built as an Electron + React + TypeScript desktop app with a Python FastAPI backend. The current project state focuses on safe local context capture, preview-only model routing, persisted non-secret provider settings, a bilingual Arabic/English desktop interface, local runtime visibility, and explicit approval before any paste action.

## Current Phase

**Post-Phase 3E Master Hardening - Branding, Bilingual UI, Theme, Help, Services Clarity, and Final Internal Release Polish**

Status: `Implemented at the code/build/package level; human GUI verification bundle still pending`

Phase 1G was completed using LM Studio with the model `google/gemma-4-e2b` at `http://127.0.0.1:1234/v1`. Phase 1H stabilized the preview-only MVP. Phase 2A introduced approval-based copy and paste text actions. Phase 2B turned the app into a practical overlay-based assistant that can be opened with `Ctrl + Alt + A` above any active app. Phase 2C is accepted complete: it captures the previous active target app/window before the overlay takes focus, displays the target context separately from the current context, and hardens the approval-based paste workflow. The packaged Windows desktop app bundles and auto-starts its own local backend runtime for normal local use. Phase 3A adds a safe local workspace for notes, tasks, manually saved AI results, and lightweight local history review. Phase 3E completed the technical onboarding/readiness surfaces. The current master hardening pass adds real packaging icon assets, a bilingual Arabic/English UI switch, theme preferences, an in-app Help page, clearer Services/technology explanations, and additional read-only tester surfaces. No browser automation, no app control, no terminal execution, no destructive actions.

Current scope:

- safe local Windows context capture
- real text-only model execution through the provider router
- persisted non-secret provider settings and model selection
- live end-to-end provider validation when a real provider is available
- provider selection, health surfacing, and warning display
- dedicated Services page for backend runtime visibility, provider diagnostics, and startup runbook
- in-app Help page with first-run guidance, troubleshooting notes, release notes, and safety boundaries
- bilingual Arabic/English UI with local language switching and automatic RTL/LTR updates
- local-only theme preference (`dark` / `light` / `system`)
- persisted last provider test metadata with Arabic summaries across Settings/Home
- LM Studio و Ollama guidance panels with Arabic troubleshooting steps
- prompt truncation and context redaction before model calls
- Arabic-first desktop UI text
- explicit user approval before copy and paste text actions
- safe action preview, confirmation, and logging without full payload text
- refusal of destructive or system-control requests
- compact Arabic RTL overlay window triggered by a global hotkey
- overlay target context captured before the overlay takes focus where possible
- separate display of target context (captured before opening) and current context (refreshed while open)
- overlay context refresh, AI instruction, result preview, and copy/paste-approval workflow
- overlay session persistence restores the last draft/result safely with a manual "مسح الجلسة" control and clearer paste-approval banner that requires explicit cursor confirmation
- RTL renderer layout and LTR preservation for technical values
- Estedad-based font stack with Arabic fallbacks
- selected-text hardening with clipboard restoration safeguards
- optional screenshot metadata capture disabled by default
- desktop UI shell, context display, and AI result preview
- local workspace page for notes, tasks, and manually saved AI results
- selected-input surface on Home for pasted text or explicit plaintext file import (Phase 3C)
- safe prompt starter templates for common manual text tasks
- internal tester command-center cards and a manual verification checklist UI
- provider readiness score and internal release-readiness panel on Services
- centralized services/operations surface for backend health, runtime mode, capture-feature visibility, provider diagnostics, and local runtime file paths
- safety constraints and product docs

Out of scope in Phase 1G:

- browser automation
- terminal command execution features
- destructive or system-control actions
- auto-paste or cross-app clicking
- screenshot transmission to model providers

Desktop UI note:

- the renderer defaults to Arabic-first, with a user-facing switch to English in Settings
- the document updates `lang` and `dir` dynamically (`ar` => `rtl`, `en` => `ltr`)
- the primary UI font is `Estedad` with `Tajawal`, `Vazirmatn`, `Noto Naskh Arabic`, and `Rubik` fallbacks
- theme preference (`dark`, `light`, or `system`) is stored in renderer `localStorage` only
- technical values such as model ids, versions, process names, and URLs remain readable in LTR
- provider setup, readiness messaging, Services explanations, and Help content are available in Arabic and English
- provider settings are stored only in `apps/backend/runtime/provider_settings.json` and only for non-secret fields
- provider tests never send desktop context, clipboard, selected text, or screenshots
- if no provider is running, the app remains usable and returns graceful Arabic setup guidance
- local providers such as Ollama and LM Studio must be running separately before a real test can succeed

## Provider Setup Checklist

To get a real AI completion, one of the following providers must be reachable:

**Ollama**

1. Install Ollama from <https://ollama.com> and start it.
2. Install a model, for example: `ollama pull llama3.2`
3. Open the app Settings, select `Ollama`, and press `اختبار المزود`.
4. Go to Home and run a short Arabic prompt to confirm real output.

**LM Studio**

1. Open LM Studio manually.
2. Load or select the model you want to use (e.g. `google/gemma-4-e2b`).
3. Start the Local Server in LM Studio.
4. Confirm the Local Server base URL is exactly `http://127.0.0.1:1234/v1`.
5. Open Abud OmniAgent Settings.
6. Choose `LM Studio` as the active provider.
7. Enter the exact model name shown in LM Studio.
8. Press `اختبار المزود` (Test Provider) and wait for a successful response.
9. Use the Home composer after the provider test succeeds.

**OpenAI-compatible**

1. Set `OPENAI_COMPATIBLE_BASE_URL` and `OPENAI_COMPATIBLE_MODEL` in Settings.
2. Put the API key in an environment variable only (default `OPENAI_COMPATIBLE_API_KEY`).
3. Never paste the key into the app.

Phase 1G is considered 100% complete only after a real provider responds successfully through both `/models/test` and `/agent/run`. This was achieved with LM Studio using `google/gemma-4-e2b`.

## Project Structure

```text
Abud OmniAgent/
├── apps/
│   ├── backend/   # FastAPI service and local context capture pipeline
│   └── desktop/   # Electron + React + TypeScript shell
├── docs/          # Product, architecture, roadmap, safety, schema, acceptance docs
├── scripts/       # Windows setup and health scripts
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── STATUS.md
```

## Prerequisites

- Node.js 18+
- npm 9+
- Python 3.11+
- Windows 10 or Windows 11

## Install

### 1. Windows Desktop Application (Recommended)
This is the primary way to use Abud OmniAgent.
1. The Windows installer is generated in `apps/desktop/release/Abud OmniAgent Setup 0.1.0.exe`.
2. Double-click the installer to install the application.
3. Once installed, launch "Abud OmniAgent" from your Start Menu.
4. *Note: You do not need to use a browser. The application runs entirely on your desktop.*

### 2. Local Development (For Developers)
From the project root:

```powershell
npm run install:all
```

Manual install commands:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-backend.ps1
powershell -ExecutionPolicy Bypass -File scripts/install-desktop.ps1
```

## Run

**Important**: The browser preview (`http://localhost:3100`) is *only* for local renderer development and is not the final product.

Start both services for development:

```powershell
npm run dev
```

Start them separately:

```powershell
npm run dev:backend
npm run dev:desktop
```

The desktop hotkey placeholder is `Ctrl + Alt + A`.

## Release Packaging

Desktop build only:

```powershell
npm run build:desktop
```

Desktop packaging:

```powershell
npm run package:desktop
```

Expected output:

- renderer build: `apps/desktop/dist/`
- Electron main build: `apps/desktop/dist-electron/`
- Windows installer artifacts: `apps/desktop/release/`

Installed app runtime behavior:

- The packaged Windows app includes a bundled local backend executable.
- On packaged Windows builds, the Electron app attempts to start its own local backend automatically on `http://127.0.0.1:8000`.
- The bundled backend stores its writable runtime files under the app user-data directory, for example `AppData\Roaming\abud-omniagent-desktop\backend\`.
- LM Studio is not bundled into the installer and must still be started separately when the user wants real local model execution through LM Studio.
- Ollama models are not bundled or downloaded automatically; install them manually before use.
- During development, the backend still runs separately via `npm run dev:backend`.
- Current distribution state: packaging succeeds with a real app icon in `apps/desktop/build/icon.ico`, but the installer remains unsigned and all interactive GUI checks remain manual human QA items.

Selected-input workflow (Phase 3C):

- Open the "ملخص الإدخال المحدد" section on Home.
- Choose between the manual paste tab or the file tab.
- Pasted text requires manual input only; the app never scrapes the clipboard automatically.
- File import accepts `.txt`, `.md`, `.json`, or `.csv` up to ~64 KB using the standard file picker; unsupported or oversized files show Arabic warnings.
- Review the in-app preview (file name, extension, size, and text) before running any action.
- Pick an action (summarize, rewrite, classify, extract key points) and click "تشغيل المعالجة" to invoke `/agent/selected-input`.
- Results appear in the existing preview panel where you can optionally click "حفظ النتيجة" to store the AI output and safe metadata (input type, file name, size, extension). No original file bytes are stored.

Workspace workflow:

- Open the `مساحة العمل` page from the sidebar to manage local notes, tasks, and saved AI results.
- Notes and tasks are created and edited locally inside the app.
- AI results are saved only when the user explicitly clicks `حفظ النتيجة`.
- Search, pin, archive, and task completion all apply only to in-app workspace records.
- Workspace storage remains local-only in the backend SQLite runtime area; nothing is synced automatically.

Services workflow:

- Open the `الخدمات` page from the sidebar to inspect backend runtime state, active provider readiness, diagnostics history, and the local startup runbook.
- The Services page reuses existing provider diagnostics and remains read-only; it never starts LM Studio or Ollama automatically and never runs provider tests without your explicit click elsewhere.
- Runtime file paths shown there are local-only operational metadata so internal testers know where the SQLite DB and provider settings/history live.
- The Services page also explains the local-vs-external runtime split, the technologies used by the product, the internal release-readiness state, and what the app never does.

Help workflow:

- Open `المساعدة` / `Help` from the sidebar to view the built-in Help page.
- The Help page is display-only and includes a first-run checklist, provider troubleshooting, Services-page explanation, the manual GUI verification bundle, installer/internal release notes, and the active safety boundaries.
- The Help page never launches providers, never executes commands, and never writes backend state.

Icon packaging:

- Real icon assets are committed under `apps/desktop/build/`:
  - `icon.svg`
  - `icon.png`
  - `icon.ico`
- Electron Builder is configured to package `build/icon.ico` for Windows builds.
- Development windows also point at the local build icon when the asset is available.

Signing expectation:

- Code signing is not configured yet.
- Packaging is still expected to succeed without signing.
- Do not store signing secrets or fake credentials in the repo.
- Unsigned installers should be treated as a known release limitation until real signing is configured.

Release runbook:

1. Run backend tests: `npm run test:backend`
2. Build the desktop app: `npm run build:desktop`
3. Package the bundled backend plus Windows installer: `npm run package:desktop`
4. Check `apps/backend/dist/` for `AbudOmniAgentBackend.exe`
5. Check `apps/desktop/release/` for the installer, unpacked app, and builder metadata
6. Launch the packaged app and confirm `http://127.0.0.1:8000/health` becomes available without starting the backend manually
7. Treat missing code signing as non-blocking until real certificates are provided out of band
8. Keep the human GUI verification bundle pending until a real person confirms onboarding, Services, Help, Workspace, overlay, language, theme, and icon behavior in the packaged app

## Health Check

```powershell
npm run health
```

## Backend Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Backend status, phase, version, uptime |
| `GET` | `/context/current` | Real active-window metadata, clipboard preview, selected-text status, screenshot status |
| `POST` | `/agent/run` | Safe preview-only model execution using redacted local context |
| `GET` | `/models/settings` | Safe persisted provider settings without secrets |
| `POST` | `/models/settings` | Save safe provider settings and model selection without secrets |
| `GET` | `/models/providers` | Safe provider status, model selection, health, and warnings |
| `POST` | `/models/test` | Safe provider readiness test without desktop context |
| `POST` | `/actions/preview` | Create a safe action preview (no execution) |
| `POST` | `/actions/confirm` | Confirm or cancel a previously previewed action |
| `POST` | `/actions/copy` | Copy text to clipboard after user click |
| `POST` | `/actions/paste-preview` | Return a safe paste preview only |
| `GET` | `/logs` | Recent system logs and safe action metadata |


## Safety Notes

- No terminal command execution features are included.
- No file deletion, payment, email sending, or system-control actions are included.
- No API keys or secrets should be committed.
- The runtime settings file under `apps/backend/runtime/` is for non-secret provider preferences only and is git-ignored.
- OpenAI-compatible API keys are read from environment variables only and are never returned by provider endpoints.
- OpenAI-compatible configuration may expose only the environment variable name, never the secret value itself.
- Selected-text capture is disabled by default and uses clipboard restoration safeguards when enabled.
- Screenshot capture is disabled by default and does not send raw image data to AI providers.
- Provider setup and provider tests are preview-only and do not send desktop context to `/models/test`.
- `/models/settings` rejects secret-like fields such as `api_key`, `token`, `password`, or `secret`.
- The Home screen and Settings screen remain preview-only; no auto-paste or cross-app control is performed.
- Phase 2A adds explicit user approval before copy and paste actions. Paste uses Ctrl+V only after the user clicks "تأكيد اللصق" and places the cursor in the target field.
- Action logs store only metadata (type, status, risk level, payload length) by default; full payload text is never logged unless explicitly enabled.
- The AI agent continues to refuse instructions that request file deletion, command execution, messaging, payments, or system changes.
- Phase 2B added a global overlay window opened with `Ctrl + Alt + A`. The overlay floats above other apps using `alwaysOnTop` and is hidden with `Escape` or the close button. It does not click or control other windows.
- Phase 2C improves the overlay by capturing the target context before the overlay takes focus. The captured target context is passed to the overlay and displayed separately from the current context.
- The target context shows the previous active window title, process name, process ID, and capture time where available. If the overlay itself is captured, a clear Arabic warning is shown.
- The overlay can still refresh the current context (`GET /context/current`) while open; the current context may show the overlay itself because it is now the foreground window.
- Paste inside the overlay still uses the existing `/actions/preview` + `/actions/confirm` flow and only sends `Ctrl+V` after explicit user confirmation. The confirmation panel warns the user to place the cursor in the target app before confirming.
- The app does not focus, click, or control target applications automatically.
- The app never starts LM Studio or Ollama automatically and never downloads models automatically.
- Language/theme preferences are renderer-local only and are not stored in the backend.

See the detailed rules in [docs/SAFETY_RULES.md](./docs/SAFETY_RULES.md).

## Global Hotkey

- `Ctrl + Alt + A` — open or focus the compact overlay.
- `Escape` — hide the overlay.

## Documentation

- [docs/PRODUCT_SPEC.md](./docs/PRODUCT_SPEC.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/ROADMAP.md](./docs/ROADMAP.md)
- [docs/SAFETY_RULES.md](./docs/SAFETY_RULES.md)
- [docs/ACTION_SCHEMA.md](./docs/ACTION_SCHEMA.md)
- [docs/MVP_ACCEPTANCE_CRITERIA.md](./docs/MVP_ACCEPTANCE_CRITERIA.md)

## Next Step

Run **Post-Phase 3E Runtime QA + Acceptance Gate - Master Hardening Bundle**: perform the real human GUI verification pass for onboarding, manual-start guidance, Services, Help page, language/theme switching, icon visibility, Workspace smoke, and the existing overlay/manual file-picker checklist, then record results in `STATUS.md`.

# OmniAgent - Roadmap

Version: `0.1.0`
Updated: `2026-06-22`

## Phase 0 - Project Foundation

Status: `Completed`

Deliverables:

- root project metadata and scripts
- Electron + React desktop shell
- FastAPI backend scaffold
- placeholder API contract
- product, architecture, safety, schema, and acceptance documentation
- root `STATUS.md`

Exit criteria:

- backend starts
- `GET /health` works
- desktop shell starts or builds
- required docs exist and are usable
- scripts are valid for a new machine setup

## Phase 1 - Context Engine

Status: `Completed`

Delivered:

- real active window capture
- real clipboard read support
- guarded selected text capture
- optional screenshot metadata capture
- controlled provider-backed text generation
- Arabic-first desktop UI copy
- RTL renderer layout
- Estedad-based font system with Arabic fallbacks
- Arabic provider readiness and setup UX
- safe provider health checks, discovery, and test prompts
- persisted non-secret provider settings and saved model selection
- end-to-end provider QA when a real provider is available
- context aggregation performance and reliability
- clear Arabic setup guidance when no local provider is reachable

Phase 1G was completed end-to-end using LM Studio with the model `google/gemma-4-e2b` at `http://127.0.0.1:1234/v1`. Both `/models/test` and `/agent/run` returned real provider output.

## Phase 1H - Preview MVP Stabilization + Release Readiness

Status: `Completed`

Focus:

- Arabic startup guidance for LM Studio in Settings and README
- provider readiness banner in Settings (active provider, active model, test status)
- packaging metadata (author, product name, appId) for cleaner Windows builds
- desktop packaging QA: dev server, build, installer output
- safety verification: no auto-paste, no screenshot sending, no secrets in runtime settings
- logs page placeholder clarified to show only safe system activity

Exit criteria:

- backend tests pass
- desktop build passes with no missing-author warning
- `npm run health` passes
- `/models/test` and `/agent/run` return real output when LM Studio is running, or clear Arabic offline guidance when it is not
- no extra status/report files
- no secrets exposed

Guardrails:

- keep all context capture local
- preserve approval and audit boundaries
- do not advance to Phase 2 automatically

## Phase 2 - Approval And Action System

Status: `In progress (Phase 2C)`

### Phase 2A - Approval-Based Text Actions

Status: `Completed`

- approval-based text actions: copy and paste only
- safe action preview, confirmation, and metadata-only logging

### Phase 2B - Global Overlay Workflow + Active App Text Assistant

Status: `Completed`

- `Ctrl + Alt + A` opens a compact Arabic RTL overlay above any active app
- separate always-on-top frameless window, hidden with `Escape`
- overlay displays active app/window context safely
- overlay reuses `ProviderSelector`, `ActionButtons`, and `ResultPreview`
- user can refresh context, write instructions, run AI, and manually copy or approve paste
- paste still requires explicit preview + confirm flow
- continued refusal of destructive, system, terminal, and browser automation requests

### Phase 2C - Overlay Target Capture + UX Reliability

Status: `In progress`

Focus:

- capture the previous active target context before the overlay takes focus
- pass the target context into the overlay via IPC and display it separately from current context
- show target app/window, process name, process ID, and capture time in Arabic RTL
- warn the user when the overlay itself is captured as the target
- keep current-context refresh separate so it can show the overlay as the active window
- improve paste confirmation copy with a clear cursor-placement warning
- add `target_hint`, `target_window_title`, `target_process_name`, and `target_captured_at` to action previews and logs
- harden overlay hotkey focus/hide behavior and main-window close handling
- overlay UX polish: compact loading/error states, provider/model line, action status banner, hide hint

Exit criteria:

- backend tests pass
- desktop build passes
- overlay target context is captured before focus and displayed in Arabic
- target context and current context are clearly separated
- paste still requires explicit confirmation and shows target hint
- action logs include target metadata but not full payload text by default
- no TypeScript errors
- no secrets are logged or exposed
- no window control or automation beyond the overlay itself

### Later Phase 2 work

- broader action schemas if needed
- richer audit trails
- additional low-risk text actions

Guardrails:

- no hidden execution paths
- no destructive actions without explicit policy and UX
- no browser automation or arbitrary app control

## Phase 3 - Workflow Integration

Planned focus:

- richer overlay behavior
- tighter desktop-to-backend UX
- provider and history refinement
- approval flows for future safe actions

## Phase 4 - Advanced Features

Planned focus:

- broader context sources
- stronger history and search
- safer extensibility for future controlled actions

## Roadmap Rules

- Do not advance to the next phase by silently expanding scope in the current one.
- Every phase must preserve the safety rules from earlier phases.
- `STATUS.md` is the source of truth for current completion, not this roadmap file.

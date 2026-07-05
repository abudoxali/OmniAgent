# AI Agent Prompt: abud-omniagent

> **Note:** This prompt provides general project context for continuing development. For a focused fix-oriented prompt, see `AGENT_FIX_PROMPT.md`.

Use this deterministic project intelligence before making changes.

## Project Context

- Project type: full-stack-app
- Languages: Python, TypeScript, JSON, Markdown, HTML, CSS, JavaScript
- Frameworks and tools: FastAPI, React, React Router, Vite
- Package manager: npm
- Monorepo: yes
- Workspace manager: unknown
- Python detected: yes
- Architecture style: workspace full-stack monorepo
- Config output directory: .reporadar
- Health endpoint: /health
- Health score: 35/100

## Entrypoints

- apps/backend/api/actions.py - Streamlit app hints detected in file.
- apps/backend/api/agent.py - Streamlit app hints detected in file.
- apps/backend/api/models.py - Streamlit app hints detected in file.
- apps/backend/api/workspace.py - Streamlit app hints detected in file.
- apps/backend/main.py - FastAPI app instance detected in file.
- apps/backend/model_router/router.py - Streamlit app hints detected in file.
- apps/backend/storage/db.py - Streamlit app hints detected in file.
- apps/backend/tests/test_actions_phase2a.py - Streamlit app hints detected in file.
- apps/backend/tests/test_agent_phase1c.py - Streamlit app hints detected in file.
- apps/backend/tests/test_context.py - Streamlit app hints detected in file.
- apps/backend/tests/test_health.py - Streamlit app hints detected in file.
- apps/backend/tests/test_models_phase1c.py - Streamlit app hints detected in file.
- apps/backend/tests/test_provider_settings_phase1f.py - Streamlit app hints detected in file.
- apps/backend/tests/test_router_phase1c.py - Streamlit app hints detected in file.
- apps/backend/tests/test_workspace.py - Streamlit app hints detected in file.

## Routes

- POST /actions/preview (FastAPI)
- POST /actions/confirm (FastAPI)
- POST /actions/copy (FastAPI)
- POST /actions/paste-preview (FastAPI)
- GET /actions/logs (FastAPI)
- POST /agent/run (FastAPI)
- POST /agent/selected-input (FastAPI)
- GET /context/current (FastAPI)
- GET /health (FastAPI)
- GET /logs (FastAPI)
- GET /models/settings (FastAPI)
- GET /models/providers (FastAPI)
- GET /models/diagnostics (FastAPI)
- POST /models/settings (FastAPI)
- POST /models/test (FastAPI)
- GET /workspace/notes (FastAPI)
- POST /workspace/notes (FastAPI)
- PATCH /workspace/notes/{item_id} (FastAPI)
- POST /workspace/notes/{item_id}/pin (FastAPI)
- POST /workspace/notes/{item_id}/archive (FastAPI)
- GET /workspace/tasks (FastAPI)
- POST /workspace/tasks (FastAPI)
- PATCH /workspace/tasks/{item_id} (FastAPI)
- POST /workspace/tasks/{item_id}/pin (FastAPI)
- POST /workspace/tasks/{item_id}/archive (FastAPI)
- GET /workspace/results (FastAPI)
- POST /workspace/results (FastAPI)
- POST /workspace/results/{item_id}/pin (FastAPI)
- POST /workspace/results/{item_id}/archive (FastAPI)
- GET /workspace/search (FastAPI)
- unknown / (React Router JSX)
- unknown /services (React Router JSX)
- unknown /workspace (React Router JSX)
- unknown /settings (React Router JSX)
- unknown /logs (React Router JSX)
- unknown /help (React Router JSX)

## Layers

- api: apps/backend/api/__init__.py, apps/backend/api/actions.py, apps/backend/api/agent.py, apps/backend/api/context.py
- config: apps/backend/config.py, apps/backend/runtime/provider_settings.json, apps/backend/runtime/provider_tests.json, apps/desktop/package-lock.json
- database: apps/backend/api/models.py
- docs: README.md, STATUS.md, docs/ACTION_SCHEMA.md, docs/ARCHITECTURE.md
- frontend: apps/desktop/src/App.tsx, apps/desktop/src/components/ActionButtons.tsx, apps/desktop/src/components/CommandCenterCards.tsx, apps/desktop/src/components/HealthIndicator.tsx
- scripts: scripts/dev-start.ps1, scripts/health-check.ps1, scripts/install-backend.ps1, scripts/install-desktop.ps1
- unknown: apps/backend/main.py, apps/backend/model_router/router.py, apps/backend/storage/db.py, apps/backend/tests/test_actions_phase2a.py

## Data Models

- PreviewRequest (SQLAlchemy Model)
- ConfirmRequest (SQLAlchemy Model)
- LegacyCopyRequest (SQLAlchemy Model)
- LegacyPastePreviewRequest (SQLAlchemy Model)
- PreviewRequest (Pydantic Model)
- ConfirmRequest (Pydantic Model)
- LegacyCopyRequest (Pydantic Model)
- LegacyPastePreviewRequest (Pydantic Model)
- AgentRunRequest (SQLAlchemy Model)
- SelectedInputRequest (SQLAlchemy Model)
- AgentRunRequest (Pydantic Model)
- SelectedInputRequest (Pydantic Model)
- ProviderTestRequest (SQLAlchemy Model)
- ProviderSettingsUpdateRequest (SQLAlchemy Model)
- ProviderTestRequest (Pydantic Model)
- ProviderSettingsUpdateRequest (Pydantic Model)
- SafeWorkspaceModel (SQLAlchemy Model)
- SafeWorkspaceModel (Pydantic Model)
- ClipboardSnapshot (Python Dataclass)
- ProviderResult (Python Dataclass)
- OllamaProvider (SQLAlchemy Model)
- OpenAICompatibleProvider (SQLAlchemy Model)
- ExplodingProvider (SQLAlchemy Model)
- SanitizingProvider (SQLAlchemy Model)
- RecordingProvider (SQLAlchemy Model)
- TimeoutProvider (SQLAlchemy Model)
- MalformedProvider (SQLAlchemy Model)

## Environment Variable Names

- BACKEND_HOST
- BACKEND_PORT
- LOG_LEVEL
- DB_PATH
- PASTE_RESTORE_CLIPBOARD
- PASTE_DELAY_MS
- PASTE_PREVIEW_MAX_CHARS
- ACTION_LOG_CONTENT_ENABLED
- ENABLE_SELECTED_TEXT_CAPTURE
- CONTEXT_PREVIEW_MAX_CHARS
- CLIPBOARD_CAPTURE_ENABLED
- ACTIVE_WINDOW_CAPTURE_ENABLED
- SELECTED_TEXT_CAPTURE_TIMEOUT_MS
- SELECTED_TEXT_RESTORE_CLIPBOARD
- SELECTED_TEXT_PREVIEW_MAX_CHARS
- SCREENSHOT_CAPTURE_ENABLED
- SCREENSHOT_PREVIEW_ENABLED
- SCREENSHOT_SAVE_TEMP
- SCREENSHOT_MAX_WIDTH
- SCREENSHOT_FORMAT
- ACTIVE_PROVIDER
- ACTIVE_MODEL
- OLLAMA_BASE_URL
- OLLAMA_MODEL
- LMSTUDIO_BASE_URL
- LMSTUDIO_MODEL
- OPENAI_COMPATIBLE_BASE_URL
- OPENAI_COMPATIBLE_MODEL
- OPENAI_COMPATIBLE_API_KEY_ENV
- REQUEST_TIMEOUT_SECONDS
- PROVIDER_SETTINGS_PATH
- PROVIDER_TEST_HISTORY_PATH
- MAX_PROMPT_CHARS
- MAX_CONTEXT_CHARS
- VITE_DEV_SERVER_URL

## Module Resolution

- Alias config files: apps/desktop/tsconfig.json
- Alias patterns: none
- Base paths: apps/desktop (apps/desktop/tsconfig.json)

## Dependency Graph Summary

- Internal edges: 88
- External packages: __future__ (23), react (16), config (15), datetime (10), typing (10), fastapi (8), main (7), httpx (6), pathlib (5), pydantic (4)
- High fan-in files: apps/desktop/src/i18n/index.tsx (24), apps/desktop/src/lib/api.ts (8), apps/desktop/src/components/ActionButtons.tsx (6), apps/desktop/src/components/ProviderSelector.tsx (6), apps/backend/model_router/base.py (3)
- High fan-out files: apps/desktop/src/pages/HomePage.tsx (15), apps/backend/main.py (12), apps/backend/model_router/router.py (12), apps/desktop/src/App.tsx (11), apps/desktop/src/pages/OverlayPage.tsx (11)

## Architecture Risks

- WARNING: Large route surface without tests - Add smoke or integration tests around the primary route surface.
- WARNING: Monorepo layout lacks explicit workspace config - Add npm, pnpm, or yarn workspace config so tooling and contributors can resolve package boundaries reliably.
- INFO: Database layer lacks clear schema documentation - Document migrations, schema ownership, or data model conventions in README or dedicated docs.
- INFO: Larger project without CI - Add CI to run tests, lint, and build checks for repeatable validation.

## Current Issues

- No tests detected.
- No lint script found in package.json.
- No build script found in package.json.
- Potential hardcoded secret patterns detected.
- Monorepo-like structure detected without a clear workspace config.
- No deployment or CI signals were detected.

## Next Recommended Tasks

1. Add smoke tests or unit tests to increase confidence in future scans.
2. Review flagged files for secrets and rotate any exposed credentials.
3. Add or fix workspace configuration so the monorepo structure is explicit.
4. Add deployment config, CI workflows, or deployment docs to improve release readiness.
5. Add smoke or integration tests around the primary route surface.
6. Add npm, pnpm, or yarn workspace config so tooling and contributors can resolve package boundaries reliably.
7. Document migrations, schema ownership, or data model conventions in README or dedicated docs.
8. Add CI to run tests, lint, and build checks for repeatable validation.

## Config Constraints

- Include patterns: default full-repo scan
- Exclude patterns: .reporadar, .reporadar/**
- Max files: 5000
- Max file size KB: 512
- Config warnings: none

## Safe Constraints

- Maintain exactly one status file named `STATUS.md` in the project root.
- Do not expose secret values from env files or inline credentials.
- Run tests before reporting completion.
- Update README when behavior changes.
- Respect the existing structure before proposing large rewrites.
- Use detected scripts and config files as the primary source of truth.

---

Generated by **RepoRadar AI**  
Built by **Abed** for **abud.fun**  
https://github.com/3bud-ZC/RepoRadar-Ai

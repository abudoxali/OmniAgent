# Architecture: omniagent

## Architecture Summary

| Key | Value |
| --- | --- |
| Project Type | full-stack-app |
| Architecture Style | workspace full-stack monorepo |
| Entrypoints | 15 |
| Routes | 36 |
| Layers | 7 |
| Important Files | 20 |
| Health Endpoint | /health |
| Alias Patterns | 0 |

## Detected Project Style

- Detected 15 likely entrypoint(s).
- Detected 36 route or route-hint record(s).
- Detected 322 lightweight import record(s).
- Detected 0 workspace package relationship(s).
- Detected 0 alias pattern(s) from 1 config file(s).
- Resolved 88 internal import(s); 4 remained unresolved.
- Detected 1 base path hint(s) from tsconfig/jsconfig.

## Workspace Structure

- Monorepo: yes
- Workspace manager: not detected
- Apps: apps/backend, apps/desktop
- Packages: none
- Services: none
- Libraries: none

## Entrypoints

- apps/backend/api/actions.py [streamlit-app] - Streamlit app hints detected in file.
- apps/backend/api/agent.py [streamlit-app] - Streamlit app hints detected in file.
- apps/backend/api/models.py [streamlit-app] - Streamlit app hints detected in file.
- apps/backend/api/workspace.py [streamlit-app] - Streamlit app hints detected in file.
- apps/backend/main.py [fastapi-app] - FastAPI app instance detected in file.
- apps/backend/model_router/router.py [streamlit-app] - Streamlit app hints detected in file.
- apps/backend/storage/db.py [streamlit-app] - Streamlit app hints detected in file.
- apps/backend/tests/test_actions_phase2a.py [streamlit-app] - Streamlit app hints detected in file.
- apps/backend/tests/test_agent_phase1c.py [streamlit-app] - Streamlit app hints detected in file.
- apps/backend/tests/test_context.py [streamlit-app] - Streamlit app hints detected in file.
- apps/backend/tests/test_health.py [streamlit-app] - Streamlit app hints detected in file.
- apps/backend/tests/test_models_phase1c.py [streamlit-app] - Streamlit app hints detected in file.
- apps/backend/tests/test_provider_settings_phase1f.py [streamlit-app] - Streamlit app hints detected in file.
- apps/backend/tests/test_router_phase1c.py [streamlit-app] - Streamlit app hints detected in file.
- apps/backend/tests/test_workspace.py [streamlit-app] - Streamlit app hints detected in file.

## Module Resolution

- Alias config files: apps/desktop/tsconfig.json
- Alias patterns: none
- Base paths: apps/desktop (apps/desktop/tsconfig.json)
- Detected 0 alias pattern(s) from 1 config file(s).
- Resolved 88 internal import(s); 4 remained unresolved.
- Detected 1 base path hint(s) from tsconfig/jsconfig.

## Layer Map

- api: apps/backend/api/__init__.py, apps/backend/api/actions.py, apps/backend/api/agent.py, apps/backend/api/context.py, apps/backend/api/health.py
- config: apps/backend/config.py, apps/backend/runtime/provider_settings.json, apps/backend/runtime/provider_tests.json, apps/desktop/package-lock.json, apps/desktop/package.json
- database: apps/backend/api/models.py
- docs: README.md, STATUS.md, docs/ACTION_SCHEMA.md, docs/ARCHITECTURE.md, docs/MVP_ACCEPTANCE_CRITERIA.md
- frontend: apps/desktop/src/App.tsx, apps/desktop/src/components/ActionButtons.tsx, apps/desktop/src/components/CommandCenterCards.tsx, apps/desktop/src/components/HealthIndicator.tsx, apps/desktop/src/components/ManualVerificationChecklist.tsx
- scripts: scripts/dev-start.ps1, scripts/health-check.ps1, scripts/install-backend.ps1, scripts/install-desktop.ps1, scripts/package-backend.ps1
- unknown: apps/backend/main.py, apps/backend/model_router/router.py, apps/backend/storage/db.py, apps/backend/tests/test_actions_phase2a.py, apps/backend/tests/test_agent_phase1c.py

## Routes And API Surface

- POST /actions/preview (FastAPI) in apps/backend/api/actions.py
- POST /actions/confirm (FastAPI) in apps/backend/api/actions.py
- POST /actions/copy (FastAPI) in apps/backend/api/actions.py
- POST /actions/paste-preview (FastAPI) in apps/backend/api/actions.py
- GET /actions/logs (FastAPI) in apps/backend/api/actions.py
- POST /agent/run (FastAPI) in apps/backend/api/agent.py
- POST /agent/selected-input (FastAPI) in apps/backend/api/agent.py
- GET /context/current (FastAPI) in apps/backend/api/context.py
- GET /health (FastAPI) in apps/backend/api/health.py
- GET /logs (FastAPI) in apps/backend/api/logs.py
- GET /models/settings (FastAPI) in apps/backend/api/models.py
- GET /models/providers (FastAPI) in apps/backend/api/models.py
- GET /models/diagnostics (FastAPI) in apps/backend/api/models.py
- POST /models/settings (FastAPI) in apps/backend/api/models.py
- POST /models/test (FastAPI) in apps/backend/api/models.py
- GET /workspace/notes (FastAPI) in apps/backend/api/workspace.py
- POST /workspace/notes (FastAPI) in apps/backend/api/workspace.py
- PATCH /workspace/notes/{item_id} (FastAPI) in apps/backend/api/workspace.py
- POST /workspace/notes/{item_id}/pin (FastAPI) in apps/backend/api/workspace.py
- POST /workspace/notes/{item_id}/archive (FastAPI) in apps/backend/api/workspace.py
- GET /workspace/tasks (FastAPI) in apps/backend/api/workspace.py
- POST /workspace/tasks (FastAPI) in apps/backend/api/workspace.py
- PATCH /workspace/tasks/{item_id} (FastAPI) in apps/backend/api/workspace.py
- POST /workspace/tasks/{item_id}/pin (FastAPI) in apps/backend/api/workspace.py
- POST /workspace/tasks/{item_id}/archive (FastAPI) in apps/backend/api/workspace.py
- GET /workspace/results (FastAPI) in apps/backend/api/workspace.py
- POST /workspace/results (FastAPI) in apps/backend/api/workspace.py
- POST /workspace/results/{item_id}/pin (FastAPI) in apps/backend/api/workspace.py
- POST /workspace/results/{item_id}/archive (FastAPI) in apps/backend/api/workspace.py
- GET /workspace/search (FastAPI) in apps/backend/api/workspace.py
- unknown / (React Router JSX) in apps/desktop/src/App.tsx
- unknown /services (React Router JSX) in apps/desktop/src/App.tsx
- unknown /workspace (React Router JSX) in apps/desktop/src/App.tsx
- unknown /settings (React Router JSX) in apps/desktop/src/App.tsx
- unknown /logs (React Router JSX) in apps/desktop/src/App.tsx
- unknown /help (React Router JSX) in apps/desktop/src/App.tsx

## Data Models

- PreviewRequest (SQLAlchemy Model) in apps/backend/api/actions.py
- ConfirmRequest (SQLAlchemy Model) in apps/backend/api/actions.py
- LegacyCopyRequest (SQLAlchemy Model) in apps/backend/api/actions.py
- LegacyPastePreviewRequest (SQLAlchemy Model) in apps/backend/api/actions.py
- PreviewRequest (Pydantic Model) in apps/backend/api/actions.py
- ConfirmRequest (Pydantic Model) in apps/backend/api/actions.py
- LegacyCopyRequest (Pydantic Model) in apps/backend/api/actions.py
- LegacyPastePreviewRequest (Pydantic Model) in apps/backend/api/actions.py
- AgentRunRequest (SQLAlchemy Model) in apps/backend/api/agent.py
- SelectedInputRequest (SQLAlchemy Model) in apps/backend/api/agent.py
- AgentRunRequest (Pydantic Model) in apps/backend/api/agent.py
- SelectedInputRequest (Pydantic Model) in apps/backend/api/agent.py
- ProviderTestRequest (SQLAlchemy Model) in apps/backend/api/models.py
- ProviderSettingsUpdateRequest (SQLAlchemy Model) in apps/backend/api/models.py
- ProviderTestRequest (Pydantic Model) in apps/backend/api/models.py
- ProviderSettingsUpdateRequest (Pydantic Model) in apps/backend/api/models.py
- SafeWorkspaceModel (SQLAlchemy Model) in apps/backend/api/workspace.py
- SafeWorkspaceModel (Pydantic Model) in apps/backend/api/workspace.py
- ClipboardSnapshot (Python Dataclass) in apps/backend/context_engine/clipboard.py
- ProviderResult (Python Dataclass) in apps/backend/model_router/base.py
- OllamaProvider (SQLAlchemy Model) in apps/backend/model_router/ollama_provider.py
- OpenAICompatibleProvider (SQLAlchemy Model) in apps/backend/model_router/openai_compatible_provider.py
- ExplodingProvider (SQLAlchemy Model) in apps/backend/tests/test_router_phase1c.py
- SanitizingProvider (SQLAlchemy Model) in apps/backend/tests/test_router_phase1c.py
- RecordingProvider (SQLAlchemy Model) in apps/backend/tests/test_router_phase1c.py
- TimeoutProvider (SQLAlchemy Model) in apps/backend/tests/test_router_phase1c.py
- MalformedProvider (SQLAlchemy Model) in apps/backend/tests/test_router_phase1c.py

## Environment Variable Names

- BACKEND_HOST used in apps/backend/config.py via os.getenv
- BACKEND_PORT used in apps/backend/config.py via os.getenv
- LOG_LEVEL used in apps/backend/config.py via os.getenv
- DB_PATH used in apps/backend/config.py via os.getenv
- PASTE_RESTORE_CLIPBOARD used in apps/backend/config.py via os.getenv
- PASTE_DELAY_MS used in apps/backend/config.py via os.getenv
- PASTE_PREVIEW_MAX_CHARS used in apps/backend/config.py via os.getenv
- ACTION_LOG_CONTENT_ENABLED used in apps/backend/config.py via os.getenv
- ENABLE_SELECTED_TEXT_CAPTURE used in apps/backend/config.py via os.getenv
- CONTEXT_PREVIEW_MAX_CHARS used in apps/backend/config.py via os.getenv
- CLIPBOARD_CAPTURE_ENABLED used in apps/backend/config.py via os.getenv
- ACTIVE_WINDOW_CAPTURE_ENABLED used in apps/backend/config.py via os.getenv
- SELECTED_TEXT_CAPTURE_TIMEOUT_MS used in apps/backend/config.py via os.getenv
- SELECTED_TEXT_RESTORE_CLIPBOARD used in apps/backend/config.py via os.getenv
- SELECTED_TEXT_PREVIEW_MAX_CHARS used in apps/backend/config.py via os.getenv
- SCREENSHOT_CAPTURE_ENABLED used in apps/backend/config.py via os.getenv
- SCREENSHOT_PREVIEW_ENABLED used in apps/backend/config.py via os.getenv
- SCREENSHOT_SAVE_TEMP used in apps/backend/config.py via os.getenv
- SCREENSHOT_MAX_WIDTH used in apps/backend/config.py via os.getenv
- SCREENSHOT_FORMAT used in apps/backend/config.py via os.getenv
- ACTIVE_PROVIDER used in apps/backend/config.py via os.getenv
- ACTIVE_MODEL used in apps/backend/config.py via os.getenv
- OLLAMA_BASE_URL used in apps/backend/config.py via os.getenv
- OLLAMA_MODEL used in apps/backend/config.py via os.getenv
- LMSTUDIO_BASE_URL used in apps/backend/config.py via os.getenv
- LMSTUDIO_MODEL used in apps/backend/config.py via os.getenv
- OPENAI_COMPATIBLE_BASE_URL used in apps/backend/config.py via os.getenv
- OPENAI_COMPATIBLE_MODEL used in apps/backend/config.py via os.getenv
- OPENAI_COMPATIBLE_API_KEY_ENV used in apps/backend/config.py via os.getenv
- REQUEST_TIMEOUT_SECONDS used in apps/backend/config.py via os.getenv
- PROVIDER_SETTINGS_PATH used in apps/backend/config.py via os.getenv
- PROVIDER_TEST_HISTORY_PATH used in apps/backend/config.py via os.getenv
- MAX_PROMPT_CHARS used in apps/backend/config.py via os.getenv
- MAX_CONTEXT_CHARS used in apps/backend/config.py via os.getenv
- BACKEND_HOST used in apps/backend/desktop_runtime.py via os.getenv
- BACKEND_PORT used in apps/backend/desktop_runtime.py via os.getenv
- LOG_LEVEL used in apps/backend/desktop_runtime.py via os.getenv
- DB_PATH used in apps/backend/storage/db.py via os.getenv
- VITE_DEV_SERVER_URL used in apps/desktop/dist-electron/main.js via process.env
- LOG_LEVEL used in apps/desktop/dist-electron/main.js via process.env
- VITE_DEV_SERVER_URL used in apps/desktop/electron/main.ts via process.env
- LOG_LEVEL used in apps/desktop/electron/main.ts via process.env

## Dependency Graph

- Internal edges: 88
- External packages: __future__, react, config, datetime, typing, fastapi, main, httpx, pathlib, pydantic, react-router-dom, api, context_engine.clipboard, context_engine.context_builder, core, electron, storage.db, actions.executor, actions.store, agent.prompts, child_process, context_engine.active_window, core.provider_settings, ctypes, dataclasses, fs, model_router, model_router.base, model_router.router, path, urllib.parse, @vitejs/plugin-react, abc, actions, actions.safety, agent.planner, aiosqlite
import os

DB_PATH, api.actions, api.agent, api.context, api.health, api.logs, api.models, api.workspace, ASGITransport
from main import app, AsyncClient
import pytest
import pytest_asyncio

from api import actions as actions_api
from main import app


async def _noop_log, asyncio
from datetime import datetime, asyncio
from typing import Any

from httpx import ASGITransport, clear_clipboard, context_builder, context_engine, context_engine.screenshot, context_engine.selected_text, contextlib, ctypes
import os
import sys
from ctypes import wintypes
from pathlib import Path

PROCESS_QUERY_LIMITED_INFORMATION, ctypes
import os
import sys
import time
from ctypes import wintypes
from dataclasses import dataclass, ctypes
import os
import sys
import time
from typing import Callable

from config import settings
from context_engine.active_window import get_active_window
from context_engine.clipboard import ClipboardSnapshot, ctypes
import time
from typing import Callable

import pyperclip

from config import settings


def _default_send_paste_shortcut, Dict, dotenv, enum, fastapi.middleware.cors, field

CF_UNICODETEXT, get_clipboard_snapshot, get_clipboard_snapshot
from context_engine.screenshot import capture_screenshot_metadata
from context_engine.selected_text import get_selected_text


def _truncate_preview, json
from datetime import datetime, json
from typing import Any, json
import re
from datetime import datetime, json
import re
from typing import Any
from urllib.parse import urlsplit

from config import settings


VALID_PROVIDER_IDS, List

from config import settings

ALLOWED_LAST_TEST_FIELDS, load_provider_settings
from core import provider_tests as provider_tests_module
from .base import sanitize_base_url, model_router.ollama_provider, normalize_model_identifiers


class OllamaProvider, normalize_model_identifiers


class OpenAICompatibleProvider, os

import uvicorn

from main import app


def main, os
from dotenv import load_dotenv

load_dotenv, os
import tempfile
import uuid

from config import settings

try, os
import time

import httpx

from .base import BaseProvider, PIL, pytest

from agent.prompts import build_prompt


def test_prompt_truncation_and_redaction_work, pytest

from api import agent as agent_api
from main import app, pytest

from api import models as models_api
from main import app
from model_router import router as router_module
from core import provider_tests as provider_tests_module


def build_provider_settings, pytest

from config import settings
from core import provider_settings as provider_settings_module
from model_router.base import normalize_model_identifiers


def test_normalize_model_identifiers_trims_and_deduplicates, pytest

from context_engine import active_window, pytest
from httpx import AsyncClient, pytest
import httpx

from model_router.base import BaseProvider
from model_router import router as router_module


def build_provider_settings, pytest
import pytest_asyncio

from main import app
from storage import db as storage_db, re

from config import settings
from context_engine.active_window import get_active_window
from context_engine.clipboard import ClipboardSnapshot, re

UNSAFE_PATTERNS, re
import time
from urllib.parse import urlsplit, re
import uuid
from datetime import datetime, react-dom, sanitize_error_message
from .lmstudio_provider import LMStudioProvider
from .ollama_provider import OllamaProvider
from .openai_compatible_provider import OpenAICompatibleProvider


DEFAULT_TEST_PROMPT, screenshot, selected_text
from context_engine.clipboard import ClipboardSnapshot
from main import app, set_clipboard_text

VK_CONTROL, storage, time

import httpx

from .base import BaseProvider, timezone
from typing import Any

from config import settings


RISK_LEVELS, timezone
from typing import Any

import aiosqlite

from config import settings
from storage.db import DB_PATH, timezone
from typing import Any

import aiosqlite

from config import settings
from storage.db import get_db

ALLOWED_ITEM_TYPES, timezone
import httpx

from core.provider_settings import get_effective_model, urlunsplit

import httpx


_SECRET_PATTERNS, vite, vite-plugin-electron, vite-plugin-electron-renderer, workspace.store
- Top internal hubs: apps/desktop/src/i18n/index.tsx (24), apps/desktop/src/lib/api.ts (8), apps/desktop/src/components/ActionButtons.tsx (6), apps/desktop/src/components/ProviderSelector.tsx (6), apps/backend/model_router/base.py (3), apps/desktop/src/components/ProviderGuidancePanel.tsx (3), apps/desktop/src/components/ProviderManualStartGuidanceStrip.tsx (3), apps/desktop/src/lib/workspace.ts (3), apps/backend/model_router/openai_compatible_provider.py (2), apps/desktop/src/components/CommandCenterCards.tsx (2)
- Top external packages: __future__ (23), react (16), config (15), datetime (10), typing (10), fastapi (8), main (7), httpx (6), pathlib (5), pydantic (4)
- Resolved 88 internal dependency edge(s).
- Detected 107 unique external package import(s).
- Cycle detection is limited to small resolvable mutual-import patterns.
- 4 internal import(s) could not be resolved to repo files.

## High Fan-In Files

- apps/desktop/src/i18n/index.tsx (24)
- apps/desktop/src/lib/api.ts (8)
- apps/desktop/src/components/ActionButtons.tsx (6)
- apps/desktop/src/components/ProviderSelector.tsx (6)
- apps/backend/model_router/base.py (3)

## High Fan-Out Files

- apps/desktop/src/pages/HomePage.tsx (15)
- apps/backend/main.py (12)
- apps/backend/model_router/router.py (12)
- apps/desktop/src/App.tsx (11)
- apps/desktop/src/pages/OverlayPage.tsx (11)

## Possible Cycles

- None

## Package Relationships

- None

## Monorepo Package Graph

- Shared packages: none
- Orphan packages: omniagent-desktop

## Important Files

- apps/backend/api/workspace.py (score: 115; reasons: entrypoint, route surface, data model, import hub)
- apps/backend/api/actions.py (score: 94; reasons: entrypoint, route surface, data model, import hub)
- apps/backend/api/models.py (score: 66; reasons: entrypoint, route surface, data model, import hub)
- apps/backend/api/agent.py (score: 54; reasons: entrypoint, route surface, data model, import hub)
- apps/desktop/src/App.tsx (score: 47; reasons: route surface, import hub)
- apps/backend/tests/test_router_phase1c.py (score: 42; reasons: entrypoint, data model, import hub)
- apps/backend/main.py (score: 20; reasons: entrypoint, import hub)
- apps/backend/model_router/router.py (score: 20; reasons: entrypoint, import hub)
- apps/backend/tests/test_actions_phase2a.py (score: 16; reasons: entrypoint, import hub)
- apps/backend/tests/test_context.py (score: 16; reasons: entrypoint, import hub)
- apps/desktop/src/pages/HomePage.tsx (score: 15; reasons: import hub)
- apps/backend/tests/test_models_phase1c.py (score: 14; reasons: entrypoint, import hub)
- apps/backend/tests/test_provider_settings_phase1f.py (score: 13; reasons: entrypoint, import hub)
- apps/backend/tests/test_workspace.py (score: 13; reasons: entrypoint, import hub)
- apps/backend/model_router/base.py (score: 12; reasons: data model, import hub)
- apps/backend/tests/test_agent_phase1c.py (score: 12; reasons: entrypoint, import hub)
- apps/backend/tests/test_health.py (score: 12; reasons: entrypoint, import hub)
- apps/desktop/src/pages/OverlayPage.tsx (score: 12; reasons: import hub)
- apps/backend/context_engine/clipboard.py (score: 11; reasons: data model, import hub)
- apps/backend/model_router/ollama_provider.py (score: 10; reasons: data model, import hub)

## Architecture Risks

- WARNING: Large route surface without tests - Detected 36 routes or route hints, but no tests were found. Fix: Add smoke or integration tests around the primary route surface.
- WARNING: Monorepo layout lacks explicit workspace config - The repository looks like a monorepo, but no clear workspace configuration was detected. Fix: Add npm, pnpm, or yarn workspace config so tooling and contributors can resolve package boundaries reliably.
- INFO: Database layer lacks clear schema documentation - Database-related files were detected, but no obvious schema or migration documentation signal was found. Fix: Document migrations, schema ownership, or data model conventions in README or dedicated docs.
- INFO: Larger project without CI - Detected 192 scanned files, but no CI workflow was found. Fix: Add CI to run tests, lint, and build checks for repeatable validation.

## Recommended Improvements

1. Add smoke tests or unit tests to increase confidence in future scans.
2. Review flagged files for secrets and rotate any exposed credentials.
3. Add or fix workspace configuration so the monorepo structure is explicit.
4. Add deployment config, CI workflows, or deployment docs to improve release readiness.
5. Add smoke or integration tests around the primary route surface.
6. Add npm, pnpm, or yarn workspace config so tooling and contributors can resolve package boundaries reliably.
7. Document migrations, schema ownership, or data model conventions in README or dedicated docs.
8. Add CI to run tests, lint, and build checks for repeatable validation.

---

Generated by **RepoRadar AI**  
Built by **Abed** for **OmniAgent.fun**  
https://github.com/3bud-ZC/RepoRadar-Ai

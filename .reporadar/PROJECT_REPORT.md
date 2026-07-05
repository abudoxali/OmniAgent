# Project Report: omniagent

## Executive Summary

- omniagent was classified as a full-stack-app.
- RepoRadar AI detected FastAPI, React, React Router, Vite across 192 scanned files.
- The current deterministic health score is 35/100.
- This repository appears to be a monorepo managed with an inferred workspace setup.
- Python ecosystem signals were detected, including FastAPI.

## Project Snapshot

| Key | Value |
| --- | --- |
| Project Name | omniagent |
| Project Type | full-stack-app |
| Package Manager | npm |
| Files Scanned | 192 |
| Skipped Files | 76 |
| Skipped Folders | 20 |
| Health Score | 35/100 |
| Monorepo | Yes |

## Config Summary

- Config detected: no
- Config path: not present
- Output directory: .reporadar
- Include patterns: default full-repo scan
- Exclude patterns: .reporadar, .reporadar/**
- Config warnings: none

## Scan Safety Summary

- Max files: 5000
- Max file size: 512 KB
- Skipped files: 76
- Skipped folders: 20
- Truncated: no
- unsupported text extension: 74
- default ignored folder: 20
- env file content intentionally skipped: 1
- file exceeds max size: 1

## Detected Stack

- FastAPI
- React
- React Router
- Vite

## Framework Coverage Notes

- Detected frameworks and tools: FastAPI, React, React Router, Vite
- Python frameworks: FastAPI
- Architecture style: workspace full-stack monorepo

## Module Resolution

- Alias config files: apps/desktop/tsconfig.json
- Alias patterns: none
- Base paths: apps/desktop (apps/desktop/tsconfig.json)
- Detected 0 alias pattern(s) from 1 config file(s).
- Resolved 88 internal import(s); 4 remained unresolved.
- Detected 1 base path hint(s) from tsconfig/jsconfig.

## Monorepo Intelligence

- Monorepo: yes
- Workspace manager: not detected
- Apps: apps/backend, apps/desktop
- Packages: none
- Services: none
- Libraries: none

## Dependency Graph Summary

- Internal edges: 88
- External packages: 107
- Top external packages: __future__ (23), react (16), config (15), datetime (10), typing (10), fastapi (8), main (7), httpx (6), pathlib (5), pydantic (4)
- High fan-in files: apps/desktop/src/i18n/index.tsx (24), apps/desktop/src/lib/api.ts (8), apps/desktop/src/components/ActionButtons.tsx (6), apps/desktop/src/components/ProviderSelector.tsx (6), apps/backend/model_router/base.py (3)
- High fan-out files: apps/desktop/src/pages/HomePage.tsx (15), apps/backend/main.py (12), apps/backend/model_router/router.py (12), apps/desktop/src/App.tsx (11), apps/desktop/src/pages/OverlayPage.tsx (11)
- Resolved 88 internal dependency edge(s).
- Detected 107 unique external package import(s).
- Cycle detection is limited to small resolvable mutual-import patterns.
- 4 internal import(s) could not be resolved to repo files.

## Route And Data Coverage

- Route sources: FastAPI, React Router JSX
- Detected routes: 36
- Data model sources: SQLAlchemy Model, Pydantic Model, Python Dataclass
- Detected data models: 27

## Architecture Risks

- WARNING: Large route surface without tests - Detected 36 routes or route hints, but no tests were found. Fix: Add smoke or integration tests around the primary route surface.
- WARNING: Monorepo layout lacks explicit workspace config - The repository looks like a monorepo, but no clear workspace configuration was detected. Fix: Add npm, pnpm, or yarn workspace config so tooling and contributors can resolve package boundaries reliably.
- INFO: Database layer lacks clear schema documentation - Database-related files were detected, but no obvious schema or migration documentation signal was found. Fix: Document migrations, schema ownership, or data model conventions in README or dedicated docs.
- INFO: Larger project without CI - Detected 192 scanned files, but no CI workflow was found. Fix: Add CI to run tests, lint, and build checks for repeatable validation.

## Deployment Readiness

- Deployment tools: none detected
- Deployment platforms: none detected
- Deployment docs present: no
- Health endpoint detected: /health
- No deployment tooling was detected by the current heuristics.

## Health Score Breakdown

- Documentation: 12/20
- Structure: 0/20
- Security: 18/20
- Testing: 0/15
- Deployment readiness: 0/15
- AI-agent readiness: 5/10

## Top Reasons For Lost Points

- No automated tests were detected. (-10)
- No clear deployment target or Docker packaging was detected. (-7)
- Monorepo structure was detected without a clear workspace config. (-6)

## Actionable Outputs Generated

- FIX_PLAN.md — prioritized improvement plan (8 items)
- QUICK_WINS.md — low-effort, high-impact fixes
- GITHUB_ISSUES.md — copy-paste ready GitHub issues
- AGENT_FIX_PROMPT.md — prompt for AI coding agents to apply fixes safely

## Key Issues

- No tests detected.
- No lint script found in package.json.
- No build script found in package.json.
- Potential hardcoded secret patterns detected.
- Monorepo-like structure detected without a clear workspace config.
- No deployment or CI signals were detected.

## Recommended Next Steps

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

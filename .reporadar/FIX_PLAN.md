# Fix Plan: abud-omniagent

## Executive Summary

- Total improvement items: 8
- Critical: 1
- Warnings: 2
- Info: 5
- Health score: 35/100

## Priority Order

1. Address all critical items first
2. Address warning items next
3. Apply info items when convenient
4. Validate changes by running tests/build

## Critical Fixes

### RR-007: Review possible hardcoded secrets

- **Severity:** CRITICAL
- **Category:** security
- **Effort:** Low effort
- **Impact:** High impact
- **Safe for agent:** Yes

#### Problem
Potential hardcoded secret patterns were detected in 1 location(s).

#### Recommended Fix
Replace inline secrets with environment variables. Rotate any exposed credentials. Add the affected files to .gitignore only if they should not be tracked.

#### Acceptance Criteria
1. No secrets are hardcoded in source files
2. Required env variables are listed in .env.example
3. Exposed credentials are rotated

#### Suggested Files
- apps/backend/tests/test_models_phase1c.py

## Warnings

### RR-001: Add CI workflow

- **Severity:** WARNING
- **Category:** ci
- **Effort:** Low effort
- **Impact:** High impact
- **Safe for agent:** Yes

#### Problem
No continuous integration workflow was detected. Automated testing and builds improve reliability and contributor confidence.

#### Recommended Fix
Add .github/workflows/ci.yml (or equivalent) that installs dependencies, runs lint/typecheck/build, and runs tests on pull requests and pushes to main.

#### Acceptance Criteria
1. CI runs on push to main and on pull requests
2. CI installs dependencies
3. CI runs lint/build/test steps
4. CI passes on the current codebase

#### Suggested Files
- .github/workflows/ci.yml

### RR-002: Add automated tests

- **Severity:** WARNING
- **Category:** testing
- **Effort:** Medium effort
- **Impact:** High impact
- **Safe for agent:** Yes

#### Problem
No automated tests were detected. Tests reduce regression risk and increase confidence when refactoring or adding features.

#### Recommended Fix
Add at least one smoke test that starts the application (or imports the main module) and asserts it does not throw. Choose a test runner that matches your stack.

#### Acceptance Criteria
1. A test file exists in the project
2. The test can be run with a single command
3. At least one test passes

#### Suggested Files
- src/__tests__/smoke.spec.ts
- tests/smoke.test.js
- test_main.py

## Improvements

### RR-005: Review high fan-out file: apps/desktop/src/pages/HomePage.tsx

- **Severity:** INFO
- **Category:** architecture
- **Effort:** High effort
- **Impact:** Medium impact
- **Safe for agent:** Review manually first

#### Problem
The file apps/desktop/src/pages/HomePage.tsx imports from 15 other internal files, which may indicate it has too many responsibilities.

#### Recommended Fix
Consider extracting cohesive groups of imports into separate modules or introducing an intermediate layer. Do not refactor unless behavior is well tested.

#### Acceptance Criteria
1. Responsibilities are clearly separated or documented
2. Tests pass after any refactoring

#### Suggested Files
- apps/desktop/src/pages/HomePage.tsx

### RR-006: Add database schema or migration documentation

- **Severity:** INFO
- **Category:** documentation
- **Effort:** Low effort
- **Impact:** Medium impact
- **Safe for agent:** Yes

#### Problem
Database-related files were detected, but no schema or migration documentation was found.

#### Recommended Fix
Document migrations, schema ownership, or data model conventions in README or a dedicated docs/ folder.

#### Acceptance Criteria
1. Database conventions are documented
2. Migration workflow is described

#### Suggested Files
- README.md
- docs/database.md

### RR-008: Add lint script

- **Severity:** INFO
- **Category:** developer-experience
- **Effort:** Low effort
- **Impact:** Medium impact
- **Safe for agent:** Yes

#### Problem
No lint script was detected. Consistent code style reduces review friction and catches simple errors.

#### Recommended Fix
Add a lint script to package.json (e.g., eslint . or prettier --check .) and run it in CI.

#### Acceptance Criteria
1. Lint script exists in package.json
2. Lint passes on the current codebase

#### Suggested Files
- package.json

### RR-004: Fix unresolved alias imports

- **Severity:** INFO
- **Category:** architecture
- **Effort:** Medium effort
- **Impact:** Medium impact
- **Safe for agent:** Yes

#### Problem
There are 4 unresolved internal imports. These may indicate broken paths, missing alias config, or dynamic imports that the scanner could not resolve.

#### Recommended Fix
Review tsconfig.json / jsconfig.json / vite.config aliases and ensure they match actual source directories. Check for typos in import paths.

#### Acceptance Criteria
1. All alias patterns resolve to existing directories
2. No broken internal imports remain

#### Suggested Files
- apps/desktop/tsconfig.json

### RR-003: Add a license

- **Severity:** INFO
- **Category:** documentation
- **Effort:** Low effort
- **Impact:** Low impact
- **Safe for agent:** Yes

#### Problem
No LICENSE file was detected. Without a license, usage rights are unclear.

#### Recommended Fix
Choose an open-source license (e.g., MIT, Apache-2.0) or document the license in package metadata and add a LICENSE file.

#### Acceptance Criteria
1. LICENSE file exists or license is declared in package metadata
2. License text is complete and correct

#### Suggested Files
- LICENSE
- package.json

## Safe AI-Agent Notes

- Items marked 'Safe for agent: Yes' can be handed to an AI coding agent.
- Items marked 'Review manually first' may require human judgment before automation.
- Always run tests and builds after any automated changes.
- Never expose secrets or real credentials in generated files.

---

Generated by **RepoRadar AI**  
Built by **Abed** for **abud.fun**  
https://github.com/3bud-ZC/RepoRadar-Ai

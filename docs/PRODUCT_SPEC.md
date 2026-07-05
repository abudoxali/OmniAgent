# OmniAgent - Product Spec

Version: `0.1.0`
Updated: `2026-06-22`
Current phase: `Phase 0 - Project Foundation`

## Product Summary

OmniAgent is a Windows-first desktop assistant composed of:

- an Electron + React + TypeScript desktop shell
- a Python FastAPI backend on `localhost:8000`
- a safety-first action layer that only allows safe placeholders in Phase 0

The product goal is to bring context-aware AI help into desktop workflows without exposing the user to hidden automation or destructive behavior.

## Phase 0 Goal

Phase 0 defines and verifies the foundation:

- project structure
- install and dev scripts
- placeholder backend routes
- desktop shell with key placeholder surfaces
- documentation and safety constraints

Phase 0 is complete when a new developer can install the project, run the backend and desktop shell, inspect the placeholder routes, and understand the boundaries for later phases.

## Target User

Primary users:

- Windows power users who want assistant access without living in a browser tab
- developers who want contextual help near their current application
- knowledge workers who need fast summaries, drafting, and context capture

## Core Experience

The intended long-term loop is:

1. The user triggers the assistant from the desktop.
2. The backend builds a context snapshot from safe desktop signals.
3. The agent proposes a response and, when appropriate, a safe action.
4. The user explicitly approves anything beyond low-risk behavior.
5. The system logs the interaction locally.

In Phase 0, this loop is represented by mock responses only.

## Required Phase 0 Features

### Backend

The backend must expose the following placeholder routes:

- `GET /health`
- `GET /context/current`
- `POST /agent/run`
- `GET /models/providers`
- `POST /actions/copy`
- `POST /actions/paste-preview`
- `GET /logs`

Each route should return realistic placeholder data that future phases can replace without breaking the UI contract.

### Desktop

The desktop shell must provide placeholders for:

- home page
- overlay component
- settings page
- logs page
- provider selector
- result preview
- action buttons

The `Ctrl + Alt + A` shortcut is allowed only as an overlay placeholder trigger in Phase 0.

### Documentation

The root and docs set must explain:

- what the project is
- what Phase 0 includes
- how to install and run the stack
- what the API contract currently is
- what is explicitly prohibited for safety

## Non-Goals For Phase 0

The following are intentionally deferred:

- real provider integration for Ollama, LM Studio, or OpenAI-compatible APIs
- live active-window, clipboard, selected-text, or screenshot capture
- terminal or shell command execution
- destructive automation
- file deletion or system control
- payment, email, or external side effects

## Success Measures

Phase 0 is successful when:

- the backend starts cleanly
- the desktop shell starts or builds cleanly
- the required docs exist and match the actual structure
- the root scripts work from a fresh setup
- `STATUS.md` accurately reflects the tested state

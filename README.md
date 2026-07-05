# OmniAgent

**OmniAgent** is a Windows-first, privacy-focused desktop AI assistant built with Electron, React, TypeScript, and a local Python FastAPI backend. It provides a system-wide AI overlay that securely integrates with your local LLMs (like LM Studio or Ollama) to assist you across any application.

OmniAgent is completely local-first. It processes your screen context, clipboard, and text selections locally, and requires explicit user approval before performing any actions like pasting or modifying text.

## 🌟 Key Features

- **System-Wide AI Overlay**: Press `Ctrl + Alt + A` to summon the OmniAgent overlay above any active window.
- **Local Context Awareness**: Intelligently captures your active window title, clipboard, and selected text locally to provide relevant AI assistance.
- **Bring Your Own Local Model**: Seamlessly connects to local OpenAI-compatible endpoints like **LM Studio** and **Ollama**.
- **Privacy by Design**: All processing happens locally. No data is sent to the cloud unless you explicitly configure a remote endpoint. No secrets are stored permanently.
- **Safe Execution**: OmniAgent operates on a "Preview & Confirm" model. It will never scrape your screen automatically or paste text without your explicit "Confirm Paste" click.
- **Bilingual Interface**: Full Arabic and English support with dynamic RTL/LTR layouts.
- **Built-in Workspace**: A local workspace to save your favorite AI generations, notes, and tasks.

## 🚀 Quick Start (Installation)

The easiest way to use OmniAgent is to download the pre-packaged Windows installer.

1. Locate the latest release in `apps/desktop/release/OmniAgent Setup 0.1.0.exe`.
2. Double-click the installer to install the application.
3. Launch **OmniAgent** from your Windows Start Menu.
4. **Setup Provider**: Open Settings inside the app, select your preferred provider (e.g., LM Studio), and enter the local server URL (e.g., `http://127.0.0.1:1234/v1`).
5. Run a quick test prompt to verify connectivity!

## 🛠️ For Developers: Building from Source

OmniAgent's architecture consists of a React/Electron frontend and a Python FastAPI backend.

### Prerequisites
- Node.js 18+
- Python 3.11+
- Windows 10 or Windows 11

### Installation

Clone the repository and install all dependencies:

```powershell
# Install Node modules and setup Python virtual environments
npm run install:all
```

### Running Locally

To start the development servers for both the frontend and the backend:

```powershell
npm run dev
```

Alternatively, run them separately:
```powershell
npm run dev:backend
npm run dev:desktop
```

### Building the Release

To generate the final `.exe` installer for Windows:

```powershell
# Compiles the React frontend
npm run build:desktop

# Packages the Electron app and bundles the Python executable
npm run package:desktop
```
The final installer will be located in `apps/desktop/release/`.

## 🛡️ Security & Privacy Core Rules

OmniAgent is designed with strict boundaries to protect your system:
- **No Telemetry**: No tracking or silent data harvesting.
- **No Unsafe Execution**: The app does not have features to execute terminal commands, delete files, or automate your browser.
- **Explicit Consent**: Selected-text capture and screenshot metadata are disabled by default.
- **No Secret Storage**: API keys are intentionally not saved in the app's database. For remote providers, keys are only read securely from environment variables.

## 📁 Project Structure

```text
OmniAgent/
├── apps/
│   ├── backend/   # FastAPI service (Local context capture & LLM routing)
│   └── desktop/   # Electron + React + TypeScript shell (UI & Overlay)
├── docs/          # Product specs, architecture, and safety rules
├── scripts/       # Windows setup and health scripts
└── PROJECT_STATUS.md
```

## 📚 Documentation
For detailed insights into the architecture and product specs, check out the `docs/` folder:
- [Product Specification](./docs/PRODUCT_SPEC.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Safety Rules](./docs/SAFETY_RULES.md)

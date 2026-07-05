"""Bundled desktop runtime entrypoint for the local FastAPI backend."""
from __future__ import annotations

import os

import uvicorn

from main import app


def main() -> None:
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("BACKEND_PORT", "8000"))
    log_level = os.getenv("LOG_LEVEL", "warning")

    uvicorn.run(app, host=host, port=port, log_level=log_level)


if __name__ == "__main__":
    main()

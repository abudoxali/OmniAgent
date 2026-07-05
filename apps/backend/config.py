import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "localhost")
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "info")
    DB_PATH: str = os.getenv("DB_PATH", "./data/omniagent.db")
    VERSION: str = "0.1.0"
    PHASE: str = "Post-Phase 3E - Services Visibility and Product Hardening"

    # Action execution safety settings
    paste_restore_clipboard: bool = os.getenv("PASTE_RESTORE_CLIPBOARD", "true").lower() == "true"
    paste_delay_ms: int = int(os.getenv("PASTE_DELAY_MS", "100"))
    paste_preview_max_chars: int = int(os.getenv("PASTE_PREVIEW_MAX_CHARS", "500"))
    action_log_content_enabled: bool = os.getenv("ACTION_LOG_CONTENT_ENABLED", "false").lower() == "true"
    allowed_action_types: list[str] = ["copy_to_clipboard", "paste_text_approved", "paste_preview_only"]
    blocked_action_keywords: list[str] = [
        "delete", "remove", "erase", "format", "wipe",
        "execute", "run", "shell", "cmd", "powershell", "terminal", "script",
        "send", "email", "message", "sms", "dm",
        "pay", "purchase", "buy", "checkout", "charge",
        "click", "submit", "upload", "download", "system", "registry",
    ]
    secret_redaction_patterns: list[str] = [
        r"(?i)(api[_-]?key|token|secret|password|passwd|pwd)\s*[:=\s]\s*[^\s\"\']{8,}",
        r"(?i)(sk-[a-zA-Z0-9]{20,})",
        r"(?i)(bearer\s+[a-zA-Z0-9_\-\.]{20,})",
    ]

    enable_selected_text_capture: bool = os.getenv("ENABLE_SELECTED_TEXT_CAPTURE", "false").lower() == "true"
    context_preview_max_chars: int = int(os.getenv("CONTEXT_PREVIEW_MAX_CHARS", "500"))
    clipboard_capture_enabled: bool = os.getenv("CLIPBOARD_CAPTURE_ENABLED", "true").lower() == "true"
    active_window_capture_enabled: bool = os.getenv("ACTIVE_WINDOW_CAPTURE_ENABLED", "true").lower() == "true"
    selected_text_capture_timeout_ms: int = int(os.getenv("SELECTED_TEXT_CAPTURE_TIMEOUT_MS", "800"))
    selected_text_restore_clipboard: bool = os.getenv("SELECTED_TEXT_RESTORE_CLIPBOARD", "true").lower() == "true"
    selected_text_preview_max_chars: int = int(os.getenv("SELECTED_TEXT_PREVIEW_MAX_CHARS", "500"))
    screenshot_capture_enabled: bool = os.getenv("SCREENSHOT_CAPTURE_ENABLED", "false").lower() == "true"
    screenshot_preview_enabled: bool = os.getenv("SCREENSHOT_PREVIEW_ENABLED", "false").lower() == "true"
    screenshot_save_temp: bool = os.getenv("SCREENSHOT_SAVE_TEMP", "false").lower() == "true"
    screenshot_max_width: int = int(os.getenv("SCREENSHOT_MAX_WIDTH", "1280"))
    screenshot_format: str = os.getenv("SCREENSHOT_FORMAT", "png")

    active_provider: str = os.getenv("ACTIVE_PROVIDER", "ollama")
    active_model: str = os.getenv("ACTIVE_MODEL", "")
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.2")
    lmstudio_base_url: str = os.getenv("LMSTUDIO_BASE_URL", "http://localhost:1234/v1")
    lmstudio_model: str = os.getenv("LMSTUDIO_MODEL", "local-model")
    openai_compatible_base_url: str = os.getenv("OPENAI_COMPATIBLE_BASE_URL", "")
    openai_compatible_model: str = os.getenv("OPENAI_COMPATIBLE_MODEL", "")
    openai_compatible_api_key_env: str = os.getenv("OPENAI_COMPATIBLE_API_KEY_ENV", "OPENAI_COMPATIBLE_API_KEY")
    request_timeout_seconds: int = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "60"))
    provider_settings_path: str = os.getenv("PROVIDER_SETTINGS_PATH", "./runtime/provider_settings.json")
    provider_test_history_path: str = os.getenv("PROVIDER_TEST_HISTORY_PATH", "./runtime/provider_tests.json")
    max_prompt_chars: int = int(os.getenv("MAX_PROMPT_CHARS", "4000"))
    max_context_chars: int = int(os.getenv("MAX_CONTEXT_CHARS", "8000"))


settings = Settings()

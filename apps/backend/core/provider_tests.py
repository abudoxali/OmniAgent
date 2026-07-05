"""Safe persistence for last provider test metadata and diagnostics history."""
from __future__ import annotations

from pathlib import Path
import json
from typing import Any, Dict, List

from config import settings

ALLOWED_LAST_TEST_FIELDS = {
    "provider",
    "provider_label",
    "tested_model",
    "diagnostic_status",
    "diagnostic_message",
    "status",
    "success",
    "message",
    "latency_ms",
    "tested_at",
    "base_url",
}
ALLOWED_DIAGNOSTIC_EVENT_FIELDS = {
    "provider",
    "provider_label",
    "diagnostic_status",
    "success",
    "message",
    "latency_ms",
    "tested_at",
    "guidance_provider",
}
MAX_HISTORY_EVENTS = 10


def _resolve_history_path() -> Path:
    backend_root = Path(__file__).resolve().parents[1]
    configured_path = Path(settings.provider_test_history_path)
    if configured_path.is_absolute():
        return configured_path
    return backend_root / configured_path


def _load_store() -> dict:
    path = _resolve_history_path()
    if not path.exists():
        return {"last_results": {}, "events": []}

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"last_results": {}, "events": []}

    if not isinstance(payload, dict):
        return {"last_results": {}, "events": []}

    if "last_results" not in payload and "events" not in payload:
        # legacy structure where payload is {provider_id: record}
        return {"last_results": payload, "events": []}

    last_results = payload.get("last_results")
    events = payload.get("events")
    if not isinstance(last_results, dict):
        last_results = {}
    if not isinstance(events, list):
        events = []
    return {"last_results": last_results, "events": events}


def _write_store(store: dict) -> None:
    path = _resolve_history_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding="utf-8")


def _sanitize_last_result(record: dict[str, Any]) -> dict[str, Any]:
    return {
        field: record.get(field)
        for field in ALLOWED_LAST_TEST_FIELDS
        if field in record
    }


def _sanitize_event(event: dict[str, Any]) -> dict[str, Any]:
    return {
        field: event.get(field)
        for field in ALLOWED_DIAGNOSTIC_EVENT_FIELDS
        if field in event
    }


def load_provider_test_history() -> Dict[str, Dict[str, Any]]:
    store = _load_store()
    sanitized: Dict[str, Dict[str, Any]] = {}
    for provider_id, record in store["last_results"].items():
        if not isinstance(provider_id, str) or not isinstance(record, dict):
            continue
        sanitized[provider_id] = _sanitize_last_result(record)
    return sanitized


def save_provider_test_result(provider_id: str, record: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(provider_id, str) or not provider_id:
        raise ValueError("provider_id must be a non-empty string")

    store = _load_store()
    sanitized_record = _sanitize_last_result(record)
    store["last_results"][provider_id] = sanitized_record
    _write_store(store)
    return sanitized_record


def append_diagnostics_event(event: Dict[str, Any]) -> List[Dict[str, Any]]:
    store = _load_store()
    sanitized_event = _sanitize_event(event)
    events: list = store.get("events", [])
    if not isinstance(events, list):
        events = []
    events.insert(0, sanitized_event)
    store["events"] = events[:MAX_HISTORY_EVENTS]
    _write_store(store)
    return store["events"]


def load_diagnostics_history(limit: int = MAX_HISTORY_EVENTS) -> List[Dict[str, Any]]:
    store = _load_store()
    events = store.get("events", [])
    if not isinstance(events, list):
        return []
    sanitized_events: List[Dict[str, Any]] = []
    for event in events[:limit]:
        if isinstance(event, dict):
            sanitized_events.append(_sanitize_event(event))
    return sanitized_events

"""Local workspace persistence for notes, tasks, and saved AI results."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

import aiosqlite

from config import settings
from storage.db import get_db

ALLOWED_ITEM_TYPES = {"note", "task", "result"}
TITLE_MAX_CHARS = 160
CONTENT_MAX_CHARS = 12000
PREVIEW_MAX_CHARS = 280
SEARCH_LIMIT = 200
SECRET_FIELD_NAME_PATTERN = re.compile(r"(?i)(api[_-]?key|token|secret|password|passwd|pwd)")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _truncate(value: str, limit: int) -> str:
    cleaned = (value or "").strip()
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[:limit]}..."


def _contains_secret_like_value(value: str) -> bool:
    text = (value or "").strip()
    if not text:
        return False
    for pattern in settings.secret_redaction_patterns:
        if re.search(pattern, text):
            return True
    return False


def _ensure_safe_payload_keys(payload: dict[str, Any]) -> None:
    for key in payload:
        if SECRET_FIELD_NAME_PATTERN.search(key):
            raise ValueError("حقول الأسرار أو المفاتيح غير مسموح بها داخل مساحة العمل المحلية.")


def _sanitize_title(title: str) -> str:
    normalized = _truncate(title, TITLE_MAX_CHARS)
    if not normalized:
        raise ValueError("العنوان مطلوب.")
    if _contains_secret_like_value(normalized):
        raise ValueError("لا يمكن حفظ نص يحتوي على مفاتيح أو أسرار ظاهرة.")
    return normalized


def _sanitize_content(content: str) -> str:
    normalized = (content or "").strip()
    if len(normalized) > CONTENT_MAX_CHARS:
        normalized = normalized[:CONTENT_MAX_CHARS]
    if _contains_secret_like_value(normalized):
        raise ValueError("لا يمكن حفظ نص يحتوي على مفاتيح أو أسرار ظاهرة.")
    return normalized


def _sanitize_optional(value: str | None, limit: int) -> str | None:
    if value is None:
        return None
    normalized = _truncate(value, limit)
    if normalized and _contains_secret_like_value(normalized):
        raise ValueError("لا يمكن حفظ نص يحتوي على مفاتيح أو أسرار ظاهرة.")
    return normalized or None


def _build_preview(content: str) -> str:
    return _truncate(content, PREVIEW_MAX_CHARS)


def _normalize_item_type(item_type: str) -> str:
    if item_type not in ALLOWED_ITEM_TYPES:
        raise ValueError("نوع عنصر مساحة العمل غير مدعوم.")
    return item_type


def _row_to_item(row: aiosqlite.Row) -> dict[str, Any]:
    metadata_json = row["metadata_json"] or "{}"
    try:
        metadata = json.loads(metadata_json)
    except json.JSONDecodeError:
        metadata = {}
    return {
        "id": row["id"],
        "item_type": row["item_type"],
        "title": row["title"],
        "content": row["content"],
        "content_preview": row["content_preview"],
        "is_pinned": bool(row["is_pinned"]),
        "is_archived": bool(row["is_archived"]),
        "is_completed": bool(row["is_completed"]),
        "source": row["source"],
        "provider": row["provider"],
        "model": row["model"],
        "mode": row["mode"],
        "metadata": metadata,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


async def _fetch_one(item_id: int, item_type: str) -> dict[str, Any]:
    db = await get_db()
    try:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT *
            FROM workspace_items
            WHERE id = ? AND item_type = ?
            """,
            (item_id, item_type),
        )
        row = await cursor.fetchone()
    finally:
        await db.close()
    if row is None:
        raise ValueError("تعذر العثور على عنصر مساحة العمل المطلوب.")
    return _row_to_item(row)


async def create_workspace_item(
    *,
    item_type: str,
    title: str,
    content: str = "",
    is_completed: bool = False,
    source: str | None = None,
    provider: str | None = None,
    model: str | None = None,
    mode: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    item_type = _normalize_item_type(item_type)
    safe_title = _sanitize_title(title)
    safe_content = _sanitize_content(content)
    preview = _build_preview(safe_content)
    safe_source = _sanitize_optional(source, 80)
    safe_provider = _sanitize_optional(provider, 80)
    safe_model = _sanitize_optional(model, 120)
    safe_mode = _sanitize_optional(mode, 80)
    safe_metadata = metadata or {}
    _ensure_safe_payload_keys(safe_metadata)

    timestamp = _utc_now()
    db = await get_db()
    try:
        cursor = await db.execute(
            """
            INSERT INTO workspace_items (
                item_type,
                title,
                content,
                content_preview,
                is_completed,
                source,
                provider,
                model,
                mode,
                metadata_json,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item_type,
                safe_title,
                safe_content,
                preview,
                1 if is_completed else 0,
                safe_source,
                safe_provider,
                safe_model,
                safe_mode,
                json.dumps(safe_metadata, ensure_ascii=False),
                timestamp,
                timestamp,
            ),
        )
        await db.commit()
        item_id = cursor.lastrowid
    finally:
        await db.close()
    return await _fetch_one(item_id, item_type)


async def update_workspace_item(
    *,
    item_id: int,
    item_type: str,
    title: str | None = None,
    content: str | None = None,
    is_completed: bool | None = None,
) -> dict[str, Any]:
    item_type = _normalize_item_type(item_type)
    current = await _fetch_one(item_id, item_type)
    next_title = _sanitize_title(title if title is not None else current["title"])
    next_content = _sanitize_content(content if content is not None else current["content"])
    next_completed = current["is_completed"] if is_completed is None else bool(is_completed)
    timestamp = _utc_now()

    db = await get_db()
    try:
        await db.execute(
            """
            UPDATE workspace_items
            SET title = ?, content = ?, content_preview = ?, is_completed = ?, updated_at = ?
            WHERE id = ? AND item_type = ?
            """,
            (
                next_title,
                next_content,
                _build_preview(next_content),
                1 if next_completed else 0,
                timestamp,
                item_id,
                item_type,
            ),
        )
        await db.commit()
    finally:
        await db.close()
    return await _fetch_one(item_id, item_type)


async def set_workspace_pin(*, item_id: int, item_type: str, pinned: bool) -> dict[str, Any]:
    item_type = _normalize_item_type(item_type)
    db = await get_db()
    try:
        await db.execute(
            """
            UPDATE workspace_items
            SET is_pinned = ?, updated_at = ?
            WHERE id = ? AND item_type = ?
            """,
            (1 if pinned else 0, _utc_now(), item_id, item_type),
        )
        await db.commit()
    finally:
        await db.close()
    return await _fetch_one(item_id, item_type)


async def set_workspace_archive(*, item_id: int, item_type: str, archived: bool) -> dict[str, Any]:
    item_type = _normalize_item_type(item_type)
    db = await get_db()
    try:
        await db.execute(
            """
            UPDATE workspace_items
            SET is_archived = ?, updated_at = ?
            WHERE id = ? AND item_type = ?
            """,
            (1 if archived else 0, _utc_now(), item_id, item_type),
        )
        await db.commit()
    finally:
        await db.close()
    return await _fetch_one(item_id, item_type)


async def list_workspace_items(
    *,
    item_type: str,
    query: str | None = None,
    include_archived: bool = False,
    pinned_only: bool = False,
    completed: bool | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    item_type = _normalize_item_type(item_type)
    sql = [
        "SELECT * FROM workspace_items WHERE item_type = ?",
    ]
    params: list[Any] = [item_type]

    if not include_archived:
        sql.append("AND is_archived = 0")
    if pinned_only:
        sql.append("AND is_pinned = 1")
    if completed is not None and item_type == "task":
        sql.append("AND is_completed = ?")
        params.append(1 if completed else 0)
    if query:
        sql.append("AND (title LIKE ? OR content LIKE ?)")
        like = f"%{query.strip()}%"
        params.extend([like, like])

    sql.append("ORDER BY is_pinned DESC, updated_at DESC, id DESC LIMIT ?")
    params.append(min(max(limit, 1), SEARCH_LIMIT))

    db = await get_db()
    try:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("\n".join(sql), params)
        rows = await cursor.fetchall()
    finally:
        await db.close()
    return [_row_to_item(row) for row in rows]


async def search_workspace_items(
    *,
    query: str,
    item_type: str | None = None,
    include_archived: bool = False,
    pinned_only: bool = False,
    limit: int = 100,
) -> list[dict[str, Any]]:
    normalized_query = query.strip()
    sql = ["SELECT * FROM workspace_items WHERE 1 = 1"]
    params: list[Any] = []

    if item_type:
        sql.append("AND item_type = ?")
        params.append(_normalize_item_type(item_type))
    if not include_archived:
        sql.append("AND is_archived = 0")
    if pinned_only:
        sql.append("AND is_pinned = 1")
    if normalized_query:
        like = f"%{normalized_query}%"
        sql.append("AND (title LIKE ? OR content LIKE ?)")
        params.extend([like, like])

    sql.append("ORDER BY is_pinned DESC, updated_at DESC, id DESC LIMIT ?")
    params.append(min(max(limit, 1), SEARCH_LIMIT))

    db = await get_db()
    try:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("\n".join(sql), params)
        rows = await cursor.fetchall()
    finally:
        await db.close()
    return [_row_to_item(row) for row in rows]

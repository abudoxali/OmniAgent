"""Phase 3A local workspace routes."""
from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator

from workspace.store import (
    create_workspace_item,
    list_workspace_items,
    search_workspace_items,
    set_workspace_archive,
    set_workspace_pin,
    update_workspace_item,
)

router = APIRouter()

SECRET_KEYS = {"api_key", "token", "secret", "password", "passwd", "pwd"}


class SafeWorkspaceModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="before")
    @classmethod
    def reject_secret_like_keys(cls, values: Any):
        if isinstance(values, dict):
            for key in values:
                lowered = str(key).lower()
                if lowered in SECRET_KEYS:
                    raise ValueError("حقول الأسرار أو المفاتيح غير مسموح بها داخل مساحة العمل المحلية.")
        return values


class NoteCreateRequest(SafeWorkspaceModel):
    title: str = Field(..., min_length=1, max_length=400)
    content: str = Field(default="", max_length=20000)


class NoteUpdateRequest(SafeWorkspaceModel):
    title: str | None = Field(default=None, min_length=1, max_length=400)
    content: str | None = Field(default=None, max_length=20000)


class TaskCreateRequest(SafeWorkspaceModel):
    title: str = Field(..., min_length=1, max_length=400)
    content: str = Field(default="", max_length=20000)
    is_completed: bool = False


class TaskUpdateRequest(SafeWorkspaceModel):
    title: str | None = Field(default=None, min_length=1, max_length=400)
    content: str | None = Field(default=None, max_length=20000)
    is_completed: bool | None = None


class SavedResultCreateRequest(SafeWorkspaceModel):
    title: str = Field(..., min_length=1, max_length=400)
    content: str = Field(..., min_length=1, max_length=20000)
    provider: str | None = Field(default=None, max_length=200)
    model: str | None = Field(default=None, max_length=200)
    mode: str | None = Field(default=None, max_length=120)
    source: str | None = Field(default="manual_save", max_length=120)
    metadata: dict | None = None


class PinRequest(SafeWorkspaceModel):
    pinned: bool = True


class ArchiveRequest(SafeWorkspaceModel):
    archived: bool = True


def _error_response(error: Exception) -> HTTPException:
    message = str(error) or "تعذر تنفيذ طلب مساحة العمل."
    return HTTPException(status_code=400, detail=message)


def _completed_filter(value: Literal["all", "open", "done"]) -> bool | None:
    if value == "done":
        return True
    if value == "open":
        return False
    return None


@router.get("/workspace/notes")
async def list_notes(
    q: str | None = None,
    include_archived: bool = False,
    pinned_only: bool = False,
):
    items = await list_workspace_items(
        item_type="note",
        query=q,
        include_archived=include_archived,
        pinned_only=pinned_only,
    )
    return {"items": items}


@router.post("/workspace/notes")
async def create_note(request: NoteCreateRequest):
    try:
        item = await create_workspace_item(item_type="note", title=request.title, content=request.content)
    except ValueError as error:
        raise _error_response(error)
    return item


@router.patch("/workspace/notes/{item_id}")
async def update_note(item_id: int, request: NoteUpdateRequest):
    try:
        item = await update_workspace_item(
            item_id=item_id,
            item_type="note",
            title=request.title,
            content=request.content,
        )
    except ValueError as error:
        status_code = 404 if "العثور" in str(error) else 400
        raise HTTPException(status_code=status_code, detail=str(error))
    return item


@router.post("/workspace/notes/{item_id}/pin")
async def pin_note(item_id: int, request: PinRequest):
    try:
        item = await set_workspace_pin(item_id=item_id, item_type="note", pinned=request.pinned)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    return item


@router.post("/workspace/notes/{item_id}/archive")
async def archive_note(item_id: int, request: ArchiveRequest):
    try:
        item = await set_workspace_archive(item_id=item_id, item_type="note", archived=request.archived)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    return item


@router.get("/workspace/tasks")
async def list_tasks(
    q: str | None = None,
    include_archived: bool = False,
    pinned_only: bool = False,
    completed: Literal["all", "open", "done"] = Query(default="all"),
):
    items = await list_workspace_items(
        item_type="task",
        query=q,
        include_archived=include_archived,
        pinned_only=pinned_only,
        completed=_completed_filter(completed),
    )
    return {"items": items}


@router.post("/workspace/tasks")
async def create_task(request: TaskCreateRequest):
    try:
        item = await create_workspace_item(
            item_type="task",
            title=request.title,
            content=request.content,
            is_completed=request.is_completed,
        )
    except ValueError as error:
        raise _error_response(error)
    return item


@router.patch("/workspace/tasks/{item_id}")
async def update_task(item_id: int, request: TaskUpdateRequest):
    try:
        item = await update_workspace_item(
            item_id=item_id,
            item_type="task",
            title=request.title,
            content=request.content,
            is_completed=request.is_completed,
        )
    except ValueError as error:
        status_code = 404 if "العثور" in str(error) else 400
        raise HTTPException(status_code=status_code, detail=str(error))
    return item


@router.post("/workspace/tasks/{item_id}/pin")
async def pin_task(item_id: int, request: PinRequest):
    try:
        item = await set_workspace_pin(item_id=item_id, item_type="task", pinned=request.pinned)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    return item


@router.post("/workspace/tasks/{item_id}/archive")
async def archive_task(item_id: int, request: ArchiveRequest):
    try:
        item = await set_workspace_archive(item_id=item_id, item_type="task", archived=request.archived)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    return item


@router.get("/workspace/results")
async def list_saved_results(
    q: str | None = None,
    include_archived: bool = False,
    pinned_only: bool = False,
):
    items = await list_workspace_items(
        item_type="result",
        query=q,
        include_archived=include_archived,
        pinned_only=pinned_only,
    )
    return {"items": items}


@router.post("/workspace/results")
async def save_result(request: SavedResultCreateRequest):
    try:
        item = await create_workspace_item(
            item_type="result",
            title=request.title,
            content=request.content,
            provider=request.provider,
            model=request.model,
            mode=request.mode,
            source=request.source,
            metadata=request.metadata,
        )
    except ValueError as error:
        raise _error_response(error)
    return item


@router.post("/workspace/results/{item_id}/pin")
async def pin_saved_result(item_id: int, request: PinRequest):
    try:
        item = await set_workspace_pin(item_id=item_id, item_type="result", pinned=request.pinned)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    return item


@router.post("/workspace/results/{item_id}/archive")
async def archive_saved_result(item_id: int, request: ArchiveRequest):
    try:
        item = await set_workspace_archive(item_id=item_id, item_type="result", archived=request.archived)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    return item


@router.get("/workspace/search")
async def search_workspace(
    q: str = Query(default="", max_length=500),
    item_type: Literal["note", "task", "result"] | None = None,
    include_archived: bool = False,
    pinned_only: bool = False,
):
    items = await search_workspace_items(
        query=q,
        item_type=item_type,
        include_archived=include_archived,
        pinned_only=pinned_only,
    )
    return {"items": items}

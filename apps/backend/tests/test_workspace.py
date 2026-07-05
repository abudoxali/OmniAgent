"""Backend tests for Phase 3A local workspace routes."""
from __future__ import annotations

from httpx import ASGITransport, AsyncClient
import pytest
import pytest_asyncio

from main import app
from storage import db as storage_db


@pytest_asyncio.fixture
async def client(tmp_path, monkeypatch: pytest.MonkeyPatch):
    db_path = tmp_path / "workspace-test.db"
    monkeypatch.setattr(storage_db, "DB_PATH", str(db_path))
    await storage_db.init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


@pytest.mark.asyncio
async def test_create_and_list_note(client: AsyncClient):
    create_response = await client.post(
        "/workspace/notes",
        json={"title": "ملاحظة مهمة", "content": "هذه ملاحظة محلية محفوظة يدويًا."},
    )
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["item_type"] == "note"
    assert created["title"] == "ملاحظة مهمة"

    list_response = await client.get("/workspace/notes")
    assert list_response.status_code == 200
    items = list_response.json()["items"]
    assert len(items) == 1
    assert items[0]["content"] == "هذه ملاحظة محلية محفوظة يدويًا."


@pytest.mark.asyncio
async def test_update_pin_and_archive_note(client: AsyncClient):
    create_response = await client.post("/workspace/notes", json={"title": "ملاحظة", "content": "نسخة أولى"})
    item_id = create_response.json()["id"]

    update_response = await client.patch(
        f"/workspace/notes/{item_id}",
        json={"title": "ملاحظة معدلة", "content": "نسخة ثانية"},
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["title"] == "ملاحظة معدلة"
    assert updated["content"] == "نسخة ثانية"

    pin_response = await client.post(f"/workspace/notes/{item_id}/pin", json={"pinned": True})
    assert pin_response.status_code == 200
    assert pin_response.json()["is_pinned"] is True

    archive_response = await client.post(f"/workspace/notes/{item_id}/archive", json={"archived": True})
    assert archive_response.status_code == 200
    assert archive_response.json()["is_archived"] is True

    visible_response = await client.get("/workspace/notes")
    assert visible_response.status_code == 200
    assert visible_response.json()["items"] == []

    archived_response = await client.get("/workspace/notes?include_archived=true")
    assert archived_response.status_code == 200
    assert len(archived_response.json()["items"]) == 1


@pytest.mark.asyncio
async def test_create_update_and_filter_tasks(client: AsyncClient):
    create_response = await client.post(
        "/workspace/tasks",
        json={"title": "مهمة اليوم", "content": "إنهاء مراجعة الواجهة", "is_completed": False},
    )
    assert create_response.status_code == 200
    task_id = create_response.json()["id"]

    update_response = await client.patch(
        f"/workspace/tasks/{task_id}",
        json={"is_completed": True, "content": "تمت مراجعة الواجهة"},
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["is_completed"] is True
    assert updated["content"] == "تمت مراجعة الواجهة"

    done_response = await client.get("/workspace/tasks?completed=done")
    assert done_response.status_code == 200
    assert len(done_response.json()["items"]) == 1

    open_response = await client.get("/workspace/tasks?completed=open")
    assert open_response.status_code == 200
    assert open_response.json()["items"] == []


@pytest.mark.asyncio
async def test_save_result_and_search_workspace(client: AsyncClient):
    result_response = await client.post(
        "/workspace/results",
        json={
            "title": "ملخص اجتماع",
            "content": "هذا ملخص محفوظ يدويًا من نتيجة الذكاء الاصطناعي.",
            "provider": "lmstudio",
            "model": "google/gemma-4-e2b",
            "mode": "summarize",
            "source": "manual_save",
        },
    )
    assert result_response.status_code == 200
    result = result_response.json()
    assert result["item_type"] == "result"
    assert result["provider"] == "lmstudio"

    search_response = await client.get("/workspace/search?q=اجتماع")
    assert search_response.status_code == 200
    items = search_response.json()["items"]
    assert len(items) == 1
    assert items[0]["title"] == "ملخص اجتماع"


@pytest.mark.asyncio
async def test_workspace_rejects_secret_like_content(client: AsyncClient):
    response = await client.post(
        "/workspace/notes",
        json={"title": "مفتاح", "content": "api_key=sk-12345678901234567890abcdef"},
    )
    assert response.status_code == 400
    assert "أسرار" in response.json()["detail"]


@pytest.mark.asyncio
async def test_workspace_rejects_secret_like_payload_keys(client: AsyncClient):
    response = await client.post(
        "/workspace/notes",
        json={"title": "x", "content": "y", "api_key": "dont-store-me"},
    )
    assert response.status_code == 422

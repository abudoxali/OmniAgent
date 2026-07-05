import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert data["phase"] == "Post-Phase 3E - Services Visibility and Product Hardening"
    assert "started_at" in data
    assert "uptime_seconds" in data
    assert data["backend_host"] == "localhost"
    assert data["backend_port"] == 8000
    assert "runtime_files" in data
    assert "db_path" in data["runtime_files"]
    assert "provider_settings_path" in data["runtime_files"]
    assert "provider_test_history_path" in data["runtime_files"]
    assert "capture_features" in data
    assert data["capture_features"]["active_window_enabled"] is True

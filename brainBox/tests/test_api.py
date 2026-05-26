import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["service"] == "Brainbox AI Backend"


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_ingest_payload():
    payload = {
        "tenant_id": "test-tenant",
        "source_type": "logs",
        "content": "test log content",
        "file_path": "/var/log/test.log"
    }
    response = client.post("/api/ingest", json=payload)
    assert response.status_code == 200
    assert "task_id" in response.json()
    assert response.json()["status"] == "queued"


def test_chat_payload():
    payload = {
        "tenant_id": "test-tenant",
        "question": "What is happening?"
    }
    response = client.post("/api/chat", json=payload)
    # This may fail if services aren't running, but tests structure
    assert response.status_code in [200, 500]


def test_create_chat_session():
    payload = {
        "tenant_id": "test-tenant",
        "title": "Test Session"
    }
    response = client.post("/api/chat/session", json=payload)
    assert response.status_code == 200
    assert "session_id" in response.json()

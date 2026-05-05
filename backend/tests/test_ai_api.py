from pathlib import Path

from fastapi.testclient import TestClient

from backend.app import main


def make_client(tmp_path: Path) -> TestClient:
    main.app.state.db_path = str(tmp_path / "test.sqlite3")
    return TestClient(main.app)


def test_ai_test_returns_model_response(tmp_path: Path, monkeypatch) -> None:
    client = make_client(tmp_path)

    monkeypatch.setattr(main, "call_openrouter", lambda prompt: "4")
    response = client.post("/api/ai/test", json={"prompt": "2+2"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["model"] == "openai/gpt-oss-120b"
    assert payload["prompt"] == "2+2"
    assert payload["answer"] == "4"


def test_ai_test_defaults_prompt(tmp_path: Path, monkeypatch) -> None:
    client = make_client(tmp_path)

    captured = {"prompt": ""}

    def fake_call(prompt: str) -> str:
        captured["prompt"] = prompt
        return "4"

    monkeypatch.setattr(main, "call_openrouter", fake_call)
    response = client.post("/api/ai/test", json={})

    assert response.status_code == 200
    assert captured["prompt"] == "2+2"


def test_ai_test_propagates_provider_errors(tmp_path: Path, monkeypatch) -> None:
    client = make_client(tmp_path)

    def broken_call(_: str) -> str:
        raise main.HTTPException(status_code=502, detail="OpenRouter error")

    monkeypatch.setattr(main, "call_openrouter", broken_call)
    response = client.post("/api/ai/test", json={"prompt": "2+2"})

    assert response.status_code == 502
    assert response.json()["detail"] == "OpenRouter error"

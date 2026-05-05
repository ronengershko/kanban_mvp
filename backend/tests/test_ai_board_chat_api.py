from pathlib import Path
import json

from fastapi.testclient import TestClient

from backend.app import main


def make_client(tmp_path: Path) -> TestClient:
    main.app.state.db_path = str(tmp_path / "test.sqlite3")
    return TestClient(main.app)


def test_board_chat_without_update_keeps_board(tmp_path: Path, monkeypatch) -> None:
    client = make_client(tmp_path)

    monkeypatch.setattr(
        main,
        "call_openrouter_messages",
        lambda _: '{"reply":"No changes needed","board":null}',
    )

    before = client.get("/api/board/user")
    assert before.status_code == 200
    before_board = before.json()

    response = client.post(
        "/api/ai/board-chat",
        json={
            "username": "user",
            "message": "Any updates?",
            "history": [{"role": "user", "content": "hello"}],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["reply"] == "No changes needed"
    assert payload["board_updated"] is False
    assert payload["board"] == before_board


def test_board_chat_with_update_persists_board(tmp_path: Path, monkeypatch) -> None:
    client = make_client(tmp_path)

    original = client.get("/api/board/user").json()
    original["columns"][0]["title"] = "AI Updated"

    monkeypatch.setattr(
        main,
        "call_openrouter_messages",
        lambda _: json.dumps({"reply": "Updated it", "board": original}),
    )

    response = client.post(
        "/api/ai/board-chat",
        json={"username": "user", "message": "rename first column", "history": []},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["board_updated"] is True
    assert payload["board"]["columns"][0]["title"] == "AI Updated"

    fetched = client.get("/api/board/user")
    assert fetched.status_code == 200
    assert fetched.json()["columns"][0]["title"] == "AI Updated"


def test_board_chat_rejects_invalid_json_output(tmp_path: Path, monkeypatch) -> None:
    client = make_client(tmp_path)

    monkeypatch.setattr(main, "call_openrouter_messages", lambda _: "not json")

    response = client.post(
        "/api/ai/board-chat",
        json={"username": "user", "message": "hi", "history": []},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "AI returned invalid JSON output"


def test_board_chat_rejects_invalid_schema(tmp_path: Path, monkeypatch) -> None:
    client = make_client(tmp_path)

    monkeypatch.setattr(main, "call_openrouter_messages", lambda _: '{"board":null}')

    response = client.post(
        "/api/ai/board-chat",
        json={"username": "user", "message": "hi", "history": []},
    )

    assert response.status_code == 502
    assert "AI output schema invalid" in response.json()["detail"]

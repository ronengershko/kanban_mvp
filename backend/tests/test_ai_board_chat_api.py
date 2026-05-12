from pathlib import Path
import json

from fastapi.testclient import TestClient

from backend.app import main


def make_client(tmp_path: Path) -> TestClient:
    main.app.state.db_path = str(tmp_path / "test.sqlite3")
    main.init_db()
    return TestClient(main.app)


def get_default_board_id(client: TestClient) -> int:
    boards = client.get("/api/boards/user").json()
    return boards[0]["id"]


def test_board_chat_without_update_keeps_board(tmp_path: Path, monkeypatch) -> None:
    client = make_client(tmp_path)
    board_id = get_default_board_id(client)

    monkeypatch.setattr(
        main,
        "call_openrouter_messages",
        lambda _: '{"reply":"No changes needed","board":null}',
    )

    before = client.get(f"/api/board/user/{board_id}")
    assert before.status_code == 200
    before_board = before.json()

    response = client.post(
        "/api/ai/board-chat",
        json={
            "username": "user",
            "board_id": board_id,
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
    board_id = get_default_board_id(client)

    original = client.get(f"/api/board/user/{board_id}").json()
    original["columns"][0]["title"] = "AI Updated"

    monkeypatch.setattr(
        main,
        "call_openrouter_messages",
        lambda _: json.dumps({"reply": "Updated it", "board": original}),
    )

    response = client.post(
        "/api/ai/board-chat",
        json={
            "username": "user",
            "board_id": board_id,
            "message": "rename first column",
            "history": [],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["board_updated"] is True
    assert payload["board"]["columns"][0]["title"] == "AI Updated"

    fetched = client.get(f"/api/board/user/{board_id}")
    assert fetched.status_code == 200
    assert fetched.json()["columns"][0]["title"] == "AI Updated"


def test_board_chat_rejects_invalid_json_output(tmp_path: Path, monkeypatch) -> None:
    client = make_client(tmp_path)
    board_id = get_default_board_id(client)

    monkeypatch.setattr(main, "call_openrouter_messages", lambda _: "not json")

    response = client.post(
        "/api/ai/board-chat",
        json={"username": "user", "board_id": board_id, "message": "hi", "history": []},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "AI returned invalid JSON output"


def test_board_chat_rejects_invalid_schema(tmp_path: Path, monkeypatch) -> None:
    client = make_client(tmp_path)
    board_id = get_default_board_id(client)

    monkeypatch.setattr(main, "call_openrouter_messages", lambda _: '{"board":null}')

    response = client.post(
        "/api/ai/board-chat",
        json={"username": "user", "board_id": board_id, "message": "hi", "history": []},
    )

    assert response.status_code == 502
    assert "AI output schema invalid" in response.json()["detail"]


def test_board_chat_rejects_wrong_board_id(tmp_path: Path, monkeypatch) -> None:
    client = make_client(tmp_path)

    monkeypatch.setattr(
        main,
        "call_openrouter_messages",
        lambda _: '{"reply":"ok","board":null}',
    )

    response = client.post(
        "/api/ai/board-chat",
        json={"username": "user", "board_id": 99999, "message": "hi", "history": []},
    )

    assert response.status_code == 404

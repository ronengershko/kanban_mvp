from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import app


def make_client(tmp_path: Path) -> TestClient:
    app.state.db_path = str(tmp_path / "test.sqlite3")
    return TestClient(app)


def test_db_file_is_created_and_default_board_is_returned(tmp_path: Path) -> None:
    db_path = tmp_path / "test.sqlite3"
    client = make_client(tmp_path)

    response = client.get("/api/board/user")

    assert response.status_code == 200
    assert db_path.exists()
    payload = response.json()
    assert "columns" in payload
    assert "cards" in payload


def test_update_board_persists_changes(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    initial = client.get("/api/board/user")
    board = initial.json()
    board["columns"][0]["title"] = "Renamed"

    update = client.put("/api/board/user", json=board)
    assert update.status_code == 200

    fetched = client.get("/api/board/user")
    assert fetched.status_code == 200
    assert fetched.json()["columns"][0]["title"] == "Renamed"


def test_invalid_board_payload_is_rejected(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    invalid_payload = {"columns": [{"id": "col-1", "title": "X"}], "cards": {}}
    response = client.put("/api/board/user", json=invalid_payload)

    assert response.status_code == 422


def test_boards_are_isolated_by_user(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    user_board = client.get("/api/board/user").json()
    user_board["columns"][0]["title"] = "User Board"
    client.put("/api/board/user", json=user_board)

    other_board = client.get("/api/board/alice")
    assert other_board.status_code == 200
    assert other_board.json()["columns"][0]["title"] != "User Board"

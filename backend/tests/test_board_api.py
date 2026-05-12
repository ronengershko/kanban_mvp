from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import app, init_db


def make_client(tmp_path: Path) -> TestClient:
    app.state.db_path = str(tmp_path / "test.sqlite3")
    init_db()
    return TestClient(app)


# ── Legacy single-board endpoints ─────────────────────────────────────────────

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


# ── Auth endpoints ─────────────────────────────────────────────────────────────

def test_register_creates_user(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.post("/api/auth/register", json={"username": "alice", "password": "secret1"})
    assert response.status_code == 200
    assert response.json()["username"] == "alice"


def test_register_duplicate_username_rejected(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    client.post("/api/auth/register", json={"username": "alice", "password": "secret1"})
    response = client.post("/api/auth/register", json={"username": "alice", "password": "other"})
    assert response.status_code == 409


def test_register_short_password_rejected(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.post("/api/auth/register", json={"username": "alice", "password": "abc"})
    assert response.status_code == 400


def test_login_success(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    client.post("/api/auth/register", json={"username": "alice", "password": "secret1"})
    response = client.post("/api/auth/login", json={"username": "alice", "password": "secret1"})
    assert response.status_code == 200
    assert response.json()["username"] == "alice"


def test_login_wrong_password(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    client.post("/api/auth/register", json={"username": "alice", "password": "secret1"})
    response = client.post("/api/auth/login", json={"username": "alice", "password": "wrong"})
    assert response.status_code == 401


def test_login_unknown_user(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.post("/api/auth/login", json={"username": "nobody", "password": "pass"})
    assert response.status_code == 401


# ── Multi-board endpoints ──────────────────────────────────────────────────────

def test_list_boards_returns_default(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.get("/api/boards/user")
    assert response.status_code == 200
    boards = response.json()
    assert len(boards) >= 1
    assert "id" in boards[0]
    assert "name" in boards[0]


def test_create_board(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    client.get("/api/boards/user")  # ensure user exists
    response = client.post("/api/boards/user", json={"name": "Sprint 2"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Sprint 2"

    boards = client.get("/api/boards/user").json()
    assert any(b["name"] == "Sprint 2" for b in boards)


def test_delete_board(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    client.get("/api/boards/user")
    new = client.post("/api/boards/user", json={"name": "Temp Board"}).json()
    board_id = new["id"]

    response = client.delete(f"/api/boards/user/{board_id}")
    assert response.status_code == 200

    boards = client.get("/api/boards/user").json()
    assert not any(b["id"] == board_id for b in boards)


def test_cannot_delete_last_board(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    boards = client.get("/api/boards/user").json()
    assert len(boards) == 1

    response = client.delete(f"/api/boards/user/{boards[0]['id']}")
    assert response.status_code == 400


def test_rename_board(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    boards = client.get("/api/boards/user").json()
    board_id = boards[0]["id"]

    response = client.patch(f"/api/boards/user/{board_id}", json={"name": "Renamed"})
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"


def test_read_board_by_id(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    boards = client.get("/api/boards/user").json()
    board_id = boards[0]["id"]

    response = client.get(f"/api/board/user/{board_id}")
    assert response.status_code == 200
    data = response.json()
    assert "columns" in data
    assert "cards" in data


def test_update_board_by_id(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    boards = client.get("/api/boards/user").json()
    board_id = boards[0]["id"]

    board = client.get(f"/api/board/user/{board_id}").json()
    board["columns"][0]["title"] = "Modified"

    response = client.put(f"/api/board/user/{board_id}", json=board)
    assert response.status_code == 200

    fetched = client.get(f"/api/board/user/{board_id}").json()
    assert fetched["columns"][0]["title"] == "Modified"


def test_board_access_denied_for_other_user(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    alice_boards = client.get("/api/boards/alice").json()
    alice_board_id = alice_boards[0]["id"]

    response = client.get(f"/api/board/bob/{alice_board_id}")
    assert response.status_code == 404


def test_multiple_boards_are_independent(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    client.get("/api/boards/user")
    board2 = client.post("/api/boards/user", json={"name": "Board 2"}).json()
    board_id2 = board2["id"]

    boards = client.get("/api/boards/user").json()
    board_id1 = boards[0]["id"]

    b1 = client.get(f"/api/board/user/{board_id1}").json()
    b1["columns"][0]["title"] = "Board1 Title"
    client.put(f"/api/board/user/{board_id1}", json=b1)

    b2 = client.get(f"/api/board/user/{board_id2}").json()
    assert b2["columns"][0]["title"] != "Board1 Title"

import hashlib
import json
import os
import sqlite3
import urllib.error
import urllib.request
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ValidationError
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="pm-backend", lifespan=lifespan)


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "pm.sqlite3"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "openai/gpt-oss-120b"


DEFAULT_BOARD: dict[str, Any] = {
    "columns": [
        {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"]},
        {"id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"]},
        {"id": "col-progress", "title": "In Progress", "cardIds": ["card-4", "card-5"]},
        {"id": "col-review", "title": "Review", "cardIds": ["card-6"]},
        {"id": "col-done", "title": "Done", "cardIds": ["card-7", "card-8"]},
    ],
    "cards": {
        "card-1": {"id": "card-1", "title": "Align roadmap themes", "details": "Draft quarterly themes with impact statements and metrics."},
        "card-2": {"id": "card-2", "title": "Gather customer signals", "details": "Review support tags, sales notes, and churn feedback."},
        "card-3": {"id": "card-3", "title": "Prototype analytics view", "details": "Sketch initial dashboard layout and key drill-downs."},
        "card-4": {"id": "card-4", "title": "Refine status language", "details": "Standardize column labels and tone across the board."},
        "card-5": {"id": "card-5", "title": "Design card layout", "details": "Add hierarchy and spacing for scanning dense lists."},
        "card-6": {"id": "card-6", "title": "QA micro-interactions", "details": "Verify hover, focus, and loading states."},
        "card-7": {"id": "card-7", "title": "Ship marketing page", "details": "Final copy approved and asset pack delivered."},
        "card-8": {"id": "card-8", "title": "Close onboarding sprint", "details": "Document release notes and share internally."},
    },
}


class Card(BaseModel):
    id: str
    title: str
    details: str
    priority: str | None = None
    due_date: str | None = None


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


class BoardMeta(BaseModel):
    id: int
    name: str
    updated_at: str


class AiTestRequest(BaseModel):
    prompt: str = "2+2"


class ChatMessage(BaseModel):
    role: str
    content: str


class AiBoardChatRequest(BaseModel):
    username: str
    board_id: int
    message: str
    history: list[ChatMessage] = []


class AiStructuredOutput(BaseModel):
    reply: str
    board: BoardData | None = None


class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class CreateBoardRequest(BaseModel):
    name: str = "New Board"


class RenameBoardRequest(BaseModel):
    name: str


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def get_connection() -> sqlite3.Connection:
    db_path = Path(getattr(app.state, "db_path", DB_PATH))
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              password_hash TEXT,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS boards (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              name TEXT NOT NULL DEFAULT 'My Board',
              board_json TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id)")

        # Migrations for upgrades from older schemas
        user_cols = {row[1] for row in conn.execute("PRAGMA table_info(users)")}
        if "password_hash" not in user_cols:
            conn.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")

        board_cols = {row[1] for row in conn.execute("PRAGMA table_info(boards)")}
        if "name" not in board_cols:
            conn.execute("ALTER TABLE boards ADD COLUMN name TEXT NOT NULL DEFAULT 'My Board'")

        # Seed a default board for any user that has none (legacy upgrade path)
        conn.execute(
            """
            INSERT INTO boards (user_id, name, board_json)
            SELECT u.id, 'My Board', ?
            FROM users u
            WHERE NOT EXISTS (SELECT 1 FROM boards b WHERE b.user_id = u.id)
            """,
            (json.dumps(DEFAULT_BOARD),),
        )

        conn.commit()


def get_or_create_user_id(conn: sqlite3.Connection, username: str) -> int:
    row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if row:
        return int(row["id"])
    cursor = conn.execute("INSERT INTO users (username) VALUES (?)", (username,))
    return int(cursor.lastrowid)


def require_user(conn: sqlite3.Connection, username: str) -> int:
    row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    return int(row["id"])


def require_board(conn: sqlite3.Connection, user_id: int, board_id: int) -> dict[str, Any]:
    row = conn.execute(
        "SELECT board_json FROM boards WHERE id = ? AND user_id = ?",
        (board_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Board not found")
    return json.loads(str(row["board_json"]))


def get_or_create_default_board(conn: sqlite3.Connection, user_id: int) -> tuple[int, dict[str, Any]]:
    row = conn.execute(
        "SELECT id, board_json FROM boards WHERE user_id = ? ORDER BY id ASC LIMIT 1",
        (user_id,),
    ).fetchone()
    if row:
        return int(row["id"]), json.loads(str(row["board_json"]))
    cursor = conn.execute(
        "INSERT INTO boards (user_id, name, board_json) VALUES (?, ?, ?)",
        (user_id, "My Board", json.dumps(DEFAULT_BOARD)),
    )
    return int(cursor.lastrowid), DEFAULT_BOARD


def persist_board(conn: sqlite3.Connection, board_id: int, payload: dict[str, Any]) -> None:
    conn.execute(
        "UPDATE boards SET board_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (json.dumps(payload), board_id),
    )


def call_openrouter_messages(messages: list[dict[str, str]]) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not set")

    data = json.dumps({"model": OPENROUTER_MODEL, "messages": messages}).encode("utf-8")
    request = urllib.request.Request(
        OPENROUTER_URL,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(
            status_code=502,
            detail=f"OpenRouter HTTP error: {exc.code}. {error_body[:200]}",
        ) from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"OpenRouter network error: {exc.reason}") from exc

    choices = response_data.get("choices") or []
    if not choices:
        raise HTTPException(status_code=502, detail="OpenRouter response missing choices")

    content = choices[0].get("message", {}).get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text = "".join(
            str(part.get("text", ""))
            for part in content
            if isinstance(part, dict) and part.get("type") == "text"
        ).strip()
        if text:
            return text
    raise HTTPException(status_code=502, detail="OpenRouter response missing text content")


def call_openrouter(prompt: str) -> str:
    return call_openrouter_messages([{"role": "user", "content": prompt}])


def extract_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="AI returned invalid JSON output") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=502, detail="AI output must be a JSON object")
    return parsed


@app.post("/api/auth/register")
def register(request: RegisterRequest) -> dict[str, str]:
    username = request.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if len(request.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    with get_connection() as conn:
        existing = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Username already taken")
        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, _hash_password(request.password)),
        )
        conn.commit()

    return {"status": "ok", "username": username}


@app.post("/api/auth/login")
def login(request: LoginRequest) -> dict[str, str]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, password_hash FROM users WHERE username = ?",
            (request.username,),
        ).fetchone()

    # Legacy "user" account predates password storage; allow the documented default
    if row and row["password_hash"] is None:
        if request.username == "user" and request.password == "password":
            return {"status": "ok", "username": request.username}
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not row or row["password_hash"] != _hash_password(request.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"status": "ok", "username": request.username}


@app.get("/api/boards/{username}", response_model=list[BoardMeta])
def list_boards(username: str) -> list[BoardMeta]:
    with get_connection() as conn:
        user_id = get_or_create_user_id(conn, username)
        get_or_create_default_board(conn, user_id)
        conn.commit()
        rows = conn.execute(
            "SELECT id, name, updated_at FROM boards WHERE user_id = ? ORDER BY id ASC",
            (user_id,),
        ).fetchall()
    return [BoardMeta(id=row["id"], name=row["name"], updated_at=row["updated_at"]) for row in rows]


@app.post("/api/boards/{username}", response_model=BoardMeta)
def create_board(username: str, request: CreateBoardRequest) -> BoardMeta:
    name = request.name.strip() or "New Board"
    with get_connection() as conn:
        user_id = get_or_create_user_id(conn, username)
        cursor = conn.execute(
            "INSERT INTO boards (user_id, name, board_json) VALUES (?, ?, ?)",
            (user_id, name, json.dumps(DEFAULT_BOARD)),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, name, updated_at FROM boards WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
    return BoardMeta(id=row["id"], name=row["name"], updated_at=row["updated_at"])


@app.patch("/api/boards/{username}/{board_id}")
def rename_board(username: str, board_id: int, request: RenameBoardRequest) -> BoardMeta:
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Board name is required")
    with get_connection() as conn:
        user_id = require_user(conn, username)
        require_board(conn, user_id, board_id)
        conn.execute(
            "UPDATE boards SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (name, board_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, name, updated_at FROM boards WHERE id = ?", (board_id,)
        ).fetchone()
    return BoardMeta(id=row["id"], name=row["name"], updated_at=row["updated_at"])


@app.delete("/api/boards/{username}/{board_id}")
def delete_board(username: str, board_id: int) -> dict[str, str]:
    with get_connection() as conn:
        user_id = require_user(conn, username)
        count = conn.execute(
            "SELECT COUNT(*) AS n FROM boards WHERE user_id = ?", (user_id,)
        ).fetchone()["n"]
        if count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete your only board")
        result = conn.execute(
            "DELETE FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Board not found")
        conn.commit()
    return {"status": "ok"}


@app.get("/api/board/{username}/{board_id}", response_model=BoardData)
def read_board_by_id(username: str, board_id: int) -> BoardData:
    with get_connection() as conn:
        user_id = require_user(conn, username)
        board = require_board(conn, user_id, board_id)
    return BoardData.model_validate(board)


@app.put("/api/board/{username}/{board_id}", response_model=BoardData)
def update_board_by_id(username: str, board_id: int, board: BoardData) -> BoardData:
    with get_connection() as conn:
        user_id = require_user(conn, username)
        require_board(conn, user_id, board_id)
        persist_board(conn, board_id, board.model_dump())
        conn.commit()
    return board


@app.get("/api/board/{username}", response_model=BoardData)
def read_board(username: str) -> BoardData:
    with get_connection() as conn:
        user_id = get_or_create_user_id(conn, username)
        _, board = get_or_create_default_board(conn, user_id)
        conn.commit()
    return BoardData.model_validate(board)


@app.put("/api/board/{username}", response_model=BoardData)
def update_board(username: str, board: BoardData) -> BoardData:
    with get_connection() as conn:
        user_id = get_or_create_user_id(conn, username)
        board_id, _ = get_or_create_default_board(conn, user_id)
        persist_board(conn, board_id, board.model_dump())
        conn.commit()
    return board


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "backend"}


@app.post("/api/ai/test")
def ai_test(request: AiTestRequest) -> dict[str, str]:
    return {
        "status": "ok",
        "model": OPENROUTER_MODEL,
        "prompt": request.prompt,
        "answer": call_openrouter(request.prompt),
    }


@app.post("/api/ai/board-chat")
def ai_board_chat(request: AiBoardChatRequest) -> dict[str, Any]:
    with get_connection() as conn:
        user_id = get_or_create_user_id(conn, request.username)
        board = require_board(conn, user_id, request.board_id)
        conn.commit()

    system_prompt = (
        "You are a Kanban assistant. The current board JSON is below. "
        "Return ONLY JSON with this schema: "
        '{"reply":"string","board":null OR {"columns":[{"id":"string","title":"string","cardIds":["string"]}],"cards":{"any-id":{"id":"string","title":"string","details":"string"}}}}. '
        f"Use board=null if no board changes are needed.\n\nCurrent board JSON:\n{json.dumps(board, ensure_ascii=True)}"
    )
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    messages.extend({"role": m.role, "content": m.content} for m in request.history)
    messages.append({"role": "user", "content": request.message})

    parsed = extract_json_object(call_openrouter_messages(messages))
    try:
        structured = AiStructuredOutput.model_validate(parsed)
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail=f"AI output schema invalid: {exc.errors()}") from exc

    if structured.board is not None:
        result_board = structured.board
        with get_connection() as conn:
            persist_board(conn, request.board_id, result_board.model_dump())
            conn.commit()
    else:
        result_board = BoardData.model_validate(board)

    return {
        "status": "ok",
        "model": OPENROUTER_MODEL,
        "reply": structured.reply,
        "board_updated": structured.board is not None,
        "board": result_board.model_dump(),
    }


docker_static_dir = Path("/app/frontend-out")
local_static_dir = Path(__file__).resolve().parents[2] / "frontend" / "out"
frontend_static_dir = docker_static_dir if docker_static_dir.exists() else local_static_dir

if frontend_static_dir.exists():
    app.mount("/", StaticFiles(directory=frontend_static_dir, html=True), name="frontend")
else:
    @app.get("/", response_class=HTMLResponse)
    def root() -> str:
        return "<h1>Frontend build not found</h1><p>Build frontend before starting backend.</p>"

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
        "card-1": {
            "id": "card-1",
            "title": "Align roadmap themes",
            "details": "Draft quarterly themes with impact statements and metrics.",
        },
        "card-2": {
            "id": "card-2",
            "title": "Gather customer signals",
            "details": "Review support tags, sales notes, and churn feedback.",
        },
        "card-3": {
            "id": "card-3",
            "title": "Prototype analytics view",
            "details": "Sketch initial dashboard layout and key drill-downs.",
        },
        "card-4": {
            "id": "card-4",
            "title": "Refine status language",
            "details": "Standardize column labels and tone across the board.",
        },
        "card-5": {
            "id": "card-5",
            "title": "Design card layout",
            "details": "Add hierarchy and spacing for scanning dense lists.",
        },
        "card-6": {
            "id": "card-6",
            "title": "QA micro-interactions",
            "details": "Verify hover, focus, and loading states.",
        },
        "card-7": {
            "id": "card-7",
            "title": "Ship marketing page",
            "details": "Final copy approved and asset pack delivered.",
        },
        "card-8": {
            "id": "card-8",
            "title": "Close onboarding sprint",
            "details": "Document release notes and share internally.",
        },
    },
}


class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


class AiTestRequest(BaseModel):
    prompt: str = "2+2"


class ChatMessage(BaseModel):
    role: str
    content: str


class AiBoardChatRequest(BaseModel):
    username: str
    message: str
    history: list[ChatMessage] = []


class AiStructuredOutput(BaseModel):
    reply: str
    board: BoardData | None = None


def get_db_path() -> Path:
    return Path(app.state.db_path) if hasattr(app.state, "db_path") else DB_PATH


def get_connection() -> sqlite3.Connection:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS boards (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL UNIQUE,
              board_json TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id)")
        conn.commit()


def get_or_create_user_id(conn: sqlite3.Connection, username: str) -> int:
    row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if row:
        return int(row["id"])

    cursor = conn.execute("INSERT INTO users (username) VALUES (?)", (username,))
    return int(cursor.lastrowid)


def get_or_create_board(conn: sqlite3.Connection, user_id: int) -> dict[str, Any]:
    row = conn.execute("SELECT board_json FROM boards WHERE user_id = ?", (user_id,)).fetchone()
    if row:
        return json.loads(str(row["board_json"]))

    board_json = json.dumps(DEFAULT_BOARD)
    conn.execute(
        "INSERT INTO boards (user_id, board_json) VALUES (?, ?)",
        (user_id, board_json),
    )
    return DEFAULT_BOARD


def call_openrouter_messages(messages: list[dict[str, str]]) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not set")

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": messages,
    }
    data = json.dumps(payload).encode("utf-8")

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

    message = choices[0].get("message", {})
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts: list[str] = []
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text":
                text_parts.append(str(part.get("text", "")))
        combined = "".join(text_parts).strip()
        if combined:
            return combined
    raise HTTPException(status_code=502, detail="OpenRouter response missing text content")


def call_openrouter(prompt: str) -> str:
    return call_openrouter_messages([{"role": "user", "content": prompt}])


def extract_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
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


def persist_board(conn: sqlite3.Connection, user_id: int, payload: dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO boards (user_id, board_json, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          board_json = excluded.board_json,
          updated_at = CURRENT_TIMESTAMP
        """,
        (user_id, json.dumps(payload)),
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "backend"}


@app.post("/api/ai/test")
def ai_test(request: AiTestRequest) -> dict[str, str]:
    answer = call_openrouter(request.prompt)
    return {
        "status": "ok",
        "model": OPENROUTER_MODEL,
        "prompt": request.prompt,
        "answer": answer,
    }


@app.post("/api/ai/board-chat")
def ai_board_chat(request: AiBoardChatRequest) -> dict[str, Any]:
    with get_connection() as conn:
        user_id = get_or_create_user_id(conn, request.username)
        board = get_or_create_board(conn, user_id)
        conn.commit()

    board_json = json.dumps(board, ensure_ascii=True)
    system_prompt = (
        "You are a Kanban assistant. The current board JSON is below. "
        "Return ONLY JSON with this schema: "
        '{"reply":"string","board":null OR {"columns":[{"id":"string","title":"string","cardIds":["string"]}],"cards":{"any-id":{"id":"string","title":"string","details":"string"}}}}. '
        f"Use board=null if no board changes are needed.\n\nCurrent board JSON:\n{board_json}"
    )
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for entry in request.history:
        messages.append({"role": entry.role, "content": entry.content})
    messages.append({"role": "user", "content": request.message})

    raw_output = call_openrouter_messages(messages)
    parsed = extract_json_object(raw_output)
    try:
        structured = AiStructuredOutput.model_validate(parsed)
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail=f"AI output schema invalid: {exc.errors()}") from exc

    board_updated = structured.board is not None
    result_board = board
    if structured.board is not None:
        result_board = structured.board.model_dump()
        with get_connection() as conn:
            persist_board(conn, user_id, result_board)
            conn.commit()

    return {
        "status": "ok",
        "model": OPENROUTER_MODEL,
        "reply": structured.reply,
        "board_updated": board_updated,
        "board": result_board,
    }


@app.get("/api/board/{username}", response_model=BoardData)
def read_board(username: str) -> BoardData:
    with get_connection() as conn:
        user_id = get_or_create_user_id(conn, username)
        board = get_or_create_board(conn, user_id)
        conn.commit()
    return BoardData.model_validate(board)


@app.put("/api/board/{username}", response_model=BoardData)
def update_board(username: str, board: BoardData) -> BoardData:
    payload = board.model_dump()
    with get_connection() as conn:
        user_id = get_or_create_user_id(conn, username)
        persist_board(conn, user_id, payload)
        conn.commit()
    return board


docker_static_dir = Path("/app/frontend-out")
local_static_dir = Path(__file__).resolve().parents[2] / "frontend" / "out"
frontend_static_dir = docker_static_dir if docker_static_dir.exists() else local_static_dir

if frontend_static_dir.exists():
    app.mount("/", StaticFiles(directory=frontend_static_dir, html=True), name="frontend")
else:
    @app.get("/", response_class=HTMLResponse)
    def root() -> str:
        return "<h1>Frontend build not found</h1><p>Build frontend before starting backend.</p>"

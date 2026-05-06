# Code Review

Reviewed against the MVP scope in `AGENTS.md`. The app is fully implemented and the core logic is correct. Issues below are ordered by impact.

---

## Bugs

### 1. `httpx` missing from backend dependencies

`fastapi.testclient.TestClient` requires `httpx` at runtime, but it is not listed in `backend/pyproject.toml`. The backend tests cannot run in a clean environment installed from `pyproject.toml`.

**Fix:** Add `httpx` to `pyproject.toml` dependencies.

```toml
dependencies = [
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.30.0",
  "httpx>=0.27.0",
  "pytest>=8.0.0",
]
```

### 2. Column rename triggers a PUT request on every keystroke

In `KanbanBoard.tsx`, `handleRenameColumn` calls `setBoard`, which triggers the save `useEffect` (watching `[board, username]`). Since the column title input fires `onChange` on every character, typing a 10-character name sends 10 PUT requests.

**Fix:** Debounce the save effect, or move column renaming to an `onBlur` commit pattern.

---

## Design Issues

### 3. Board is saved immediately after the initial load

In `KanbanBoard.tsx`:
```ts
setBoard(loadedBoard);
hasLoadedRef.current = true;  // set after setBoard
```

`setBoard` schedules a re-render. By the time React runs the save effect, `hasLoadedRef.current` is already `true` (set synchronously before the microtask flush). The guard does not prevent the post-load save. This causes a redundant PUT with identical data after every page load.

**Fix:** Set `hasLoadedRef.current = true` _before_ calling `setBoard`, or skip persisting when the incoming board is identical to the fetched one.

### 4. `@app.on_event("startup")` is deprecated

FastAPI deprecated event hooks in favour of the `lifespan` context manager. The app still works, but it logs a deprecation warning on startup.

**Fix:**
```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="pm-backend", lifespan=lifespan)
```

### 5. Backend has no authentication

The board API accepts any username string: `GET /api/board/alice` and `PUT /api/board/alice` are open to any caller. This was a known MVP decision (hardcoded credentials live only in the frontend), but it means the backend offers no real data isolation.

**Noted as MVP scope.** When auth is added, use a session token or signed cookie and resolve the username server-side instead of trusting the URL parameter.

### 6. E2E tests cannot reach the backend

`playwright.config.ts` starts `next dev` on port 3000. In dev mode, Next.js does not proxy `/api/*` calls to the FastAPI backend. Any E2E test that exercises an API call will fail unless the Docker container is also running and Next.js is configured to proxy.

No E2E test files exist under `frontend/tests/` yet, so this has not surfaced. When writing E2E tests, either:
- Point `baseURL` at the Docker container (`http://localhost:8000`), or
- Add a Next.js `rewrites` config to proxy `/api/*` to `http://localhost:8000` in dev mode.

---

## Minor

### 7. `pytest` belongs in dev dependencies

`pytest` is listed in the main `dependencies` array. It is a test-only tool and should be in a dev group to avoid being installed in the production container.

```toml
[dependency-groups]
dev = ["pytest>=8.0.0", "httpx>=0.27.0"]
```

And remove both from the main `dependencies` list. Update `Dockerfile` to install only main deps (already does `uv pip install --system -r pyproject.toml` which currently installs pytest into the container image unnecessarily).

### 8. Two separate DB connections opened in `ai_board_chat`

The route opens one connection to fetch the board, commits, closes it, then conditionally opens a second to persist the AI update. This is correct but each `get_connection()` is a new `sqlite3.connect()` call. For SQLite this is cheap, but consolidating into one `with get_connection()` block for both read and write would be cleaner.

### 9. `ai_board_chat` builds history as plain text, not structured messages

The conversation history is concatenated into a single user message string:
```python
history_text = "\n".join(f"{entry.role}: {entry.content}" for entry in request.history)
```

This works but wastes tokens and loses the message role structure the model was trained on. Passing history as individual `{"role": ..., "content": ...}` entries in the `messages` array would be more natural for a chat model.

---

## Summary of Actions

| Priority | Action |
|---|---|
| Fix now | Add `httpx` to `pyproject.toml` |
| Fix now | Debounce board save (or rename on blur) |
| Fix now | Move `hasLoadedRef.current = true` before `setBoard` |
| Soon | Migrate `@app.on_event` to `lifespan` |
| Soon | Move `pytest`/`httpx` to dev dependency group |
| When writing E2E tests | Proxy or point Playwright at the Docker server |
| Future | Add server-side auth |
| Optional | Consolidate DB connections in `ai_board_chat` |
| Optional | Pass history as structured messages to OpenRouter |

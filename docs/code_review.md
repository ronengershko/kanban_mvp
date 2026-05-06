# Code Review

Reviewed against the MVP scope in `AGENTS.md`. The app is fully implemented and the core logic is correct. Issues below are ordered by impact.

---

## Bugs

### 1. `httpx` missing from backend dependencies — FIXED

`fastapi.testclient.TestClient` requires `httpx` at runtime. Moved `pytest` and `httpx` to a `[dependency-groups] dev` section in `pyproject.toml` so the production Docker image no longer installs test tooling.

Run backend tests with: `cd backend && uv run --group dev pytest tests/`

### 2. Column rename triggered a PUT request on every keystroke — FIXED

`KanbanColumn` now holds local title state and only calls `onRename` on `onBlur`. The column input is responsive locally; the board save fires once when the user leaves the field.

---

## Design Issues

### 3. Board was saved immediately after the initial load — FIXED

Added `skipNextSaveRef` in `KanbanBoard`. The load effect sets it to `true` before calling `setBoard`, and the save effect clears it and skips when set. The load no longer causes a redundant PUT.

### 4. `@app.on_event("startup")` was deprecated — FIXED

Migrated to the `lifespan` async context manager in `backend/app/main.py`.

### 5. Backend has no authentication — NOT FIXED (intentional MVP scope)

The board API accepts any username string. Left as-is per MVP scope. When auth is added, use a session token and resolve the username server-side instead of trusting the URL parameter.

### 6. E2E tests could not reach the backend — FIXED

- `next.config.ts` now proxies `/api/*` to `http://localhost:8000` when `NODE_ENV=development`, so `next dev` routes API calls to the running Docker backend.
- `playwright.config.ts` now points `baseURL` at `http://localhost:8000` (the Docker server) and removes the `webServer` auto-start. E2E tests require the Docker container to be running first (`./scripts/start.sh`).

---

## Minor

### 7. `pytest` belonged in dev dependencies — FIXED

Covered in fix #1. Both `pytest` and `httpx` are now in `[dependency-groups] dev`.

### 8. Two separate DB connections in `ai_board_chat` — FIXED

`user_id` is now captured from the first connection and reused in the second, eliminating the redundant `get_or_create_user_id` call.

### 9. History was sent as flat text instead of structured messages — FIXED

`ai_board_chat` now builds a proper `messages` array: system prompt (with board JSON embedded), each history entry as its own `{"role", "content"}` dict, then the current user message. This matches the chat model's expected input format.

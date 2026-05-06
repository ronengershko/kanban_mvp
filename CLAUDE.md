# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Project Management MVP: a Kanban board app with AI chat sidebar. Single user (`user` / `password`), one board per user, runs locally in Docker.

## Running the App

```bash
./scripts/start.sh   # build and start Docker container (port 8000)
./scripts/stop.sh    # stop container
```

App: `http://localhost:8000` | Health: `http://localhost:8000/api/health`

Windows: use `scripts/start.ps1` / `start.bat` equivalents.

## Backend Development

The backend is Python/FastAPI (`backend/app/main.py`). Everything lives in that single file.

Run tests (requires uv installed):
```bash
cd backend && uv run --group dev pytest tests/
# single test file:
cd backend && uv run --group dev pytest tests/test_board_api.py
```

The backend also runs the frontend static build. It checks `/app/frontend-out` (Docker path) first, then falls back to `frontend/out` (local path). Build frontend first if running backend locally outside Docker.

E2E tests (`npm run test:e2e`) require the Docker server to be running first — Playwright points at `http://localhost:8000`. For local dev, `next dev` proxies `/api/*` to `http://localhost:8000` automatically.

## Frontend Development

```bash
cd frontend && npm install
npm run dev          # dev server (not connected to backend — hits /api/* directly)
npm run build        # static export to frontend/out
npm run test:unit    # vitest unit tests
npm run test:e2e     # playwright e2e tests
npm run test:all     # both
npm run lint         # eslint
```

## Architecture

**Request flow:** Browser → FastAPI (port 8000) → serves `frontend/out` static files at `/` and handles `/api/*` routes.

**Frontend** (`frontend/src/`):
- `app/page.tsx` — entry point, renders `<AuthGate />`
- `components/AuthGate.tsx` — hardcoded login check (`user` / `password`), gates access to `<KanbanBoard />`
- `components/KanbanBoard.tsx` — main board; fetches board from backend on mount, persists all mutations via `saveBoard`, renders columns/cards, hosts AI chat sidebar
- `lib/kanban.ts` — `BoardData` type + pure drag-and-drop logic (`moveCard`)
- `lib/api.ts` — three API helpers: `fetchBoard`, `saveBoard`, `aiBoardChat`

**Backend** (`backend/app/main.py`) — single-file FastAPI app:
- `GET /api/health` — health check
- `GET /api/board/{username}` — fetch board (creates user+board on first access)
- `PUT /api/board/{username}` — update board
- `POST /api/ai/test` — simple OpenRouter connectivity test
- `POST /api/ai/board-chat` — main AI route: takes `{username, message, history}`, sends board JSON + conversation history to OpenRouter, returns `{reply, board_updated, board}`

**Database:** SQLite at `backend/data/pm.sqlite3`. Tables: `users` (id, username) and `boards` (user_id UNIQUE, board_json TEXT). Board data is stored as a single JSON blob matching the `BoardData` shape. DB is auto-created on startup.

**AI:** OpenRouter via `urllib` (no SDK dependency). Model: `openai/gpt-oss-120b`. API key from `.env` (`OPENROUTER_API_KEY`). AI returns structured JSON `{reply, board}` — `board` is `null` if no changes, otherwise a full `BoardData` replacement that gets persisted.

## Color Scheme

- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991`
- Dark Navy: `#032147`
- Gray Text: `#888888`

## Coding Standards

- No over-engineering, no unnecessary defensive programming, no extra features
- No emojis
- Identify root cause before fixing — prove with evidence
- Keep README minimal

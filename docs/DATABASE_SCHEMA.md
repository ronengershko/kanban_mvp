# Database Schema Proposal (Step 5)

## Goal
Define a simple SQLite schema for MVP persistence of Kanban data, with multi-user-ready structure and MVP rule of one board per user.

## MVP Rules
- Login credentials are hardcoded in frontend for now (`user` / `password`).
- Database supports multiple users structurally.
- MVP behavior keeps exactly one board per user.

## Board JSON Shape
Board data is stored as JSON text matching frontend `BoardData`:

```json
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"] }
  ],
  "cards": {
    "card-1": { "id": "card-1", "title": "Task", "details": "Notes" }
  }
}
```

## Proposed SQLite Tables

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  board_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id);
```

## Why This Meets Requirements
- Multi-user ready: each user row is distinct and unique by `username`.
- One board per user (MVP): enforced by `boards.user_id UNIQUE`.
- Simple persistence: board state is stored as one JSON blob (`board_json`).

## CRUD Expectations
- Read board:
  1. Resolve user by `username`.
  2. Select board by `user_id`.
  3. Return parsed `board_json`.

- Update board:
  1. Resolve user by `username`.
  2. Validate payload matches expected board shape.
  3. Upsert board row for `user_id`.
  4. Update `updated_at` timestamp.

- First-time user:
  1. Create user row if missing.
  2. Create board row with default board JSON if missing.

## Database Initialization Behavior
- DB file path (proposal): `backend/data/pm.sqlite3`.
- On backend startup:
  1. Ensure parent directory exists.
  2. Open SQLite connection.
  3. Run `CREATE TABLE IF NOT EXISTS ...` statements.
  4. App starts even if DB file did not exist before startup.

## Validation Checklist (for review)
- Supports multiple users structurally.
- Enforces one board per user in MVP.
- Board JSON storage format is unambiguous.
- Read/update/first-time flows are clear enough for Step 6 implementation.

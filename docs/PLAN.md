# Project Management MVP - Execution Plan

## Part 1: Rewrite and Approve the Master Plan

**Dependencies:** none

**Goal**
Rewrite this plan into a clear, execution-ready document with testable steps for Parts 1-10, then get explicit user sign-off before any implementation work begins.

**Checklist**
- [ ] Replace high-level items with a consistent structure for each part: Goal, Checklist, Tests, Success Criteria.
- [ ] Ensure all 10 parts include actionable substeps in execution order.
- [ ] Ensure plan content matches MVP constraints in root `AGENTS.md`.
- [ ] Review the rewritten plan with the user.
- [ ] Capture explicit user approval in this part before starting Part 2.

**Tests**
- Manual doc review: confirm Parts 1-10 exist.
- Manual doc review: confirm each part has Goal, Checklist, Tests, Success Criteria.
- Manual doc review: confirm no extra features beyond MVP scope.

**Success Criteria**
- `docs/PLAN.md` is structured and implementation-ready.
- User explicitly approves the rewritten plan.
- Work does not proceed to Part 2 until approval is given.

---

## Part 2: Scaffolding (Docker + FastAPI + Scripts + Hello World)

**Dependencies:** Part 1 approved

**Goal**
Create project scaffolding so the app runs locally in Docker with FastAPI backend and scripts, serving a simple static page plus a test API endpoint.

**Checklist**
- [ ] Create backend scaffold in `backend/` using FastAPI.
- [ ] Add a basic static HTML response for `/` (hello world validation stage).
- [ ] Add a simple API endpoint (for example `/api/health`) returning JSON.
- [ ] Add Dockerfile and supporting container config for local run.
- [ ] Configure Python dependencies with `uv` for container usage.
- [ ] Add start/stop scripts in `scripts/` for Mac, Linux, and Windows.
- [ ] Document run steps briefly in project docs/README as needed.

**Tests**
- Build test: Docker image builds successfully.
- Runtime test: container starts successfully via scripts.
- HTTP test: `GET /` returns hello world static content.
- API test: `GET /api/health` returns expected JSON and status 200.
- Script test: start and stop scripts execute successfully on supported OS shell conventions.

**Success Criteria**
- App starts locally in Docker from scripts.
- Static hello world is served at `/`.
- API endpoint responds correctly.
- Scaffold is ready for frontend integration in Part 3.

---

## Part 3: Add Frontend Static Build and Serving

**Dependencies:** Part 2 complete

**Goal**
Serve the existing frontend Kanban demo as static assets through FastAPI at `/`.

**Checklist**
- [ ] Configure frontend build output for static serving.
- [ ] Integrate frontend build step into Docker workflow.
- [ ] Configure FastAPI static file serving for built frontend at `/`.
- [ ] Ensure client-side routing fallback behavior works for app paths if needed.
- [ ] Keep backend hello world scaffold replaced by frontend delivery path.

**Tests**
- Build test: frontend static build succeeds in container flow.
- Integration test: `GET /` returns the Kanban app UI.
- Smoke test: app assets load without missing file errors.
- Unit test run: existing frontend unit tests pass.
- E2E test run: existing frontend e2e tests pass in configured environment.

**Success Criteria**
- Kanban demo is visible at `/` from Dockerized app.
- Static assets are served by FastAPI correctly.
- Existing frontend tests pass in project workflow.

---

## Part 4: Add Fake User Sign-In/Sign-Out

**Dependencies:** Part 3 complete

**Goal**
Require login before showing Kanban, using MVP credentials (`user` / `password`) and support logout.

**Checklist**
- [ ] Add login UI as default entry when user is not authenticated.
- [ ] Implement credential check against hardcoded values (`user`, `password`).
- [ ] Store authenticated session state appropriately for MVP local behavior.
- [ ] Gate Kanban UI behind authenticated state.
- [ ] Add logout action to clear authenticated state and return to login screen.
- [ ] Keep implementation simple with no extra auth features.

**Tests**
- Unit test: valid credentials authenticate successfully.
- Unit test: invalid credentials are rejected with clear UI feedback.
- Integration test: unauthenticated user cannot access Kanban view.
- Integration test: authenticated user sees Kanban view.
- Integration test: logout returns user to login view and removes access.
- E2E test: complete login -> Kanban -> logout flow passes.

**Success Criteria**
- Only logged-in users can access Kanban UI.
- Login works only for `user` / `password`.
- Logout reliably returns to unauthenticated state.

---

## Part 5: Database Modeling Proposal and Sign-Off

**Dependencies:** Part 4 complete

**Goal**
Define and document SQLite schema/approach for persisting one board per user (MVP), including JSON-based Kanban data storage.

**Checklist**
- [ ] Draft schema proposal for users and boards (multi-user capable design, MVP-limited behavior).
- [ ] Define how Kanban board JSON is stored and versioned (if needed).
- [ ] Define key identifiers and relationships.
- [ ] Document CRUD expectations for board retrieval and updates.
- [ ] Document database initialization behavior when DB does not exist.
- [ ] Save proposal in `docs/` and request user sign-off before implementation.

**Tests**
- Manual schema review: supports multiple users structurally.
- Manual schema review: enforces one board per user in MVP logic/constraints.
- Manual review: JSON storage approach is documented and unambiguous.

**Success Criteria**
- Database design is documented clearly in `docs/`.
- Design supports future multi-user growth while keeping MVP simple.
- User approves schema approach before backend persistence implementation.

---

## Part 6: Backend API for Kanban Persistence

**Dependencies:** Part 5 approved

**Goal**
Implement backend routes that read and update a user's Kanban board in SQLite, creating DB automatically if missing.

**Checklist**
- [ ] Implement DB initialization and table creation on startup if DB file is absent.
- [ ] Implement route to fetch board for signed-in user.
- [ ] Implement route to update board for signed-in user.
- [ ] Add input validation for board payload shape.
- [ ] Ensure MVP rule of one board per user is enforced.
- [ ] Keep API surface minimal for MVP needs.

**Tests**
- Backend unit test: DB auto-creation path works.
- Backend unit test: board fetch returns persisted board.
- Backend unit test: board update persists correctly.
- Backend unit test: invalid payload is rejected with appropriate status code.
- Integration test: first-time user flow initializes board correctly.

**Success Criteria**
- API can reliably read/write Kanban board per user.
- DB is created automatically when missing.
- Behavior is covered by backend tests.

---

## Part 7: Frontend + Backend Integration

**Dependencies:** Part 6 complete

**Goal**
Connect frontend Kanban to backend APIs so board state persists across reloads.

**Checklist**
- [ ] Replace frontend local-only board initialization with backend fetch on authenticated load.
- [ ] Persist board-changing actions (rename/move/edit/create/delete) through backend update API.
- [ ] Add loading and error handling states for network operations.
- [ ] Ensure login context is used to load correct user board.
- [ ] Keep UX responsive and avoid unnecessary complexity.

**Tests**
- Unit test: API client helpers map request/response correctly.
- Integration test: initial board loads from backend.
- Integration test: each board mutation persists and survives reload.
- Integration test: API failure states show expected UI feedback.
- E2E test: authenticated user updates board, refreshes, and sees persisted changes.

**Success Criteria**
- Kanban behavior is backend-backed and persistent.
- Reload preserves latest saved board state.
- Integration behavior is verified by tests.

---

## Part 8: AI Connectivity via OpenRouter

**Dependencies:** Part 7 complete

**Goal**
Enable backend AI call through OpenRouter using configured model `openai/gpt-oss-120b`, and verify with a simple connectivity test.

**Checklist**
- [ ] Add backend AI client using `OPENROUTER_API_KEY` from root `.env`.
- [ ] Configure model to `openai/gpt-oss-120b`.
- [ ] Add a minimal backend AI test route or internal call path for connectivity check.
- [ ] Implement simple prompt test (`2+2`) and response handling.
- [ ] Add robust error handling for missing key and provider/API failures.

**Tests**
- Unit test: missing API key path returns clear configuration error.
- Integration test: mocked OpenRouter call path returns expected output shape.
- Manual connectivity test: live `2+2` call succeeds with valid key.
- Manual failure test: invalid key produces controlled error response.

**Success Criteria**
- Backend can successfully call OpenRouter with configured model.
- `2+2` connectivity test passes in local environment.
- Error states are clear and non-crashing.

---

## Part 9: AI Structured Output for Chat + Board Updates

**Dependencies:** Part 8 complete

**Goal**
Extend AI backend call so each request includes board JSON + user message + conversation history, and returns structured output with assistant reply plus optional board update.

**Checklist**
- [ ] Define structured response schema containing: assistant message, optional board update payload.
- [ ] Build backend prompt assembly with current board JSON and conversation history.
- [ ] Implement AI route that validates and parses structured output.
- [ ] Apply optional board update server-side when present and valid.
- [ ] Persist updated board to DB when AI sends changes.
- [ ] Return structured response to frontend in a stable API contract.

**Tests**
- Unit test: schema validation accepts valid structured output and rejects invalid output.
- Unit test: optional board update path applies valid updates correctly.
- Unit test: no-update path leaves board unchanged.
- Integration test: request with history + board returns assistant response.
- Integration test: AI-driven board update persists to DB.
- Integration test: malformed model output is handled gracefully.

**Success Criteria**
- Backend consistently sends board context and chat history to AI.
- Structured output is validated and parsed safely.
- Optional AI board updates are persisted correctly.

---

## Part 10: Sidebar AI Chat UI + Automatic Board Refresh

**Dependencies:** Part 9 complete

**Goal**
Add AI chat sidebar to frontend; allow conversation with backend AI and automatically reflect AI-driven board updates in the Kanban UI.

**Checklist**
- [ ] Add sidebar chat UI with message history display.
- [ ] Add input + submit flow wired to backend AI route.
- [ ] Render assistant responses in chat thread.
- [ ] Detect and apply returned board updates from structured response.
- [ ] Trigger board state refresh/update after AI modifications.
- [ ] Keep styling aligned with defined project color scheme.

**Tests**
- Component test: chat sidebar renders and accepts input.
- Integration test: user message reaches backend and response is rendered.
- Integration test: AI response with board update changes Kanban UI.
- Integration test: AI response without board update leaves board unchanged.
- E2E test: full flow from login -> chat request -> optional board update -> refreshed board.

**Success Criteria**
- Users can chat with AI from sidebar reliably.
- AI responses appear in UI conversation.
- Any AI-issued board changes are reflected automatically without manual reload.

---

## Execution Order Rule

- Execute parts strictly in sequence: Part 1 -> Part 2 -> ... -> Part 10.
- Do not begin any part until dependencies are complete.
- For gated parts that require user approval (Part 1 and Part 5), pause and wait for explicit sign-off before continuing.

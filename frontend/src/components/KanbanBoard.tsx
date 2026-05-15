"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useDarkMode } from "@/lib/useDarkMode";
import {
  pointerWithin,
  rectIntersection,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { CardDetailModal } from "@/components/CardDetailModal";
import {
  createId,
  initialData,
  moveCard,
  addColumn,
  deleteColumn,
  updateCard,
  type BoardData,
  type Card,
} from "@/lib/kanban";
import {
  aiBoardChat,
  fetchBoard,
  saveBoard,
  listBoards,
  createBoard,
  deleteBoard,
  renameBoard,
  type ChatMessage,
  type BoardMeta,
} from "@/lib/api";

const collisionDetectionStrategy: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  return pointer.length > 0 ? pointer : rectIntersection(args);
};

type KanbanBoardProps = {
  username: string;
  onLogout?: () => void;
};

export const KanbanBoard = ({ username, onLogout }: KanbanBoardProps) => {
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [board, setBoard] = useState<BoardData>(() => initialData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showBoardPanel, setShowBoardPanel] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newBoardName, setNewBoardName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [boardActionError, setBoardActionError] = useState("");

  const hasLoadedRef = useRef(false);
  const skipNextSaveRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    setIsLoading(true);
    setError("");
    listBoards(username)
      .then((loaded) => {
        setBoards(loaded);
        if (loaded.length > 0) setActiveBoardId(loaded[0].id);
      })
      .catch(() => {
        setError("Failed to load boards");
        setIsLoading(false);
      });
  }, [username]);

  useEffect(() => {
    if (activeBoardId === null) return;
    let isActive = true;
    setIsLoading(true);
    setError("");
    hasLoadedRef.current = false;

    fetchBoard(username, activeBoardId)
      .then((loadedBoard) => {
        if (!isActive) return;
        hasLoadedRef.current = true;
        skipNextSaveRef.current = true;
        setBoard(loadedBoard);
        setChatMessages([]);
      })
      .catch(() => {
        if (isActive) setError("Failed to load board");
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => { isActive = false; };
  }, [username, activeBoardId]);

  useEffect(() => {
    if (!hasLoadedRef.current || activeBoardId === null) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    saveBoard(username, activeBoardId, board).catch(() => setError("Failed to save board"));
  }, [board, username, activeBoardId]);

  function handleDragStart(event: DragStartEvent) {
    setActiveCardId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCardId(null);
    if (!over || active.id === over.id) return;
    setBoard((prev) => ({
      ...prev,
      columns: moveCard(prev.columns, active.id as string, over.id as string),
    }));
  }

  function handleRenameColumn(columnId: string, title: string) {
    setBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((c) => (c.id === columnId ? { ...c, title } : c)),
    }));
  }

  function handleAddCard(columnId: string, title: string, details: string) {
    const id = createId("card");
    setBoard((prev) => ({
      ...prev,
      cards: { ...prev.cards, [id]: { id, title, details: details || "No details yet." } },
      columns: prev.columns.map((c) =>
        c.id === columnId ? { ...c, cardIds: [...c.cardIds, id] } : c
      ),
    }));
  }

  function handleDeleteCard(columnId: string, cardId: string) {
    setBoard((prev) => {
      const cards = { ...prev.cards };
      delete cards[cardId];
      return {
        cards,
        columns: prev.columns.map((c) =>
          c.id === columnId ? { ...c, cardIds: c.cardIds.filter((id) => id !== cardId) } : c
        ),
      };
    });
  }

  function handleEditCard(updated: Card) {
    setBoard((prev) => updateCard(prev, updated));
  }

  function handleDeleteColumn(columnId: string) {
    setBoard((prev) => deleteColumn(prev, columnId));
  }

  function handleAddColumn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBoard((prev) => addColumn(prev, newColumnName.trim() || "New Column"));
    setNewColumnName("");
    setAddingColumn(false);
  }

  async function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || isChatLoading || activeBoardId === null) return;

    const historyBeforeSend = chatMessages;
    setChatMessages([...historyBeforeSend, { role: "user", content: trimmed }]);
    setChatInput("");
    setChatError("");
    setIsChatLoading(true);

    try {
      const response = await aiBoardChat(username, activeBoardId, trimmed, historyBeforeSend);
      setChatMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
      if (response.board_updated) {
        skipNextSaveRef.current = true;
        setBoard(response.board);
      }
    } catch {
      setChatError("AI chat failed");
    } finally {
      setIsChatLoading(false);
    }
  }

  async function handleCreateBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBoardActionError("");
    try {
      const created = await createBoard(username, newBoardName.trim() || "New Board");
      setBoards((prev) => [...prev, created]);
      setActiveBoardId(created.id);
      setNewBoardName("");
      setShowBoardPanel(false);
    } catch {
      setBoardActionError("Failed to create board");
    }
  }

  async function handleDeleteBoard(boardId: number) {
    setBoardActionError("");
    try {
      await deleteBoard(username, boardId);
      const updated = boards.filter((b) => b.id !== boardId);
      setBoards(updated);
      if (activeBoardId === boardId) {
        setActiveBoardId(updated.length > 0 ? updated[0].id : null);
      }
    } catch (err) {
      setBoardActionError(err instanceof Error ? err.message : "Failed to delete board");
    }
  }

  function handleStartRename(boardId: number, currentName: string) {
    setRenamingId(boardId);
    setRenameValue(currentName);
  }

  async function handleRenameBoard(boardId: number) {
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    setBoardActionError("");
    try {
      const updated = await renameBoard(username, boardId, name);
      setBoards((prev) => prev.map((b) => (b.id === boardId ? updated : b)));
    } catch {
      setBoardActionError("Failed to rename board");
    } finally {
      setRenamingId(null);
    }
  }

  const { dark, toggle: toggleDark } = useDarkMode();
  const activeBoard = boards.find((b) => b.id === activeBoardId);
  const editingCardColumn = editingCard
    ? board.columns.find((c) => c.cardIds.includes(editingCard.id))
    : null;
  const activeCard = activeCardId ? board.cards[activeCardId] : null;

  if (isLoading && boards.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
        <p className="text-sm text-[var(--gray-text)]">Loading...</p>
      </main>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        {/* Header */}
        <header className="flex items-center justify-between gap-6 rounded-[32px] border border-[var(--stroke)] bg-[var(--surface-header)] px-8 py-5 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex items-center gap-5 min-w-0">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                {username}
              </p>
              <h1 className="mt-1 font-display text-3xl font-semibold text-[var(--navy-dark)]">
                {activeBoard?.name ?? "Kanban Studio"}
              </h1>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              {board.columns.map((column) => (
                <div
                  key={column.id}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--stroke)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-yellow)]" />
                  {column.title}
                </div>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="button"
              onClick={toggleDark}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              className="flex items-center gap-2 rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm font-semibold text-[var(--gray-text)] transition hover:border-[var(--accent-yellow)] hover:text-[var(--accent-yellow)]"
            >
              {dark ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.1 3.1l1.06 1.06M11.84 11.84l1.06 1.06M3.1 12.9l1.06-1.06M11.84 4.16l1.06-1.06" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M13.5 10.5A6 6 0 015.5 2.5a6 6 0 108 8z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowBoardPanel((v) => !v)}
              className="flex items-center gap-2 rounded-xl border border-[var(--stroke)] px-4 py-2 text-sm font-semibold text-[var(--gray-text)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="1" y="2" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.4"/>
                <rect x="6.5" y="2" width="4" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/>
                <rect x="6.5" y="9.5" width="4" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
              Boards
            </button>
            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-2 rounded-xl border border-[var(--stroke)] px-4 py-2 text-sm font-semibold text-[var(--gray-text)] transition hover:border-[var(--secondary-purple)] hover:text-[var(--secondary-purple)]"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5M9.5 9.5L13 7M13 7L9.5 4.5M13 7H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Log out
              </button>
            ) : null}
          </div>
        </header>

        {/* Board panel */}
        {showBoardPanel && (
          <div className="rounded-[24px] border border-[var(--stroke)] bg-[var(--surface-header)] p-5 shadow-[var(--shadow)]">
            <h2 className="text-base font-semibold text-[var(--navy-dark)]">Your Boards</h2>
            {boardActionError ? (
              <p className="mt-2 text-sm text-red-600">{boardActionError}</p>
            ) : null}
            <ul className="mt-3 space-y-2">
              {boards.map((b) => (
                <li
                  key={b.id}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 transition ${
                    b.id === activeBoardId
                      ? "bg-[var(--primary-blue)]/10 text-[var(--primary-blue)]"
                      : "hover:bg-[var(--surface)] text-[var(--navy-dark)]"
                  }`}
                >
                  {renamingId === b.id ? (
                    <form
                      className="flex flex-1 items-center gap-2"
                      onSubmit={(e) => { e.preventDefault(); void handleRenameBoard(b.id); }}
                    >
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="flex-1 rounded border border-[var(--stroke)] bg-[var(--surface-strong)] px-2 py-1 text-sm text-[var(--navy-dark)]"
                      />
                      <button type="submit" className="text-xs font-semibold text-[var(--primary-blue)]">
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="text-xs text-[var(--gray-text)]"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex-1 text-left text-sm font-semibold"
                        onClick={() => {
                          setActiveBoardId(b.id);
                          setShowBoardPanel(false);
                        }}
                      >
                        {b.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartRename(b.id, b.name)}
                        className="text-xs text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
                        title="Rename"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteBoard(b.id)}
                        className="text-xs text-[var(--gray-text)] hover:text-red-500"
                        title="Delete"
                        disabled={boards.length <= 1}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2 3h8M5 3V2h2v1M4 3v6.5a.5.5 0 00.5.5h3a.5.5 0 00.5-.5V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>

            <form onSubmit={(e) => void handleCreateBoard(e)} className="mt-4 flex gap-2">
              <input
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="New board name..."
                className="flex-1 rounded-lg border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--navy-dark)]"
              />
              <button
                type="submit"
                className="rounded-lg bg-[var(--primary-blue)] px-4 py-2 text-sm font-semibold text-white"
              >
                Create
              </button>
            </form>
          </div>
        )}

        {/* Main grid */}
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-[var(--gray-text)]">Loading board...</p>
            </div>
          ) : (
            <>
            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetectionStrategy}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className={board.columns.length > 5 ? "overflow-x-auto pb-2" : ""}>
              <section
                className="grid gap-4 items-start"
                style={{ gridTemplateColumns: `repeat(${board.columns.length}, minmax(0, 1fr)) 180px` }}
              >
                {board.columns.map((column) => (
                  <div key={column.id} className="min-w-0 group">
                    <KanbanColumn
                      column={column}
                      cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
                      onRename={handleRenameColumn}
                      onAddCard={handleAddCard}
                      onDeleteCard={handleDeleteCard}
                      onDeleteColumn={handleDeleteColumn}
                      onEditCard={(card) => setEditingCard(card)}
                    />
                  </div>
                ))}
                <div className="flex flex-col gap-2 pt-1">
                  {addingColumn ? (
                    <form
                      onSubmit={handleAddColumn}
                      className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-3 space-y-2"
                    >
                      <input
                        autoFocus
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder="Column name"
                        className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-semibold text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                      />
                      <div className="flex gap-2">
                        <button type="submit" className="rounded-full bg-[var(--primary-blue)] px-3 py-1.5 text-xs font-semibold text-white">
                          Add
                        </button>
                        <button type="button" onClick={() => { setAddingColumn(false); setNewColumnName(""); }} className="rounded-full border border-[var(--stroke)] px-3 py-1.5 text-xs font-semibold text-[var(--gray-text)]">
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingColumn(true)}
                      className="flex items-center gap-2 rounded-3xl border border-dashed border-[var(--stroke)] px-4 py-3 text-sm font-semibold text-[var(--gray-text)] hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)] transition"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      Add column
                    </button>
                  )}
                </div>
              </section>
              </div>
              <DragOverlay>
                {activeCard ? (
                  <div className="w-[240px]">
                    <KanbanCardPreview card={activeCard} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {editingCard && (
              <CardDetailModal
                card={editingCard}
                columnTitle={editingCardColumn?.title ?? ""}
                onSave={handleEditCard}
                onDelete={() => {
                  if (editingCardColumn) handleDeleteCard(editingCardColumn.id, editingCard.id);
                }}
                onClose={() => setEditingCard(null)}
              />
            )}
            </>
          )}

          {/* AI sidebar */}
          <aside className="flex min-h-[520px] flex-col rounded-[24px] border border-[var(--stroke)] bg-[var(--surface-header)] p-4 shadow-[var(--shadow)]">
            <h2 className="text-lg font-semibold text-[var(--navy-dark)]">AI Assistant</h2>
            <p className="mt-1 text-sm text-[var(--gray-text)]">
              Ask me to create, edit, or move cards.
            </p>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {chatMessages.length === 0 ? (
                <p className="text-sm text-[var(--gray-text)]">No messages yet.</p>
              ) : (
                chatMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={
                      message.role === "user"
                        ? "ml-6 rounded-xl bg-[var(--primary-blue)]/10 px-3 py-2 text-sm text-[var(--navy-dark)]"
                        : "mr-6 rounded-xl bg-[var(--surface)] px-3 py-2 text-sm text-[var(--navy-dark)]"
                    }
                  >
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--gray-text)]">
                      {message.role}
                    </p>
                    <p>{message.content}</p>
                  </div>
                ))
              )}
            </div>

            {chatError ? <p className="mt-3 text-sm text-red-600">{chatError}</p> : null}

            <form onSubmit={(e) => void handleChatSubmit(e)} className="mt-3 flex gap-2">
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask AI to update the board..."
                className="flex-1 rounded-lg border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--navy-dark)]"
              />
              <button
                type="submit"
                disabled={isChatLoading || activeBoardId === null}
                className="rounded-lg bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isChatLoading ? "Sending..." : "Send"}
              </button>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
};

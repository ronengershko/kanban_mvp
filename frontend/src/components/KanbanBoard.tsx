"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { createId, initialData, moveCard, type BoardData } from "@/lib/kanban";
import { aiBoardChat, fetchBoard, saveBoard, type ChatMessage } from "@/lib/api";

type KanbanBoardProps = {
  username: string;
  onLogout?: () => void;
};

export const KanbanBoard = ({ username, onLogout }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData>(() => initialData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const hasLoadedRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board.cards, [board.cards]);
  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    return rectIntersection(args);
  };

  useEffect(() => {
    let isActive = true;

    const loadBoard = async () => {
      setIsLoading(true);
      setError("");
      try {
        const loadedBoard = await fetchBoard(username);
        if (isActive) {
          setBoard(loadedBoard);
          hasLoadedRef.current = true;
        }
      } catch {
        if (isActive) {
          setError("Failed to load board");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadBoard();

    return () => {
      isActive = false;
    };
  }, [username]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      return;
    }

    const persist = async () => {
      try {
        await saveBoard(username, board);
      } catch {
        setError("Failed to save board");
      }
    };

    persist();
  }, [board, username]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    setBoard((prev) => ({
      ...prev,
      columns: moveCard(prev.columns, active.id as string, over.id as string),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    setBoard((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    setBoard((prev) => {
      return {
        ...prev,
        cards: Object.fromEntries(
          Object.entries(prev.cards).filter(([id]) => id !== cardId)
        ),
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cardIds: column.cardIds.filter((id) => id !== cardId),
              }
            : column
        ),
      };
    });
  };

  const handleChatSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || isChatLoading) {
      return;
    }

    const nextHistory: ChatMessage[] = [...chatMessages, { role: "user", content: trimmed }];
    setChatMessages(nextHistory);
    setChatInput("");
    setChatError("");
    setIsChatLoading(true);

    try {
      const response = await aiBoardChat(username, trimmed, chatMessages);
      setChatMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
      if (response.board_updated) {
        setBoard(response.board);
      }
    } catch {
      setChatError("AI chat failed");
    } finally {
      setIsChatLoading(false);
    }
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
        <p className="text-sm text-[var(--gray-text)]">Loading board...</p>
      </main>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                Focus
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                One board. Five columns. Zero clutter.
              </p>
              {onLogout ? (
                <button
                  type="button"
                  onClick={onLogout}
                  className="mt-4 rounded-lg bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white"
                >
                  Log out
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </header>

        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <section className="grid gap-6 lg:grid-cols-5">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId])}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                />
              ))}
            </section>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[260px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          <aside className="flex min-h-[520px] flex-col rounded-[24px] border border-[var(--stroke)] bg-white/90 p-4 shadow-[var(--shadow)]">
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

            <form onSubmit={handleChatSubmit} className="mt-3 flex gap-2">
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask AI to update the board..."
                className="flex-1 rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={isChatLoading}
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

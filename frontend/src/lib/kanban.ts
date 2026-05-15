export type Priority = "high" | "medium" | "low";

export type Card = {
  id: string;
  title: string;
  details: string;
  priority?: Priority;
  due_date?: string;
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

export type BoardData = {
  columns: Column[];
  cards: Record<string, Card>;
};

export const initialData: BoardData = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    { id: "col-progress", title: "In Progress", cardIds: ["card-4", "card-5"] },
    { id: "col-review", title: "Review", cardIds: ["card-6"] },
    { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Align roadmap themes", details: "Draft quarterly themes with impact statements and metrics." },
    "card-2": { id: "card-2", title: "Gather customer signals", details: "Review support tags, sales notes, and churn feedback." },
    "card-3": { id: "card-3", title: "Prototype analytics view", details: "Sketch initial dashboard layout and key drill-downs." },
    "card-4": { id: "card-4", title: "Refine status language", details: "Standardize column labels and tone across the board." },
    "card-5": { id: "card-5", title: "Design card layout", details: "Add hierarchy and spacing for scanning dense lists." },
    "card-6": { id: "card-6", title: "QA micro-interactions", details: "Verify hover, focus, and loading states." },
    "card-7": { id: "card-7", title: "Ship marketing page", details: "Final copy approved and asset pack delivered." },
    "card-8": { id: "card-8", title: "Close onboarding sprint", details: "Document release notes and share internally." },
  },
};

function findColumn(columns: Column[], id: string): { column: Column; isColumnId: boolean } | null {
  const direct = columns.find((c) => c.id === id);
  if (direct) return { column: direct, isColumnId: true };
  const owning = columns.find((c) => c.cardIds.includes(id));
  if (owning) return { column: owning, isColumnId: false };
  return null;
}

export function moveCard(columns: Column[], activeId: string, overId: string): Column[] {
  const active = findColumn(columns, activeId);
  const over = findColumn(columns, overId);
  if (!active || !over) return columns;

  const activeIndex = active.column.cardIds.indexOf(activeId);
  if (activeIndex === -1) return columns;

  if (active.column.id === over.column.id) {
    const next = [...active.column.cardIds];
    next.splice(activeIndex, 1);
    const insertAt = over.isColumnId ? next.length : next.indexOf(overId);
    if (insertAt === activeIndex) return columns;
    next.splice(insertAt, 0, activeId);
    return columns.map((c) => (c.id === active.column.id ? { ...c, cardIds: next } : c));
  }

  const nextActive = [...active.column.cardIds];
  nextActive.splice(activeIndex, 1);

  const nextOver = [...over.column.cardIds];
  const insertAt = over.isColumnId ? nextOver.length : nextOver.indexOf(overId);
  nextOver.splice(insertAt === -1 ? nextOver.length : insertAt, 0, activeId);

  return columns.map((c) => {
    if (c.id === active.column.id) return { ...c, cardIds: nextActive };
    if (c.id === over.column.id) return { ...c, cardIds: nextOver };
    return c;
  });
}

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
}

export function addColumn(board: BoardData, title: string): BoardData {
  return {
    ...board,
    columns: [...board.columns, { id: createId("col"), title, cardIds: [] }],
  };
}

export function deleteColumn(board: BoardData, columnId: string): BoardData {
  const column = board.columns.find((c) => c.id === columnId);
  if (!column) return board;
  const cards = { ...board.cards };
  for (const cardId of column.cardIds) delete cards[cardId];
  return {
    columns: board.columns.filter((c) => c.id !== columnId),
    cards,
  };
}

export function updateCard(board: BoardData, updated: Card): BoardData {
  return { ...board, cards: { ...board.cards, [updated.id]: updated } };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isOverdue(due_date: string): boolean {
  return new Date(due_date) < startOfToday();
}

export function isDueToday(due_date: string): boolean {
  const today = new Date();
  const d = new Date(due_date);
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

import {
  moveCard,
  addColumn,
  deleteColumn,
  updateCard,
  isOverdue,
  isDueToday,
  type Column,
  type BoardData,
  type Card,
} from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });
});

const baseBoard: BoardData = {
  columns: [
    { id: "col-a", title: "A", cardIds: ["card-1"] },
    { id: "col-b", title: "B", cardIds: ["card-2"] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "One", details: "d1" },
    "card-2": { id: "card-2", title: "Two", details: "d2" },
  },
};

describe("addColumn", () => {
  it("appends a new empty column", () => {
    const result = addColumn(baseBoard, "New");
    expect(result.columns).toHaveLength(3);
    expect(result.columns[2].title).toBe("New");
    expect(result.columns[2].cardIds).toEqual([]);
  });

  it("does not mutate the original board", () => {
    addColumn(baseBoard, "X");
    expect(baseBoard.columns).toHaveLength(2);
  });
});

describe("deleteColumn", () => {
  it("removes the column and its cards", () => {
    const result = deleteColumn(baseBoard, "col-a");
    expect(result.columns).toHaveLength(1);
    expect(result.columns[0].id).toBe("col-b");
    expect(result.cards["card-1"]).toBeUndefined();
    expect(result.cards["card-2"]).toBeDefined();
  });

  it("returns board unchanged for unknown column id", () => {
    const result = deleteColumn(baseBoard, "col-x");
    expect(result).toBe(baseBoard);
  });
});

describe("updateCard", () => {
  it("updates matching card, leaves others unchanged", () => {
    const updated: Card = { id: "card-1", title: "Updated", details: "new", priority: "high" };
    const result = updateCard(baseBoard, updated);
    expect(result.cards["card-1"].title).toBe("Updated");
    expect(result.cards["card-1"].priority).toBe("high");
    expect(result.cards["card-2"]).toBe(baseBoard.cards["card-2"]);
  });
});

describe("isOverdue / isDueToday", () => {
  it("isOverdue is true for past dates", () => {
    expect(isOverdue("2000-01-01")).toBe(true);
  });

  it("isOverdue is false for future dates", () => {
    expect(isOverdue("2099-12-31")).toBe(false);
  });

  it("isDueToday matches today's date", () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(isDueToday(iso)).toBe(true);
  });

  it("isDueToday is false for other dates", () => {
    expect(isDueToday("2000-01-01")).toBe(false);
  });
});

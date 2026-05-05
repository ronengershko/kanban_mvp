import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/lib/kanban";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "GET" && url.includes("/api/board/")) {
        return {
          ok: true,
          json: async () => initialData,
        } as Response;
      }

      if (method === "POST" && url === "/api/ai/board-chat") {
        return {
          ok: true,
          json: async () => ({
            status: "ok",
            model: "openai/gpt-oss-120b",
            reply: "Done.",
            board_updated: false,
            board: initialData,
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => JSON.parse(String(init.body)),
      } as Response;
    }) as typeof fetch;
  });

  it("renders five columns", async () => {
    render(<KanbanBoard username="user" />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<KanbanBoard username="user" />);
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard username="user" />);
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("persists board updates to backend", async () => {
    render(<KanbanBoard username="user" />);
    await screen.findAllByTestId(/column-/i);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "Saved Name");

    expect(global.fetch).toHaveBeenCalledWith("/api/board/user", expect.objectContaining({
      method: "PUT",
    }));
  });

  it("sends chat prompt and applies AI board update", async () => {
    const updatedBoard = {
      ...initialData,
      columns: [{ ...initialData.columns[0], title: "AI Renamed" }, ...initialData.columns.slice(1)],
    };
    global.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "GET" && url.includes("/api/board/")) {
        return { ok: true, json: async () => initialData } as Response;
      }
      if (method === "POST" && url === "/api/ai/board-chat") {
        return {
          ok: true,
          json: async () => ({
            status: "ok",
            model: "openai/gpt-oss-120b",
            reply: "Renamed it.",
            board_updated: true,
            board: updatedBoard,
          }),
        } as Response;
      }
      return { ok: true, json: async () => JSON.parse(String(init?.body ?? "{}")) } as Response;
    }) as typeof fetch;

    render(<KanbanBoard username="user" />);
    await screen.findAllByTestId(/column-/i);
    await userEvent.type(screen.getByPlaceholderText(/ask ai to update the board/i), "rename backlog");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Renamed it.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("AI Renamed")).toBeInTheDocument();
  });
});

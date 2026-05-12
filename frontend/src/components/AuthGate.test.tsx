import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AuthGate } from "@/components/AuthGate";
import { initialData } from "@/lib/kanban";

const MOCK_BOARDS = [{ id: 1, name: "My Board", updated_at: "2024-01-01T00:00:00" }];

function makeFetch(loginOk: boolean) {
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (method === "POST" && url === "/api/auth/login") {
      if (loginOk) {
        return { ok: true, json: async () => ({ status: "ok", username: "user" }) } as Response;
      }
      return {
        ok: false,
        json: async () => ({ detail: "Invalid credentials" }),
      } as Response;
    }

    if (method === "GET" && url.includes("/api/boards/")) {
      return { ok: true, json: async () => MOCK_BOARDS } as Response;
    }

    if (method === "GET" && url.includes("/api/board/")) {
      return { ok: true, json: async () => initialData } as Response;
    }

    return { ok: true, json: async () => JSON.parse(String(init?.body ?? "{}")) } as Response;
  }) as typeof fetch;
}

describe("AuthGate", () => {
  it("shows login form by default", () => {
    render(<AuthGate />);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows register form when switching mode", async () => {
    const user = userEvent.setup();
    render(<AuthGate />);
    await user.click(screen.getByRole("button", { name: /register/i }));
    expect(screen.getByRole("heading", { name: /create account/i })).toBeInTheDocument();
  });

  it("rejects invalid credentials from server", async () => {
    global.fetch = makeFetch(false);
    const user = userEvent.setup();
    render(<AuthGate />);

    await user.type(screen.getByLabelText(/username/i), "wrong");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid credentials/i);
  });

  it("logs in and logs out", async () => {
    global.fetch = makeFetch(true);
    const user = userEvent.setup();
    render(<AuthGate />);

    await user.type(screen.getByLabelText(/username/i), "user");
    await user.type(screen.getByLabelText(/password/i), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("heading", { name: /my board/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /log out/i }));

    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });
});

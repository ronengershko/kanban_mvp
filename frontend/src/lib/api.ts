import type { BoardData } from "@/lib/kanban";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiBoardChatResponse = {
  status: string;
  model: string;
  reply: string;
  board_updated: boolean;
  board: BoardData;
};

export type BoardMeta = {
  id: number;
  name: string;
  updated_at: string;
};

async function request<T>(
  url: string,
  init: RequestInit | undefined,
  fallbackError: string
): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(data.detail ?? fallbackError);
  }
  return (await response.json()) as T;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function userUrl(username: string, suffix = ""): string {
  return `/api/boards/${encodeURIComponent(username)}${suffix}`;
}

function boardUrl(username: string, boardId: number): string {
  return `/api/board/${encodeURIComponent(username)}/${boardId}`;
}

export function loginUser(username: string, password: string): Promise<unknown> {
  return request("/api/auth/login", jsonInit("POST", { username, password }), "Login failed");
}

export function registerUser(username: string, password: string): Promise<unknown> {
  return request("/api/auth/register", jsonInit("POST", { username, password }), "Registration failed");
}

export function listBoards(username: string): Promise<BoardMeta[]> {
  return request<BoardMeta[]>(userUrl(username), undefined, "Failed to load boards");
}

export function createBoard(username: string, name: string): Promise<BoardMeta> {
  return request<BoardMeta>(userUrl(username), jsonInit("POST", { name }), "Failed to create board");
}

export function renameBoard(username: string, boardId: number, name: string): Promise<BoardMeta> {
  return request<BoardMeta>(
    userUrl(username, `/${boardId}`),
    jsonInit("PATCH", { name }),
    "Failed to rename board"
  );
}

export function deleteBoard(username: string, boardId: number): Promise<unknown> {
  return request(userUrl(username, `/${boardId}`), { method: "DELETE" }, "Failed to delete board");
}

export function fetchBoard(username: string, boardId: number): Promise<BoardData> {
  return request<BoardData>(boardUrl(username, boardId), undefined, "Failed to load board");
}

export function saveBoard(username: string, boardId: number, board: BoardData): Promise<BoardData> {
  return request<BoardData>(boardUrl(username, boardId), jsonInit("PUT", board), "Failed to save board");
}

export function aiBoardChat(
  username: string,
  boardId: number,
  message: string,
  history: ChatMessage[]
): Promise<AiBoardChatResponse> {
  return request<AiBoardChatResponse>(
    "/api/ai/board-chat",
    jsonInit("POST", { username, board_id: boardId, message, history }),
    "AI chat failed"
  );
}

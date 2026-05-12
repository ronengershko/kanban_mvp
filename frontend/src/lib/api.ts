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

export const loginUser = async (username: string, password: string): Promise<void> => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(data.detail ?? "Login failed");
  }
};

export const registerUser = async (username: string, password: string): Promise<void> => {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(data.detail ?? "Registration failed");
  }
};

export const listBoards = async (username: string): Promise<BoardMeta[]> => {
  const response = await fetch(`/api/boards/${encodeURIComponent(username)}`);
  if (!response.ok) throw new Error("Failed to load boards");
  return (await response.json()) as BoardMeta[];
};

export const createBoard = async (username: string, name: string): Promise<BoardMeta> => {
  const response = await fetch(`/api/boards/${encodeURIComponent(username)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error("Failed to create board");
  return (await response.json()) as BoardMeta;
};

export const renameBoard = async (
  username: string,
  boardId: number,
  name: string
): Promise<BoardMeta> => {
  const response = await fetch(
    `/api/boards/${encodeURIComponent(username)}/${boardId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }
  );
  if (!response.ok) throw new Error("Failed to rename board");
  return (await response.json()) as BoardMeta;
};

export const deleteBoard = async (username: string, boardId: number): Promise<void> => {
  const response = await fetch(
    `/api/boards/${encodeURIComponent(username)}/${boardId}`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(data.detail ?? "Failed to delete board");
  }
};

export const fetchBoard = async (username: string, boardId: number): Promise<BoardData> => {
  const response = await fetch(
    `/api/board/${encodeURIComponent(username)}/${boardId}`
  );
  if (!response.ok) throw new Error("Failed to load board");
  return (await response.json()) as BoardData;
};

export const saveBoard = async (
  username: string,
  boardId: number,
  board: BoardData
): Promise<BoardData> => {
  const response = await fetch(
    `/api/board/${encodeURIComponent(username)}/${boardId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(board),
    }
  );
  if (!response.ok) throw new Error("Failed to save board");
  return (await response.json()) as BoardData;
};

export const aiBoardChat = async (
  username: string,
  boardId: number,
  message: string,
  history: ChatMessage[]
): Promise<AiBoardChatResponse> => {
  const response = await fetch("/api/ai/board-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, board_id: boardId, message, history }),
  });
  if (!response.ok) throw new Error("AI chat failed");
  return (await response.json()) as AiBoardChatResponse;
};

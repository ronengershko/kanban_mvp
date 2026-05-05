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

export const fetchBoard = async (username: string): Promise<BoardData> => {
  const response = await fetch(`/api/board/${encodeURIComponent(username)}`);
  if (!response.ok) {
    throw new Error("Failed to load board");
  }
  return (await response.json()) as BoardData;
};

export const aiBoardChat = async (
  username: string,
  message: string,
  history: ChatMessage[]
): Promise<AiBoardChatResponse> => {
  const response = await fetch("/api/ai/board-chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      message,
      history,
    }),
  });

  if (!response.ok) {
    throw new Error("AI chat failed");
  }

  return (await response.json()) as AiBoardChatResponse;
};

export const saveBoard = async (username: string, board: BoardData): Promise<BoardData> => {
  const response = await fetch(`/api/board/${encodeURIComponent(username)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(board),
  });

  if (!response.ok) {
    throw new Error("Failed to save board");
  }

  return (await response.json()) as BoardData;
};

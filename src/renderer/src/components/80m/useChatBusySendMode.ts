import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export type ChatBusySendMode = "queue" | "steer" | "background";

const STORAGE_KEY = "hermes-chat-busy-send-mode";

function readSavedBusySendMode(): ChatBusySendMode {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "queue" || saved === "steer" || saved === "background"
    ? saved
    : "queue";
}

export function useChatBusySendMode(): [
  ChatBusySendMode,
  Dispatch<SetStateAction<ChatBusySendMode>>,
] {
  const [busySendMode, setBusySendMode] = useState<ChatBusySendMode>(
    readSavedBusySendMode,
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, busySendMode);
  }, [busySendMode]);

  return [busySendMode, setBusySendMode];
}

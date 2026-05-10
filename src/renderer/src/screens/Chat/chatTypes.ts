export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
}

export interface SlashCommand {
  name: string;
  description: string;
  category: "chat" | "agent" | "tools" | "info";
  /** If true, the command is handled locally instead of sent to the backend */
  local?: boolean;
}

export interface ModelGroup {
  provider: string;
  providerLabel: string;
  models: { provider: string; model: string; label: string; baseUrl: string }[];
}

export interface CatalogModel {
  provider: string;
  model: string;
  name: string;
  description: string;
  baseUrl: string;
  source: "catalog" | "fallback";
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

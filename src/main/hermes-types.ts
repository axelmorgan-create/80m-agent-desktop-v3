export interface ChatHandle {
  abort: () => void;
}

export interface ApiRequestResult<T = unknown> {
  ok: boolean;
  status: number | null;
  data: T | null;
  error?: string;
}

export interface HermesRunEvent {
  event?: string;
  run_id?: string;
  runId?: string;
  delta?: string;
  output?: string;
  error?: string | boolean;
  tool?: string;
  toolCallId?: string;
  preview?: string;
  text?: string;
  duration?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}

export interface ChatToolProgress {
  tool?: string;
  name?: string;
  label?: string;
  preview?: string;
  status?: "running" | "completed" | "error" | "reasoning";
  toolCallId?: string;
  duration?: number;
  error?: boolean;
}

export interface HermesRunStatusPayload {
  run_id?: string;
  status?: string;
  session_id?: string;
  output?: string;
  error?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  last_event?: string;
}

export interface HermesDesktopCapabilities {
  version: string | null;
  semver: string | null;
  isAtLeastV12: boolean;
  updateAvailable: boolean;
  api: {
    ok: boolean;
    status: number | null;
    url: string;
    error?: string;
    features: Record<string, boolean>;
    endpoints: Record<string, { method?: string; path?: string }>;
    models: string[];
  };
  toolGateway: {
    present: boolean;
    available: boolean;
    reason: string;
    managedTools: string[];
  };
  supports: {
    chatCompletions: boolean;
    responses: boolean;
    runs: boolean;
    runEvents: boolean;
    runStop: boolean;
    toolProgress: boolean;
    sessionContinuity: boolean;
    curator: boolean;
  };
}

export interface HermesRunStartResult {
  success: boolean;
  runId?: string;
  status?: string;
  sessionId?: string;
  error?: string;
  raw?: unknown;
}

export interface HermesRunStatusResult {
  success: boolean;
  runId?: string;
  status?: string;
  sessionId?: string;
  output?: string;
  usage?: unknown;
  error?: string;
  raw?: unknown;
}

export interface ChatCallbacks {
  onChunk: (text: string) => void;
  onDone: (sessionId?: string) => void;
  onError: (error: string) => void;
  onToolProgress?: (tool: string | ChatToolProgress) => void;
  onUsage?: (usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: number;
    rateLimitRemaining?: number;
    rateLimitReset?: number;
  }) => void;
}

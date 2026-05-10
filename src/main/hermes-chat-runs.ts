import {
  apiJson,
  getApiServerAuthHeader,
  getApiUrl,
} from "./hermes-api-client";
import { getModelConfig } from "./config";
import type {
  ChatCallbacks,
  ChatHandle,
  HermesRunEvent,
  HermesRunStatusPayload,
} from "./hermes-types";

function normalizeConversationHistory(
  history?: Array<{ role: string; content: string }>,
): Array<{ role: string; content: string }> {
  return (history || [])
    .filter(
      (msg) =>
        msg.content &&
        (msg.role === "user" ||
          msg.role === "assistant" ||
          msg.role === "agent"),
    )
    .map((msg) => ({
      role: msg.role === "agent" ? "assistant" : msg.role,
      content: msg.content,
    }));
}

function mapRunsUsage(usage?: HermesRunEvent["usage"]): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  return {
    promptTokens: usage?.input_tokens || 0,
    completionTokens: usage?.output_tokens || 0,
    totalTokens: usage?.total_tokens || 0,
  };
}

export async function isRunsApiReady(profile?: string): Promise<boolean> {
  const result = await apiJson<{ features?: Record<string, boolean> }>(
    "/v1/capabilities",
    profile,
  );
  const features = result.data?.features || {};
  return Boolean(
    result.ok &&
    features.run_submission &&
    features.run_status &&
    features.run_events_sse,
  );
}

export function sendMessageViaRunsApi(
  message: string,
  cb: ChatCallbacks,
  profile?: string,
  _resumeSessionId?: string,
  history?: Array<{ role: string; content: string }>,
  activeProject?: string | null,
): ChatHandle {
  const mc = getModelConfig(profile);
  const controller = new AbortController();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getApiServerAuthHeader(profile),
  };
  let runId = "";
  let sessionId = _resumeSessionId || "";
  let fullResponse = "";
  let finished = false;

  function finish(error?: string): void {
    if (finished) return;
    finished = true;
    if (error) {
      cb.onError(error);
    } else {
      cb.onDone(sessionId || runId || undefined);
    }
  }

  async function stopRun(): Promise<void> {
    if (!runId) return;
    try {
      await apiJson(
        `/v1/runs/${encodeURIComponent(runId)}/stop`,
        profile,
        "POST",
        {},
      );
    } catch {
      // stopping is best-effort; the abort signal still closes our stream
    }
  }

  async function pollFinalStatus(): Promise<void> {
    if (!runId || finished) return;
    for (let i = 0; i < 90; i += 1) {
      const result = await apiJson<HermesRunStatusPayload>(
        `/v1/runs/${encodeURIComponent(runId)}`,
        profile,
      );
      const status = result.data?.status;
      if (result.data?.session_id) sessionId = result.data.session_id;
      if (status === "completed") {
        const output = result.data?.output || "";
        if (output && output !== fullResponse) {
          const delta = output.startsWith(fullResponse)
            ? output.slice(fullResponse.length)
            : output;
          fullResponse = output;
          cb.onChunk(delta);
        }
        if (result.data?.usage && cb.onUsage) {
          cb.onUsage(mapRunsUsage(result.data.usage));
        }
        finish();
        return;
      }
      if (status === "failed" || status === "cancelled") {
        finish(result.data?.error || `Run ${status}.`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    finish("Run timed out before completion.");
  }

  function handleRunEvent(event: HermesRunEvent): void {
    if (!event.event || finished) return;
    if (event.event === "message.delta" && event.delta) {
      fullResponse += event.delta;
      cb.onChunk(event.delta);
      return;
    }
    if (event.event === "tool.started" && cb.onToolProgress) {
      cb.onToolProgress({
        status: "running",
        tool: event.tool,
        label: event.preview || event.tool || "Tool started",
        preview: event.preview,
        toolCallId: event.toolCallId,
      });
      return;
    }
    if (event.event === "tool.completed" && cb.onToolProgress) {
      const isError = event.error === true || event.error === "true";
      cb.onToolProgress({
        status: isError ? "error" : "completed",
        tool: event.tool,
        label: event.tool ? `${event.tool} complete` : "Tool complete",
        toolCallId: event.toolCallId,
        duration: event.duration,
        error: isError,
      });
      return;
    }
    if (
      event.event === "reasoning.available" &&
      event.text &&
      cb.onToolProgress
    ) {
      cb.onToolProgress({
        status: "reasoning",
        tool: "reasoning",
        label: "Reasoning update",
        preview: event.text,
      });
      return;
    }
    if (event.event === "run.completed") {
      if (event.output && event.output !== fullResponse) {
        const delta = event.output.startsWith(fullResponse)
          ? event.output.slice(fullResponse.length)
          : event.output;
        fullResponse = event.output;
        cb.onChunk(delta);
      }
      if (event.usage && cb.onUsage) cb.onUsage(mapRunsUsage(event.usage));
      finish();
      return;
    }
    if (event.event === "run.failed" || event.event === "run.cancelled") {
      finish(
        typeof event.error === "string"
          ? event.error
          : event.event.replace(".", " "),
      );
    }
  }

  async function readEvents(): Promise<void> {
    const eventsUrl = new URL(
      `/v1/runs/${encodeURIComponent(runId)}/events`,
      getApiUrl(),
    );
    const response = await fetch(eventsUrl, {
      headers,
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      await pollFinalStatus();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() || "";
      for (const frame of frames) {
        const dataLine = frame
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (!dataLine) continue;
        try {
          handleRunEvent(JSON.parse(dataLine.slice(6)) as HermesRunEvent);
        } catch {
          // malformed event frames are ignored
        }
      }
    }
    if (!finished) await pollFinalStatus();
  }

  void (async () => {
    try {
      const instructions = activeProject
        ? `The user has set the workspace directory to: ${activeProject}. All terminal and file commands should operate in or relative to this directory.`
        : undefined;
      const body = {
        model: mc.model || "hermes-agent",
        input: message,
        session_id: sessionId || undefined,
        instructions,
        conversation_history: normalizeConversationHistory(history),
      };
      const startUrl = new URL("/v1/runs", getApiUrl());
      const response = await fetch(startUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      let parsed: {
        run_id?: string;
        session_id?: string;
        error?: { message?: string };
      } = {};
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        // keep parsed empty and surface text below
      }
      if (response.status !== 202 || !parsed.run_id) {
        finish(
          parsed.error?.message ||
            `Runs API returned ${response.status}: ${text.slice(0, 200)}`,
        );
        return;
      }
      runId = parsed.run_id;
      if (parsed.session_id) sessionId = parsed.session_id;
      await readEvents();
    } catch (error) {
      if (controller.signal.aborted) {
        await stopRun();
        finish("Run cancelled.");
        return;
      }
      finish(
        error instanceof Error ? error.message : "Runs API request failed.",
      );
    }
  })();

  return {
    abort: () => {
      controller.abort();
      void stopRun();
    },
  };
}

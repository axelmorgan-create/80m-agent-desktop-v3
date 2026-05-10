import http from "http";
import https from "https";
import { getModelConfig } from "./config";
import { getApiServerAuthHeader, getApiUrl } from "./hermes-api-client";
import type { ChatCallbacks, ChatHandle } from "./hermes-types";

export function sendMessageViaApi(
  message: string,
  cb: ChatCallbacks,
  profile?: string,
  _resumeSessionId?: string,
  history?: Array<{ role: string; content: string }>,
  activeProject?: string | null,
): ChatHandle {
  const mc = getModelConfig(profile);
  const controller = new AbortController();
  const messages: Array<{ role: string; content: string }> = [];

  if (activeProject) {
    messages.push({
      role: "system",
      content: `The user has set the workspace directory to: ${activeProject}. All terminal and file commands should operate in or relative to this directory.`,
    });
  }

  if (history && history.length > 0) {
    for (const msg of history) {
      messages.push({
        role: msg.role === "agent" ? "assistant" : msg.role,
        content: msg.content,
      });
    }
  }
  messages.push({ role: "user", content: message });

  const body = JSON.stringify({
    model: mc.model || "hermes-agent",
    messages,
    stream: true,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getApiServerAuthHeader(profile),
  };

  let sessionId = _resumeSessionId || "";
  if (sessionId && headers.Authorization) {
    headers["X-Hermes-Session-ID"] = sessionId;
  } else if (sessionId) {
    sessionId = "";
  }
  const sentSessionHeader = Boolean(headers["X-Hermes-Session-ID"]);
  let hasContent = false;
  let finished = false;
  let lastError = "";
  const toolProgressRe = /^`([^\s`]+)\s+([^`]+)`$/;

  function finish(error?: string): void {
    if (finished) return;
    finished = true;
    if (error) {
      cb.onError(error);
    } else {
      cb.onDone(sessionId || undefined);
    }
  }

  function probeRealError(): void {
    const probeBody = JSON.stringify({
      model: mc.model || "hermes-agent",
      messages: [{ role: "user", content: message }],
      stream: false,
    });
    const probeUrl = `${getApiUrl()}/v1/chat/completions`;
    const probeMod = probeUrl.startsWith("https") ? https : http;
    const probeReq = probeMod.request(
      probeUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getApiServerAuthHeader(profile),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (d) => {
          raw += d.toString();
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(raw);
            const content = parsed.choices?.[0]?.message?.content || "";
            const errMsg = parsed.error?.message || "";
            finish(
              content ||
                errMsg ||
                "No response received from the model. Check your model configuration and API key.",
            );
          } catch {
            finish(
              "No response received from the model. Check your model configuration and API key.",
            );
          }
        });
      },
    );
    probeReq.on("error", () => {
      finish(
        "No response received from the model. Check your model configuration and API key.",
      );
    });
    probeReq.write(probeBody);
    probeReq.end();
  }

  function processCustomEvent(eventType: string, data: string): void {
    if (eventType === "hermes.tool.progress" && cb.onToolProgress) {
      try {
        const payload = JSON.parse(data) as Record<string, unknown>;
        const tool =
          typeof payload.tool === "string" ? payload.tool : undefined;
        const label =
          typeof payload.label === "string"
            ? payload.label
            : tool || "Tool activity";
        const emoji =
          typeof payload.emoji === "string" ? payload.emoji : undefined;
        const status =
          payload.status === "completed"
            ? "completed"
            : payload.status === "error"
              ? "error"
              : "running";
        cb.onToolProgress({
          status,
          tool,
          label: emoji ? `${emoji} ${label}` : label,
          preview: label,
          toolCallId:
            typeof payload.toolCallId === "string"
              ? payload.toolCallId
              : undefined,
          error: payload.error === true,
        });
      } catch {
        /* malformed - skip */
      }
    }
  }

  function processSseData(data: string): boolean {
    if (data === "[DONE]") {
      if (hasContent) {
        finish();
      } else if (lastError) {
        finish(lastError);
      } else {
        probeRealError();
      }
      return true;
    }
    try {
      const parsed = JSON.parse(data);

      if (parsed.error) {
        lastError = parsed.error.message || JSON.stringify(parsed.error);
        return false;
      }

      const choice = parsed.choices?.[0];
      const delta = choice?.delta;

      if (parsed.usage && cb.onUsage) {
        cb.onUsage({
          promptTokens: parsed.usage.prompt_tokens || 0,
          completionTokens: parsed.usage.completion_tokens || 0,
          totalTokens: parsed.usage.total_tokens || 0,
          cost: parsed.usage.cost,
          rateLimitRemaining: parsed.usage.rate_limit_remaining,
          rateLimitReset: parsed.usage.rate_limit_reset,
        });
      }

      if (delta?.content) {
        const content = delta.content.trim();
        const match = toolProgressRe.exec(content);
        if (match && cb.onToolProgress) {
          cb.onToolProgress(`${match[1]} ${match[2]}`);
        } else {
          hasContent = true;
          cb.onChunk(delta.content);
        }
      }
    } catch {
      /* malformed chunk - skip */
    }
    return false;
  }

  const chatUrl = `${getApiUrl()}/v1/chat/completions`;
  const requester = chatUrl.startsWith("https") ? https.request : http.request;
  const req = requester(
    chatUrl,
    {
      method: "POST",
      headers,
      signal: controller.signal,
    },
    (res) => {
      const sid = res.headers["x-hermes-session-id"];
      if (sid && typeof sid === "string") sessionId = sid;

      if (res.statusCode !== 200) {
        let errBody = "";
        res.on("data", (d) => {
          errBody += d.toString();
        });
        res.on("end", () => {
          if (
            sentSessionHeader &&
            (res.statusCode === 401 || res.statusCode === 403) &&
            /session continuation|X-Hermes-Session|API key authentication/i.test(
              errBody,
            )
          ) {
            sendMessageViaApi(
              message,
              cb,
              profile,
              undefined,
              history,
              activeProject,
            );
            return;
          }

          try {
            const err = JSON.parse(errBody);
            finish(err.error?.message || `API error ${res.statusCode}`);
          } catch {
            finish(
              `API server returned ${res.statusCode}: ${errBody.slice(0, 200)}`,
            );
          }
        });
        return;
      }

      let buffer = "";

      function processSseBlock(block: string): boolean {
        let eventType = "";
        let dataLine = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            dataLine = line.slice(6);
          }
        }
        if (!dataLine) return false;
        if (eventType) {
          processCustomEvent(eventType, dataLine);
          return false;
        }
        return processSseData(dataLine);
      }

      res.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (processSseBlock(part)) return;
        }
      });

      res.on("end", () => {
        if (buffer.trim()) {
          for (const part of buffer.split("\n\n")) {
            if (processSseBlock(part)) return;
          }
        }
        if (!hasContent && !lastError) {
          probeRealError();
          return;
        }
        finish(hasContent ? undefined : lastError);
      });

      res.on("error", (err) => finish(`Stream error: ${err.message}`));
    },
  );

  req.on("error", (err) => {
    if (err.name === "AbortError") return;
    finish(`API request failed: ${err.message}`);
  });

  req.write(body);
  req.end();

  return {
    abort: () => {
      controller.abort();
    },
  };
}

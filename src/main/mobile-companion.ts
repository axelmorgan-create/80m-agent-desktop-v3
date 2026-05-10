import http, { IncomingMessage, Server, ServerResponse } from "http";
import https from "https";
import {
  getModelConfig,
  getMobileAccessConfig,
  ensureMobilePairingToken,
  DEFAULT_MOBILE_ACCESS_PORT,
  readEnv,
} from "./config";
import { listKanbanBoard } from "./kanban";
import {
  buildManifest,
  buildMobileHtml,
  buildServiceWorker,
} from "./mobile-companion-web";

const LOCAL_RUNTIME_URL = "http://127.0.0.1:8642";
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

let server: Server | null = null;
let serverPort: number | null = null;

interface JsonRequestOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

function send(
  res: ServerResponse,
  statusCode: number,
  body: string,
  contentType = "text/html; charset=utf-8",
): void {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": contentType.includes("text/html")
      ? "no-store"
      : "public, max-age=60",
  });
  res.end(body);
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  res.writeHead(statusCode, JSON_HEADERS);
  res.end(JSON.stringify(payload));
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  const body = await readRequestBody(req);
  if (!body.trim()) return {} as T;
  return JSON.parse(body) as T;
}

function hasValidPairingToken(req: IncomingMessage, url: URL): boolean {
  const configuredToken = getMobileAccessConfig().pairingToken;
  const token =
    req.headers["x-80m-pairing-token"] ||
    req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("pair") ||
    "";
  return Boolean(configuredToken && token === configuredToken);
}

function requestJson<T>(
  url: string,
  options: JsonRequestOptions = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === "https:" ? https : http;
    const body =
      options.body === undefined ? undefined : JSON.stringify(options.body);
    const req = transport.request(
      parsed,
      {
        method: options.method || (body ? "POST" : "GET"),
        timeout: options.timeoutMs || 12000,
        headers: {
          Accept: "application/json",
          ...(body
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body).toString(),
              }
            : {}),
          ...(options.headers || {}),
        },
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          if ((res.statusCode || 500) >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 180)}`));
            return;
          }
          try {
            resolve(raw ? (JSON.parse(raw) as T) : ({} as T));
          } catch {
            reject(new Error("Runtime returned invalid JSON."));
          }
        });
      },
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("Runtime request timed out."));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function getRuntimeStatus(): Promise<{
  ok: boolean;
  status?: unknown;
  error?: string;
}> {
  try {
    const env = readEnv();
    const status = await requestJson<unknown>(`${LOCAL_RUNTIME_URL}/health`, {
      headers: env.API_SERVER_KEY
        ? { Authorization: `Bearer ${env.API_SERVER_KEY}` }
        : {},
      timeoutMs: 3000,
    });
    return { ok: true, status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function extractAssistantText(payload: unknown): string {
  const data = payload as {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
    response?: string;
    content?: string;
  };
  return (
    data.choices?.[0]?.message?.content ||
    data.choices?.[0]?.text ||
    data.response ||
    data.content ||
    ""
  );
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  if (!hasValidPairingToken(req, url)) {
    sendJson(res, 401, {
      success: false,
      error: "Pairing token is missing or invalid.",
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/status") {
    const [runtime, board] = await Promise.allSettled([
      getRuntimeStatus(),
      listKanbanBoard(),
    ]);
    const kanban =
      board.status === "fulfilled"
        ? {
            success: board.value.success,
            total: board.value.data?.tasks.length || 0,
            columns: board.value.data?.stats.by_status || {},
            error: board.value.error || "",
          }
        : { success: false, total: 0, columns: {}, error: board.reason };

    sendJson(res, 200, {
      success: true,
      app: "80M Agent Desktop",
      companion: {
        running: true,
        port: serverPort,
        localUrl: getMobileCompanionLocalUrl(),
      },
      runtime: runtime.status === "fulfilled" ? runtime.value : runtime.reason,
      model: getModelConfig(),
      kanban,
      now: Date.now(),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/kanban") {
    const board = await listKanbanBoard();
    sendJson(res, board.success ? 200 : 502, board);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    const body = await parseJsonBody<{ message?: string }>(req);
    const message = body.message?.trim();
    if (!message) {
      sendJson(res, 400, { success: false, error: "Message is required." });
      return;
    }

    const env = readEnv();
    const model = getModelConfig();
    const response = await requestJson<unknown>(
      `${LOCAL_RUNTIME_URL}/v1/chat/completions`,
      {
        method: "POST",
        headers: env.API_SERVER_KEY
          ? { Authorization: `Bearer ${env.API_SERVER_KEY}` }
          : {},
        body: {
          model: model.model,
          messages: [{ role: "user", content: message }],
          stream: false,
        },
        timeoutMs: 60000,
      },
    );
    sendJson(res, 200, {
      success: true,
      response: extractAssistantText(response),
      raw: response,
    });
    return;
  }

  sendJson(res, 404, { success: false, error: "Unknown mobile API route." });
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    if (url.pathname === "/manifest.webmanifest") {
      send(res, 200, buildManifest(), "application/manifest+json");
      return;
    }
    if (url.pathname === "/sw.js") {
      send(res, 200, buildServiceWorker(), "application/javascript");
      return;
    }
    send(res, 200, buildMobileHtml());
  } catch (error) {
    sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function isMobileCompanionRunning(): boolean {
  return Boolean(server?.listening);
}

export function getMobileCompanionPort(): number | null {
  return serverPort;
}

export function getMobileCompanionLocalUrl(port = serverPort): string {
  return `http://127.0.0.1:${port || DEFAULT_MOBILE_ACCESS_PORT}`;
}

export function startMobileCompanionServer(
  port = getMobileAccessConfig().port,
): Promise<{ success: boolean; port: number; error?: string }> {
  ensureMobilePairingToken();
  if (server?.listening && serverPort === port) {
    return Promise.resolve({ success: true, port });
  }

  if (server?.listening) {
    stopMobileCompanionServer();
  }

  return new Promise((resolve) => {
    const nextServer = http.createServer((req, res) => {
      void handleRequest(req, res);
    });

    const done = (result: { success: boolean; port: number; error?: string }) =>
      resolve(result);

    nextServer.once("error", (error) => {
      done({ success: false, port, error: error.message });
    });
    nextServer.listen(port, "127.0.0.1", () => {
      server = nextServer;
      serverPort = port;
      done({ success: true, port });
    });
  });
}

export function stopMobileCompanionServer(): void {
  if (!server) return;
  server.close();
  server = null;
  serverPort = null;
}

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

function buildManifest(): string {
  return JSON.stringify({
    name: "80M Mobile",
    short_name: "80M",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#202622",
    theme_color: "#4ade80",
    description: "Tailnet-only companion for 80M Agent Desktop.",
    icons: [
      {
        src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='24' fill='%23202622'/%3E%3Cpath d='M22 80h18V48H22v32Zm29 0h18V48H51v32Zm29 0h26V48H80v11h13v10H80v11Z' fill='%234ade80'/%3E%3C/svg%3E",
        sizes: "128x128",
        type: "image/svg+xml",
      },
    ],
  });
}

function buildServiceWorker(): string {
  return `
self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
`.trim();
}

function buildMobileHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#4ade80" />
  <title>80M Mobile</title>
  <link rel="manifest" href="/manifest.webmanifest" />
  <style>
    :root {
      color-scheme: dark;
      --bg: #202622;
      --panel: #28302c;
      --panel-2: #303a34;
      --line: rgba(74, 222, 128, .22);
      --text: #f4fff7;
      --muted: #c7d3cc;
      --green: #4ade80;
      --green-strong: #22c55e;
      --red: #f87171;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .shell {
      width: min(100%, 780px);
      min-height: 100vh;
      margin: 0 auto;
      padding: max(18px, env(safe-area-inset-top)) 16px max(22px, env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(40, 48, 44, .92);
    }
    .mark {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      background: var(--green);
      color: #111611;
      font-weight: 950;
      letter-spacing: .02em;
    }
    h1, h2, p { margin: 0; }
    h1 {
      font-size: 16px;
      letter-spacing: .02em;
    }
    h2 {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: var(--green);
    }
    p, .meta {
      color: var(--muted);
      line-height: 1.55;
      font-size: 13px;
    }
    .status-pill {
      border-radius: 999px;
      padding: 6px 10px;
      border: 1px solid var(--line);
      color: #bbf7d0;
      background: rgba(74, 222, 128, .08);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      white-space: nowrap;
    }
    nav {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    button {
      min-height: 42px;
      border: 1px solid rgba(244, 255, 247, .13);
      border-radius: 8px;
      background: var(--panel-2);
      color: var(--text);
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }
    button.active, button.primary {
      border-color: var(--green);
      background: rgba(74, 222, 128, .16);
      color: var(--green);
    }
    button.primary {
      background: var(--green);
      color: #111611;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(40, 48, 44, .92);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
      gap: 10px;
    }
    .metric {
      border: 1px solid rgba(244, 255, 247, .1);
      border-radius: 8px;
      background: var(--panel);
      padding: 12px;
    }
    .metric strong {
      display: block;
      font-size: 20px;
      color: var(--text);
      margin-top: 4px;
    }
    textarea {
      width: 100%;
      min-height: 112px;
      resize: vertical;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #252d29;
      color: var(--text);
      padding: 12px;
      font: inherit;
      line-height: 1.45;
      outline: none;
    }
    textarea:focus {
      border-color: var(--green);
      box-shadow: 0 0 0 2px rgba(74, 222, 128, .12);
    }
    .answer {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      border: 1px solid rgba(244, 255, 247, .1);
      border-radius: 8px;
      background: #252d29;
      padding: 12px;
      line-height: 1.55;
      color: var(--text);
    }
    .columns {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .task {
      border: 1px solid rgba(244, 255, 247, .1);
      border-radius: 8px;
      background: #252d29;
      padding: 11px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .task strong { font-size: 13px; }
    .hidden { display: none; }
    .error { color: #fecaca; }
    @media (min-width: 680px) {
      .columns { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div style="display:flex;align-items:center;gap:12px;min-width:0">
        <div class="mark">80M</div>
        <div>
          <h1>80M Mobile</h1>
          <p>Tailnet-only companion</p>
        </div>
      </div>
      <span id="pairState" class="status-pill">Pairing</span>
    </header>

    <nav>
      <button data-tab="status" class="active">Status</button>
      <button data-tab="chat">Chat</button>
      <button data-tab="kanban">Kanban</button>
    </nav>

    <section id="status" class="card">
      <h2>Status</h2>
      <div class="grid">
        <div class="metric"><p>Runtime</p><strong id="runtime">...</strong></div>
        <div class="metric"><p>Model</p><strong id="model">...</strong></div>
        <div class="metric"><p>Tasks</p><strong id="tasks">...</strong></div>
        <div class="metric"><p>Access</p><strong>Private</strong></div>
      </div>
      <p id="statusNote">Checking the desktop runtime.</p>
      <button class="primary" id="refresh">Refresh</button>
    </section>

    <section id="chat" class="card hidden">
      <h2>Chat</h2>
      <textarea id="message" placeholder="Ask your desktop agent..."></textarea>
      <button class="primary" id="send">Send</button>
      <div id="answer" class="answer">Ready.</div>
    </section>

    <section id="kanban" class="card hidden">
      <h2>Kanban</h2>
      <p class="meta">Live task board from the desktop runtime.</p>
      <div id="board" class="columns"></div>
    </section>
  </main>
  <script>
    const params = new URLSearchParams(location.search);
    const incomingPair = params.get("pair");
    if (incomingPair) {
      localStorage.setItem("80mPairingToken", incomingPair);
      params.delete("pair");
      history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params : ""));
    }
    const token = localStorage.getItem("80mPairingToken") || "";
    const pairState = document.getElementById("pairState");
    pairState.textContent = token ? "Paired" : "Needs token";
    pairState.style.color = token ? "#bbf7d0" : "#fecaca";

    async function api(path, options = {}) {
      const response = await fetch(path, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "X-80M-Pairing-Token": token,
          ...(options.headers || {}),
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      return data;
    }

    function setTab(id) {
      document.querySelectorAll("nav button").forEach((button) => {
        button.classList.toggle("active", button.dataset.tab === id);
      });
      ["status", "chat", "kanban"].forEach((section) => {
        document.getElementById(section).classList.toggle("hidden", section !== id);
      });
      if (id === "kanban") loadKanban();
    }

    async function refresh() {
      const note = document.getElementById("statusNote");
      try {
        const data = await api("/api/status");
        document.getElementById("runtime").textContent = data.runtime?.ok ? "Online" : "Offline";
        document.getElementById("model").textContent = data.model?.model || "Unset";
        document.getElementById("tasks").textContent = String(data.kanban?.total ?? 0);
        note.textContent = data.runtime?.error || "Desktop runtime is reachable through Tailscale Serve.";
      } catch (error) {
        document.getElementById("runtime").textContent = "Locked";
        note.textContent = error.message;
        note.classList.add("error");
      }
    }

    async function sendMessage() {
      const input = document.getElementById("message");
      const answer = document.getElementById("answer");
      if (!input.value.trim()) return;
      answer.textContent = "Thinking...";
      try {
        const data = await api("/api/chat", {
          method: "POST",
          body: JSON.stringify({ message: input.value }),
        });
        answer.textContent = data.response || "No text response returned.";
      } catch (error) {
        answer.textContent = error.message;
      }
    }

    async function loadKanban() {
      const board = document.getElementById("board");
      board.textContent = "Loading...";
      try {
        const data = await api("/api/kanban");
        const columns = data.data?.columns || {};
        board.innerHTML = "";
        for (const [status, tasks] of Object.entries(columns)) {
          const card = document.createElement("div");
          card.className = "metric";
          card.innerHTML = "<p>" + status + "</p>";
          for (const task of tasks.slice(0, 4)) {
            const item = document.createElement("div");
            item.className = "task";
            item.innerHTML = "<strong></strong><span class='meta'></span>";
            item.querySelector("strong").textContent = task.title || task.id;
            item.querySelector("span").textContent = task.assignee || "unassigned";
            card.appendChild(item);
          }
          if (!tasks.length) {
            const empty = document.createElement("p");
            empty.className = "meta";
            empty.textContent = "No tasks";
            card.appendChild(empty);
          }
          board.appendChild(card);
        }
      } catch (error) {
        board.innerHTML = "<p class='error'>" + error.message + "</p>";
      }
    }

    document.querySelectorAll("nav button").forEach((button) => {
      button.addEventListener("click", () => setTab(button.dataset.tab));
    });
    document.getElementById("refresh").addEventListener("click", refresh);
    document.getElementById("send").addEventListener("click", sendMessage);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    refresh();
  </script>
</body>
</html>`;
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

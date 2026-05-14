import http, { IncomingMessage, Server, ServerResponse } from "http";
import https from "https";
import { randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
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
import { getObsidianVaultInfo } from "./obsidian-vault";
import {
  flashDesktopBuddyState,
  setDesktopBuddyState,
} from "./desktop-buddy-ipc";

const LOCAL_RUNTIME_URL = "http://127.0.0.1:8642";
const BASE_JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-80M-Pairing-Token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Private-Network": "true",
};

let server: Server | null = null;
let serverPort: number | null = null;

interface JsonRequestOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

interface CortexClipRequest {
  title?: string;
  url?: string;
  text?: string;
  selection?: string;
  excerpt?: string;
  byline?: string;
  siteName?: string;
}

interface KnowledgeKnaightClipResult {
  summary: string;
  keyPoints: string[];
  tags: string[];
  section: string;
  followUps: string[];
  usedRuntime: boolean;
  raw?: string;
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

function getAllowedCorsOrigin(req: IncomingMessage): string {
  const origin = String(req.headers.origin || "");
  if (!origin) return "";
  if (/^chrome-extension:\/\//i.test(origin)) return origin;
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin)) {
    return origin;
  }
  return "";
}

function jsonHeaders(req: IncomingMessage): Record<string, string> {
  const origin = getAllowedCorsOrigin(req);
  return {
    ...BASE_JSON_HEADERS,
    ...(origin
      ? {
          "Access-Control-Allow-Origin": origin,
          Vary: "Origin",
        }
      : {}),
  };
}

function sendEmpty(
  req: IncomingMessage,
  res: ServerResponse,
  statusCode: number,
): void {
  res.writeHead(statusCode, jsonHeaders(req));
  res.end();
}

function sendJson(
  req: IncomingMessage,
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  res.writeHead(statusCode, jsonHeaders(req));
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

function isLoopbackHost(req: IncomingMessage): boolean {
  const host = String(req.headers.host || "").toLowerCase();
  return (
    host === "localhost" ||
    host.startsWith("localhost:") ||
    host === "127.0.0.1" ||
    host.startsWith("127.0.0.1:") ||
    host === "[::1]" ||
    host.startsWith("[::1]:")
  );
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

function compactText(value: unknown, maxLength: number): string {
  return String(value || "")
    .replaceAll("\u0000", "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, maxLength);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || "web-clip";
}

function yamlValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(yamlValue).join(", ")}]`;
  if (value === null || value === undefined || value === "") return '""';
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(String(value));
}

function markdownLink(url: string): string {
  if (!url) return "";
  return url.replace(/\)/g, "%29");
}

function listItems(items: string[]): string {
  const clean = items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  return clean.length ? clean.map((item) => `- ${item}`).join("\n") : "- None";
}

function parseKnaightJson(raw: string): Partial<KnowledgeKnaightClipResult> {
  const jsonBlock = raw.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidate = jsonBlock || raw.match(/\{[\s\S]*\}/)?.[0] || "";
  if (!candidate) return {};
  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      keyPoints: Array.isArray(parsed.key_points)
        ? parsed.key_points.map(String)
        : Array.isArray(parsed.keyPoints)
          ? parsed.keyPoints.map(String)
          : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
      section: typeof parsed.section === "string" ? parsed.section : "",
      followUps: Array.isArray(parsed.follow_ups)
        ? parsed.follow_ups.map(String)
        : Array.isArray(parsed.followUps)
          ? parsed.followUps.map(String)
          : [],
    };
  } catch {
    return {};
  }
}

function fallbackClipResult(
  clip: CortexClipRequest,
): KnowledgeKnaightClipResult {
  const text = compactText(clip.selection || clip.excerpt || clip.text, 700);
  let host = "";
  try {
    host = clip.url ? new URL(clip.url).hostname.replace(/^www\./, "") : "";
  } catch {
    host = "";
  }
  return {
    summary: text || "Captured webpage for later Knowledge Knaight review.",
    keyPoints: [],
    tags: ["web-clip", "knowledge-knaight", host].filter(Boolean),
    section: "web_clips",
    followUps: [],
    usedRuntime: false,
  };
}

async function synthesizeWithKnowledgeKnaight(
  clip: CortexClipRequest,
): Promise<KnowledgeKnaightClipResult> {
  const fallback = fallbackClipResult(clip);
  const pageText = compactText(clip.text, 18000);
  if (!pageText) return fallback;

  try {
    const env = readEnv("knowledge_knaight");
    const model = getModelConfig("knowledge_knaight");
    const response = await requestJson<unknown>(
      `${LOCAL_RUNTIME_URL}/v1/chat/completions`,
      {
        method: "POST",
        headers: env.API_SERVER_KEY
          ? { Authorization: `Bearer ${env.API_SERVER_KEY}` }
          : {},
        body: {
          model: model.model || "hermes-agent",
          messages: [
            {
              role: "system",
              content:
                "You are Knowledge Knaight, Cortex keeper and wise scholar. Distill captured webpages into durable second-brain records. Return only strict JSON.",
            },
            {
              role: "user",
              content: [
                "Ingest this webpage into Cortex.",
                "Return JSON with keys: summary, key_points, tags, section, follow_ups.",
                "Use section 'web_clips' unless a stronger Cortex section is obvious.",
                `Title: ${clip.title || "Untitled"}`,
                `URL: ${clip.url || ""}`,
                `Selection: ${compactText(clip.selection, 2000)}`,
                `Excerpt: ${compactText(clip.excerpt, 1000)}`,
                "Page text:",
                pageText,
              ].join("\n\n"),
            },
          ],
          stream: false,
        },
        timeoutMs: 90000,
      },
    );
    const raw = extractAssistantText(response);
    const parsed = parseKnaightJson(raw);
    return {
      summary: compactText(parsed.summary || fallback.summary, 1800),
      keyPoints: (parsed.keyPoints || fallback.keyPoints).slice(0, 8),
      tags: [...new Set([...(parsed.tags || []), ...fallback.tags])]
        .map((tag) => slugify(tag))
        .slice(0, 12),
      section: slugify(parsed.section || fallback.section),
      followUps: (parsed.followUps || fallback.followUps).slice(0, 6),
      usedRuntime: true,
      raw: compactText(raw, 5000),
    };
  } catch {
    return fallback;
  }
}

function buildCortexMarkdown(
  clip: CortexClipRequest,
  knaight: KnowledgeKnaightClipResult,
  id: string,
): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const title = compactText(clip.title, 160) || "Captured Webpage";
  const sourceUrl = compactText(clip.url, 1000);
  let sourcePlatform = "";
  try {
    sourcePlatform = sourceUrl
      ? new URL(sourceUrl).hostname.replace(/^www\./, "")
      : "";
  } catch {
    sourcePlatform = "";
  }
  const tags = [...new Set(["web-clip", "knowledge-knaight", ...knaight.tags])]
    .map(slugify)
    .filter(Boolean);
  const bodyText = compactText(clip.text, 14000);
  const selection = compactText(clip.selection, 3000);
  const excerpt = compactText(clip.excerpt, 1200);
  const dashboardRecord = {
    id,
    title,
    content: knaight.summary,
    content_type: "web_clip",
    source_url: sourceUrl || null,
    source_platform: sourcePlatform || null,
    section: knaight.section,
    category: "web",
    tags,
    entities: null,
    embedding: null,
    user_rating: null,
    status: "active",
    created_at: nowSeconds,
    updated_at: nowSeconds,
    metadata: {
      source: "chrome-clipper",
      pipeline: {
        profile: "knowledge_knaight",
        stages: ["capture", "knowledge_knaight_synthesis", "cortex_markdown"],
        used_runtime: knaight.usedRuntime,
      },
      byline: clip.byline || "",
      site_name: clip.siteName || sourcePlatform || "",
      selection,
      excerpt,
      raw_synthesis: knaight.raw || "",
    },
  };

  return [
    "---",
    `lifeos_collection: ${yamlValue("cortex")}`,
    `lifeos_id: ${yamlValue(id)}`,
    `title: ${yamlValue(title)}`,
    `status: ${yamlValue("active")}`,
    `category: ${yamlValue("web")}`,
    `section: ${yamlValue(knaight.section)}`,
    `tags: ${yamlValue(tags)}`,
    `created_at: ${yamlValue(nowSeconds)}`,
    `updated_at: ${yamlValue(nowSeconds)}`,
    `source: ${yamlValue("chrome-clipper")}`,
    "---",
    "",
    `# ${title}`,
    "",
    sourceUrl
      ? `Source: [${sourcePlatform || sourceUrl}](${markdownLink(sourceUrl)})`
      : "",
    "",
    "## Knowledge Knaight Synthesis",
    "",
    knaight.summary,
    "",
    "## Key Points",
    "",
    listItems(knaight.keyPoints),
    "",
    "## Follow Ups",
    "",
    listItems(knaight.followUps),
    "",
    selection ? "## Selected Passage\n\n" + selection + "\n" : "",
    excerpt ? "## Page Excerpt\n\n" + excerpt + "\n" : "",
    bodyText ? "## Captured Page Text\n\n" + bodyText + "\n" : "",
    "## Dashboard Record",
    "",
    "```json",
    JSON.stringify(dashboardRecord, null, 2),
    "```",
    "",
  ]
    .filter((part) => part !== "")
    .join("\n");
}

async function handleCortexClip(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  setDesktopBuddyState({ state: "searching", label: "Ingesting" });
  try {
    const clip = await parseJsonBody<CortexClipRequest>(req);
    const title = compactText(clip.title, 160) || "Captured Webpage";
    const vault = getObsidianVaultInfo();
    if (!vault.exists || !vault.path) {
      flashDesktopBuddyState({ state: "error", label: "No vault" }, 2200);
      sendJson(req, res, 500, {
        success: false,
        error: "No Obsidian vault is configured.",
      });
      return;
    }

    const id = randomUUID();
    const knaight = await synthesizeWithKnowledgeKnaight(clip);
    const cortexDir = join(vault.path, "cortex", "web-clips");
    mkdirSync(cortexDir, { recursive: true });
    const filePath = join(cortexDir, `${slugify(title)}--${id}.md`);
    writeFileSync(filePath, buildCortexMarkdown(clip, knaight, id), "utf-8");

    flashDesktopBuddyState({ state: "job-done", label: "Saved" }, 2400);
    sendJson(req, res, 200, {
      success: true,
      id,
      title,
      filePath,
      section: knaight.section,
      tags: knaight.tags,
      usedRuntime: knaight.usedRuntime,
    });
  } catch (error) {
    flashDesktopBuddyState({ state: "error", label: "Clip failed" }, 2400);
    throw error;
  }
}

async function handleClipperConnect(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (!isLoopbackHost(req)) {
    sendJson(req, res, 403, {
      success: false,
      error: "Clipper auto-connect is only available from this computer.",
    });
    return;
  }

  ensureMobilePairingToken();
  const config = getMobileAccessConfig();
  const vault = getObsidianVaultInfo();
  flashDesktopBuddyState({ state: "searching", label: "Linked" }, 1400);
  sendJson(req, res, 200, {
    success: true,
    app: "80M Agent Desktop",
    companion: {
      running: true,
      port: serverPort,
      localUrl: getMobileCompanionLocalUrl(),
    },
    pairingToken: config.pairingToken,
    vault: {
      exists: vault.exists,
      name: vault.name,
      path: vault.path,
    },
    now: Date.now(),
  });
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  if (req.method === "POST" && url.pathname === "/api/clipper/connect") {
    await handleClipperConnect(req, res);
    return;
  }

  if (!hasValidPairingToken(req, url)) {
    sendJson(req, res, 401, {
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

    sendJson(req, res, 200, {
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
    sendJson(req, res, board.success ? 200 : 502, board);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/cortex/clip") {
    await handleCortexClip(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    const body = await parseJsonBody<{ message?: string }>(req);
    const message = body.message?.trim();
    if (!message) {
      sendJson(req, res, 400, {
        success: false,
        error: "Message is required.",
      });
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
    sendJson(req, res, 200, {
      success: true,
      response: extractAssistantText(response),
      raw: response,
    });
    return;
  }

  sendJson(req, res, 404, {
    success: false,
    error: "Unknown mobile API route.",
  });
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "OPTIONS") {
      sendEmpty(req, res, 204);
      return;
    }
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
    sendJson(req, res, 500, {
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

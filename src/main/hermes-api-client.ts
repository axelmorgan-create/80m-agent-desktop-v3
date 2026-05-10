import { randomBytes } from "crypto";
import http from "http";
import https from "https";
import { getConnectionConfig, readEnv, setEnvValue } from "./config";
import type { ApiRequestResult } from "./hermes-types";

const LOCAL_API_URL = "http://127.0.0.1:8642";

export function getApiUrl(): string {
  const conn = getConnectionConfig();
  if (conn.mode === "remote" && conn.remoteUrl) {
    return conn.remoteUrl.replace(/\/+$/, "");
  }
  return LOCAL_API_URL;
}

export function isRemoteMode(): boolean {
  return getConnectionConfig().mode === "remote";
}

function getRemoteAuthHeader(): Record<string, string> {
  const conn = getConnectionConfig();
  if (conn.mode === "remote" && conn.apiKey) {
    return { Authorization: `Bearer ${conn.apiKey}` };
  }
  return {};
}

export function getApiServerAuthHeader(
  profile?: string,
): Record<string, string> {
  const remoteHeader = getRemoteAuthHeader();
  if (remoteHeader.Authorization) return remoteHeader;

  const conn = getConnectionConfig();
  if (conn.mode === "local") {
    const key = readEnv(profile).API_SERVER_KEY || process.env.API_SERVER_KEY;
    if (key) return { Authorization: `Bearer ${key}` };
  }

  return {};
}

export function ensureApiServerKey(profile?: string): string {
  const existing =
    readEnv(profile).API_SERVER_KEY || process.env.API_SERVER_KEY;
  if (existing?.trim()) return existing.trim();

  const key = `hsk_${randomBytes(24).toString("hex")}`;
  setEnvValue("API_SERVER_KEY", key, profile);
  return key;
}

export function apiJson<T = unknown>(
  path: string,
  profile?: string,
  method = "GET",
  body?: unknown,
): Promise<ApiRequestResult<T>> {
  return new Promise((resolveResult) => {
    try {
      const target = new URL(path, getApiUrl());
      const mod = target.protocol === "https:" ? https : http;
      const payload =
        body == null ? undefined : Buffer.from(JSON.stringify(body), "utf-8");
      const headers: Record<string, string | number> = {
        ...getApiServerAuthHeader(profile),
        Accept: "application/json",
      };
      if (payload) {
        headers["Content-Type"] = "application/json";
        headers["Content-Length"] = payload.byteLength;
      }

      const req = mod.request(
        target,
        {
          method,
          timeout: 8000,
          headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf-8");
            try {
              resolveResult({
                ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
                status: res.statusCode || null,
                data: text ? (JSON.parse(text) as T) : null,
              });
            } catch {
              resolveResult({
                ok: false,
                status: res.statusCode || null,
                data: null,
                error: text.slice(0, 500) || "Invalid JSON response.",
              });
            }
          });
        },
      );
      req.on("error", (error) =>
        resolveResult({
          ok: false,
          status: null,
          data: null,
          error: error.message,
        }),
      );
      req.on("timeout", () => {
        req.destroy();
        resolveResult({
          ok: false,
          status: null,
          data: null,
          error: "timeout",
        });
      });
      if (payload) req.write(payload);
      req.end();
    } catch (error) {
      resolveResult({
        ok: false,
        status: null,
        data: null,
        error: error instanceof Error ? error.message : "invalid request",
      });
    }
  });
}

export function isApiServerReady(profile?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const url = `${getApiUrl()}/health`;
    const mod = url.startsWith("https") ? https : http;
    const req = mod.request(
      url,
      {
        method: "GET",
        timeout: 1500,
        headers: getApiServerAuthHeader(profile),
      },
      (res) => {
        resolve(res.statusCode === 200);
        res.resume();
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

export function testRemoteConnection(
  url: string,
  apiKey?: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const target = `${url.replace(/\/+$/, "")}/health`;
    const mod = target.startsWith("https") ? https : http;
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const req = mod.request(
      target,
      { method: "GET", timeout: 5000, headers },
      (res) => {
        resolve(res.statusCode === 200);
        res.resume();
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

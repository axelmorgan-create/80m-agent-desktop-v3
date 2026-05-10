import type { Message } from "./Messages";

export type JsonRecord = Record<string, unknown>;

export interface FilePreviewData {
  content: string;
  path?: string;
  totalLines?: number;
  fileSize?: number;
  truncated?: boolean;
  isBinary?: boolean;
  isImage?: boolean;
}

export interface FileArtifactData {
  path?: string;
  sourcePath?: string;
  action: "created" | "moved" | "file" | "image" | "pdf";
  bytes?: number;
  output?: string;
}

export interface DocumentPreviewData {
  path: string;
  name: string;
  exists: boolean;
  kind:
    | "text"
    | "markdown"
    | "image"
    | "pdf"
    | "office"
    | "directory"
    | "binary"
    | "missing";
  size: number;
  fileUrl?: string;
  content?: string;
  truncated?: boolean;
  error?: string;
}

export interface ParsedToolCall {
  id?: string;
  name: string;
  argumentsText: string;
  rawText: string;
}

export interface ToolActivityData {
  status?: string;
  tool?: string;
  label?: string;
  preview?: string;
  duration?: number;
  error?: boolean;
}

export function parseJsonRecord(value?: string): JsonRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonRecord)
      : null;
  } catch {
    return null;
  }
}

export function prettyJson(value: string): string {
  const parsed = parseJsonRecord(value);
  return parsed ? JSON.stringify(parsed, null, 2) : value;
}

function stringifyToolValue(value: unknown): string {
  if (typeof value === "string") return prettyJson(value);
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function stringValue(record: JsonRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function firstPathValue(
  ...records: Array<JsonRecord | null>
): string | undefined {
  const keys = [
    "path",
    "file_path",
    "filepath",
    "filename",
    "destPath",
    "dest_path",
    "destination",
    "target",
    "output_path",
  ];
  for (const record of records) {
    if (!record) continue;
    const found = stringValue(record, keys);
    if (found) return found;
  }
  return undefined;
}

function numberValue(record: JsonRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") return value;
  }
  return undefined;
}

export function parseToolCalls(value?: string): ParsedToolCall[] {
  if (!value) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }

  const calls = Array.isArray(parsed) ? parsed : [parsed];
  return calls
    .filter((call): call is JsonRecord =>
      Boolean(call && typeof call === "object"),
    )
    .map((call, index) => {
      const fn =
        call.function && typeof call.function === "object"
          ? (call.function as JsonRecord)
          : null;
      const name =
        stringValue(call, ["name", "tool", "tool_name"]) ||
        (fn ? stringValue(fn, ["name"]) : undefined) ||
        `tool_${index + 1}`;
      const args =
        call.arguments ??
        call.args ??
        call.input ??
        (fn ? fn.arguments : undefined);
      return {
        id: stringValue(call, ["id", "call_id", "tool_call_id"]),
        name,
        argumentsText: stringifyToolValue(args),
        rawText: stringifyToolValue(call),
      };
    });
}

function extensionFor(filePath?: string): string {
  if (!filePath) return "";
  const match = filePath.toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/);
  return match?.[1] || "";
}

function isImagePath(filePath?: string): boolean {
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(
    extensionFor(filePath),
  );
}

function isPdfPath(filePath?: string): boolean {
  return extensionFor(filePath) === "pdf";
}

function splitShellArgs(command: string): string[] {
  const args: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(command))) {
    args.push(match[1] ?? match[2] ?? match[3]);
  }
  return args;
}

function pathFromCommand(command?: string): {
  sourcePath?: string;
  destPath?: string;
} {
  if (!command) return {};
  const args = splitShellArgs(
    command.replace(/^\/bin\/(?:bash|sh)\s+-lc\s+/, ""),
  );
  const mvIndex = args.findIndex((arg) => arg === "mv" || arg.endsWith("/mv"));
  if (mvIndex >= 0 && args.length >= mvIndex + 3) {
    return {
      sourcePath: args[mvIndex + 1],
      destPath: args[mvIndex + 2],
    };
  }
  const redirectMatch = command.match(/>\s*["']?([^"'\s]+)["']?/);
  if (redirectMatch) return { destPath: redirectMatch[1] };
  return {};
}

function booleanValue(record: JsonRecord, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

export function extractFilePreview(msg: Message): FilePreviewData | null {
  const result = parseJsonRecord(msg.content);
  if (!result || typeof result.content !== "string") return null;

  const calls = parseJsonRecord(msg.tool_calls);
  const path = firstPathValue(result, calls);

  return {
    content: result.content,
    path,
    totalLines: numberValue(result, ["total_lines", "totalLines"]),
    fileSize: numberValue(result, ["file_size", "fileSize", "bytes"]),
    truncated: booleanValue(result, ["truncated"]),
    isBinary: booleanValue(result, ["is_binary", "isBinary"]),
    isImage: booleanValue(result, ["is_image", "isImage"]),
  };
}

export function extractFileArtifact(msg: Message): FileArtifactData | null {
  const result = parseJsonRecord(msg.content);
  const calls = parseJsonRecord(msg.tool_calls);
  const command =
    calls && typeof calls.command === "string" ? calls.command : undefined;
  const commandPaths = pathFromCommand(command);
  const path = firstPathValue(result, calls) || commandPaths.destPath;
  const sourcePath = commandPaths.sourcePath;
  const output = result
    ? stringValue(result, ["output", "message"])
    : undefined;
  const bytes = result
    ? numberValue(result, ["bytes_written", "bytes", "file_size", "fileSize"])
    : undefined;

  if (!path && !sourcePath) return null;

  if (path && isImagePath(path)) {
    return { path, sourcePath, action: "image", bytes, output };
  }
  if (path && isPdfPath(path)) {
    return { path, sourcePath, action: "pdf", bytes, output };
  }
  if (result && "bytes_written" in result) {
    return { path, sourcePath, action: "created", bytes, output };
  }
  if (command?.includes("mv ") || /moved/i.test(msg.content)) {
    return { path, sourcePath, action: "moved", bytes, output };
  }
  return { path, sourcePath, action: "file", bytes, output };
}

export function extractToolActivity(msg: Message): ToolActivityData | null {
  const content = parseJsonRecord(msg.content);
  const calls = parseJsonRecord(msg.tool_calls);
  if (!content && !calls) return null;

  const status =
    (content ? stringValue(content, ["status"]) : undefined) ||
    (calls ? stringValue(calls, ["status"]) : undefined);
  const label =
    (content ? stringValue(content, ["label", "message"]) : undefined) ||
    (calls ? stringValue(calls, ["preview", "label"]) : undefined);
  const preview =
    (content ? stringValue(content, ["preview"]) : undefined) ||
    (calls ? stringValue(calls, ["preview"]) : undefined);
  const duration =
    (content ? numberValue(content, ["duration"]) : undefined) ||
    (calls ? numberValue(calls, ["duration"]) : undefined);
  const error =
    (content ? booleanValue(content, ["error"]) : undefined) ||
    (calls ? booleanValue(calls, ["error"]) : undefined);
  const tool =
    (content ? stringValue(content, ["tool", "name"]) : undefined) ||
    msg.tool_name ||
    undefined;

  if (!status && !label && !preview) return null;
  return { status, tool, label, preview, duration, error };
}

export function stripHermesLineNumbers(content: string): string[] {
  return content.split("\n").map((line) => line.replace(/^\s*\d+\|/, ""));
}

export function formatBytes(bytes?: number): string | null {
  if (typeof bytes !== "number") return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function dispatchToast(
  title: string,
  body: string,
  tone: "info" | "success" | "warning" | "error" = "info",
): void {
  window.dispatchEvent(
    new CustomEvent("desktop-toast", {
      detail: { title, body, tone },
    }),
  );
}

export function normalizeExternalHref(href?: string): string | null {
  const value = href?.trim();
  if (!value || value.startsWith("#")) return null;
  if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value)) return value;
  if (/^www\./i.test(value)) return `https://${value}`;
  return null;
}

export function canPreviewHref(href: string | null): href is string {
  return Boolean(href && /^https?:\/\//i.test(href));
}

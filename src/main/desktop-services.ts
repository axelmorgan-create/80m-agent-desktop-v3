import { execFile } from "child_process";
import * as fs from "fs";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "path";
import { homedir, tmpdir } from "os";
import { fileURLToPath, pathToFileURL } from "url";
import {
  getEnhancedPath,
  HERMES_HOME,
  HERMES_PYTHON,
  HERMES_REPO,
} from "./installer";

export interface WorkspaceFileChange {
  root: string;
  path: string;
  name: string;
  relativePath: string;
  event: string;
  size: number;
  modifiedAt: number;
}

interface WorkspaceWatcherState {
  root: string;
  watchers: Map<string, fs.FSWatcher>;
  pending: Map<string, NodeJS.Timeout>;
  closed: boolean;
  onChange: (payload: WorkspaceFileChange) => void;
}

export type DocumentPreviewKind =
  | "text"
  | "markdown"
  | "image"
  | "pdf"
  | "office"
  | "directory"
  | "binary"
  | "missing";

export interface DocumentPreview {
  path: string;
  name: string;
  exists: boolean;
  kind: DocumentPreviewKind;
  size: number;
  fileUrl?: string;
  content?: string;
  truncated?: boolean;
  error?: string;
}

export interface ObsidianVaultInfo {
  path: string | null;
  name: string;
  exists: boolean;
  noteCount: number;
  totalFiles: number;
}

const MAX_WORKSPACE_WATCH_DIRS = 1200;
const WATCH_IGNORED_DIRS = new Set([
  ".cache",
  ".git",
  ".next",
  ".parcel-cache",
  ".turbo",
  ".vite",
  "android",
  "build",
  "coverage",
  "dist",
  "ios",
  "linux-unpacked",
  "node_modules",
  "out",
  "release",
  "target",
  "vendor",
]);

let workspaceWatcher: WorkspaceWatcherState | null = null;

function desktopConfigPath(): string {
  return join(HERMES_HOME, "desktop.json");
}

export function readDesktopJson(): Record<string, unknown> {
  try {
    const file = desktopConfigPath();
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return {};
  }
}

export function writeDesktopJson(data: Record<string, unknown>): void {
  try {
    if (!fs.existsSync(HERMES_HOME))
      fs.mkdirSync(HERMES_HOME, { recursive: true });
    fs.writeFileSync(
      desktopConfigPath(),
      JSON.stringify(data, null, 2),
      "utf-8",
    );
  } catch {
    // Desktop preferences are best-effort.
  }
}

function normalizeLocalPath(input: string): string {
  let targetPath = String(input || "").trim();
  targetPath = targetPath.replace(/^["'`]+|["'`]+$/g, "");
  if (targetPath.startsWith("file://")) {
    try {
      targetPath = fileURLToPath(targetPath);
    } catch {
      targetPath = decodeURIComponent(targetPath.replace(/^file:\/\//, ""));
    }
  }
  targetPath = targetPath.replace(/^~(?=\/|\\|$)/, homedir());
  return targetPath;
}

function localPathCandidates(input: string): string[] {
  const normalized = normalizeLocalPath(input);
  const withoutLineNumber = normalized.replace(/:\d+(?::\d+)?$/, "");
  const rawCandidates = [normalized, withoutLineNumber];
  const bases = [
    "",
    HERMES_REPO,
    HERMES_HOME,
    join(HERMES_HOME, "cache"),
    homedir(),
  ];
  const candidates: string[] = [];

  for (const raw of rawCandidates) {
    if (!raw) continue;
    if (isAbsolute(raw)) {
      candidates.push(raw);
      continue;
    }
    for (const base of bases) {
      candidates.push(base ? resolve(base, raw) : resolve(raw));
    }
  }

  return [...new Set(candidates)];
}

export function resolveExistingLocalPath(input: string): string | null {
  for (const candidate of localPathCandidates(input)) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function shouldIgnoreWatchPath(targetPath: string): boolean {
  const parts = targetPath.split(/[\\/]+/);
  return parts.some(
    (part) =>
      WATCH_IGNORED_DIRS.has(part) ||
      part.endsWith(".asar") ||
      part.endsWith(".tmp"),
  );
}

function resolveWorkspaceRoot(input: string): string | null {
  const resolvedPath = resolveExistingLocalPath(input);
  if (!resolvedPath || !fs.existsSync(resolvedPath)) return null;
  try {
    const stat = fs.statSync(resolvedPath);
    return stat.isDirectory() ? resolvedPath : dirname(resolvedPath);
  } catch {
    return null;
  }
}

function emitWorkspaceFileChange(
  state: WorkspaceWatcherState,
  targetPath: string,
  event: string,
): void {
  if (state.closed || shouldIgnoreWatchPath(targetPath)) return;
  if (!fs.existsSync(targetPath)) return;

  let stat: fs.Stats;
  try {
    stat = fs.statSync(targetPath);
  } catch {
    return;
  }

  if (stat.isDirectory()) {
    watchWorkspaceDirectory(state, targetPath);
    return;
  }
  if (!stat.isFile()) return;

  state.onChange({
    root: state.root,
    path: targetPath,
    name: basename(targetPath),
    relativePath: relative(state.root, targetPath) || basename(targetPath),
    event,
    size: stat.size,
    modifiedAt: stat.mtimeMs,
  });
}

function scheduleWorkspaceFileChange(
  state: WorkspaceWatcherState,
  targetPath: string,
  event: string,
): void {
  if (state.closed || shouldIgnoreWatchPath(targetPath)) return;
  const existing = state.pending.get(targetPath);
  if (existing) clearTimeout(existing);

  const timeout = setTimeout(() => {
    state.pending.delete(targetPath);
    emitWorkspaceFileChange(state, targetPath, event);
  }, 160);
  state.pending.set(targetPath, timeout);
}

function watchWorkspaceDirectory(
  state: WorkspaceWatcherState,
  dirPath: string,
): void {
  if (
    state.closed ||
    state.watchers.has(dirPath) ||
    state.watchers.size >= MAX_WORKSPACE_WATCH_DIRS ||
    shouldIgnoreWatchPath(dirPath)
  ) {
    return;
  }

  let watcher: fs.FSWatcher;
  try {
    watcher = fs.watch(dirPath, { persistent: false }, (event, filename) => {
      if (!filename) return;
      const changedPath = resolve(dirPath, filename.toString());
      scheduleWorkspaceFileChange(state, changedPath, event);
    });
  } catch {
    return;
  }

  watcher.on("error", () => {
    try {
      watcher.close();
    } catch {
      // watcher is already closed
    }
    state.watchers.delete(dirPath);
  });
  state.watchers.set(dirPath, watcher);

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    watchWorkspaceDirectory(state, join(dirPath, entry.name));
    if (state.watchers.size >= MAX_WORKSPACE_WATCH_DIRS) break;
  }
}

export function startWorkspaceWatch(
  targetPath: string,
  onChange: (payload: WorkspaceFileChange) => void,
): boolean {
  stopWorkspaceWatch();
  const root = resolveWorkspaceRoot(targetPath);
  if (!root) return false;

  const state: WorkspaceWatcherState = {
    root,
    watchers: new Map(),
    pending: new Map(),
    closed: false,
    onChange,
  };
  workspaceWatcher = state;
  watchWorkspaceDirectory(state, root);
  return state.watchers.size > 0;
}

export function stopWorkspaceWatch(): void {
  if (!workspaceWatcher) return;
  workspaceWatcher.closed = true;
  for (const timeout of workspaceWatcher.pending.values()) {
    clearTimeout(timeout);
  }
  workspaceWatcher.pending.clear();
  for (const watcher of workspaceWatcher.watchers.values()) {
    try {
      watcher.close();
    } catch {
      // best-effort cleanup
    }
  }
  workspaceWatcher.watchers.clear();
  workspaceWatcher = null;
}

function isTextPreviewExtension(extension: string): boolean {
  return [
    ".txt",
    ".md",
    ".markdown",
    ".csv",
    ".tsv",
    ".json",
    ".jsonl",
    ".yaml",
    ".yml",
    ".xml",
    ".html",
    ".css",
    ".scss",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".rb",
    ".go",
    ".rs",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".sh",
    ".zsh",
    ".bash",
    ".log",
  ].includes(extension);
}

function isEditableDocumentExtension(extension: string): boolean {
  return [
    ".txt",
    ".md",
    ".markdown",
    ".json",
    ".jsonl",
    ".yaml",
    ".yml",
  ].includes(extension);
}

export function writeDocumentContent(
  targetPath: string,
  content: string,
): { success: boolean; error?: string; path?: string } {
  const resolvedPath = resolveExistingLocalPath(targetPath);
  if (!resolvedPath) {
    return { success: false, error: "File not found." };
  }

  const stat = fs.statSync(resolvedPath);
  if (stat.isDirectory()) {
    return { success: false, error: "Cannot edit a directory." };
  }

  const extension = extname(resolvedPath).toLowerCase();
  if (!isEditableDocumentExtension(extension)) {
    return { success: false, error: "This file type is read-only here." };
  }

  if (content.length > 1024 * 1024 * 2) {
    return { success: false, error: "File is too large to save safely." };
  }

  if (extension === ".json") {
    try {
      JSON.parse(content || "null");
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? `Invalid JSON: ${error.message}`
            : "Invalid JSON.",
      };
    }
  }

  try {
    fs.writeFileSync(resolvedPath, content, "utf-8");
    return { success: true, path: resolvedPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Save failed.",
    };
  }
}

function runHermesPythonJson(
  script: string,
  args: string[],
  timeout = 60000,
): Promise<Record<string, unknown>> {
  return new Promise((resolveResult) => {
    execFile(
      HERMES_PYTHON,
      ["-c", script, ...args],
      {
        cwd: HERMES_REPO,
        timeout,
        maxBuffer: 1024 * 1024 * 4,
        env: {
          ...process.env,
          HOME: homedir(),
          HERMES_HOME,
          PATH: getEnhancedPath(),
          PYTHONUNBUFFERED: "1",
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          resolveResult({
            success: false,
            error: stderr?.trim() || error.message,
          });
          return;
        }
        try {
          resolveResult(JSON.parse(stdout.trim()));
        } catch {
          resolveResult({
            success: false,
            error: stdout.trim() || "No output",
          });
        }
      },
    );
  });
}

async function extractOfficePreview(filePath: string): Promise<string> {
  const script = String.raw`
import html
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

path = sys.argv[1]

def text_from_xml(blob):
    try:
        root = ET.fromstring(blob)
        text = " ".join(t.strip() for t in root.itertext() if t and t.strip())
        return html.unescape(re.sub(r"\s+", " ", text)).strip()
    except Exception:
        return ""

def read_member(zf, name):
    try:
        return zf.read(name)
    except KeyError:
        return b""

items = []
try:
    with zipfile.ZipFile(path) as zf:
        names = zf.namelist()
        lower = path.lower()
        if lower.endswith(".docx"):
            for name in ["word/document.xml", "word/footnotes.xml", "word/endnotes.xml"]:
                text = text_from_xml(read_member(zf, name))
                if text:
                    items.append(text)
        elif lower.endswith(".pptx"):
            for name in sorted(n for n in names if n.startswith("ppt/slides/slide") and n.endswith(".xml")):
                text = text_from_xml(read_member(zf, name))
                if text:
                    items.append(text)
        elif lower.endswith(".xlsx"):
            shared = []
            shared_xml = read_member(zf, "xl/sharedStrings.xml")
            if shared_xml:
                try:
                    root = ET.fromstring(shared_xml)
                    shared = [" ".join(t.strip() for t in si.itertext() if t and t.strip()) for si in root]
                except Exception:
                    shared = []
            for name in sorted(n for n in names if n.startswith("xl/worksheets/sheet") and n.endswith(".xml"))[:5]:
                xml = read_member(zf, name)
                try:
                    root = ET.fromstring(xml)
                    values = []
                    for cell in root.iter():
                        if cell.tag.endswith("}c") or cell.tag == "c":
                            cell_type = cell.attrib.get("t")
                            value = ""
                            for child in cell:
                                if child.tag.endswith("}v") or child.tag == "v":
                                    value = child.text or ""
                                    break
                            if cell_type == "s" and value.isdigit() and int(value) < len(shared):
                                value = shared[int(value)]
                            if value:
                                values.append(value)
                    if values:
                        items.append(" | ".join(values[:80]))
                except Exception:
                    pass
    print(json.dumps({"success": True, "content": "\n\n".join(items)[:60000]}))
except Exception as exc:
    print(json.dumps({"success": False, "error": str(exc)}))
`;
  const result = await runHermesPythonJson(script, [filePath], 15000);
  if (result.success && typeof result.content === "string")
    return result.content;
  return "";
}

export async function getDocumentPreview(
  targetPath: string,
): Promise<DocumentPreview> {
  const resolvedPath = resolveExistingLocalPath(targetPath);
  const fallbackName = basename(normalizeLocalPath(targetPath)) || "document";
  if (!resolvedPath) {
    return {
      path: normalizeLocalPath(targetPath),
      name: fallbackName,
      exists: false,
      kind: "missing",
      size: 0,
      error: "File not found",
    };
  }

  const stat = fs.statSync(resolvedPath);
  const name = basename(resolvedPath);
  if (stat.isDirectory()) {
    return {
      path: resolvedPath,
      name,
      exists: true,
      kind: "directory",
      size: stat.size,
      fileUrl: pathToFileURL(resolvedPath).toString(),
    };
  }

  const extension = extname(resolvedPath).toLowerCase();
  const base = {
    path: resolvedPath,
    name,
    exists: true,
    size: stat.size,
    fileUrl: pathToFileURL(resolvedPath).toString(),
  };

  if (
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"].includes(
      extension,
    )
  ) {
    return { ...base, kind: "image" };
  }
  if (extension === ".pdf") return { ...base, kind: "pdf" };

  if ([".docx", ".pptx", ".xlsx"].includes(extension)) {
    const content = await extractOfficePreview(resolvedPath);
    return {
      ...base,
      kind: "office",
      content,
      truncated: content.length >= 60000,
      error: content ? undefined : "No readable document text found",
    };
  }

  if (isTextPreviewExtension(extension) || stat.size <= 512 * 1024) {
    const maxBytes = 120 * 1024;
    const buffer = fs.readFileSync(resolvedPath);
    if (buffer.subarray(0, Math.min(buffer.length, 4096)).includes(0)) {
      return { ...base, kind: "binary" };
    }
    const content = buffer.subarray(0, maxBytes).toString("utf-8");
    return {
      ...base,
      kind:
        extension === ".md" || extension === ".markdown" ? "markdown" : "text",
      content,
      truncated: buffer.length > maxBytes,
    };
  }

  return { ...base, kind: "binary" };
}

function countVaultFiles(root: string): {
  noteCount: number;
  totalFiles: number;
} {
  let noteCount = 0;
  let totalFiles = 0;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".obsidian") continue;
      const child = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(child);
      } else {
        totalFiles++;
        if (entry.name.toLowerCase().endsWith(".md")) noteCount++;
      }
      if (totalFiles > 5000) return { noteCount, totalFiles };
    }
  }
  return { noteCount, totalFiles };
}

export function getObsidianVaultInfo(): ObsidianVaultInfo {
  const desktop = readDesktopJson();
  const configured =
    typeof desktop.obsidianVaultPath === "string"
      ? desktop.obsidianVaultPath
      : "";
  const candidates = [
    configured,
    process.env.OBSIDIAN_VAULT_PATH || "",
    join(homedir(), "obsidian-vault"),
    join(homedir(), "Documents", "Obsidian Vault"),
    join(HERMES_HOME, "obsidian-vault"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolvedPath = resolveExistingLocalPath(candidate);
    if (!resolvedPath) continue;
    try {
      const stat = fs.statSync(resolvedPath);
      if (!stat.isDirectory()) continue;
      const counts = countVaultFiles(resolvedPath);
      return {
        path: resolvedPath,
        name: basename(resolvedPath),
        exists: true,
        ...counts,
      };
    } catch {
      // Try next candidate.
    }
  }

  return {
    path: null,
    name: "Obsidian Vault",
    exists: false,
    noteCount: 0,
    totalFiles: 0,
  };
}

export function writeFloatWav(filePath: string, samples: number[]): void {
  const numSamples = samples.length;
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * 2;
  const fileSize = 36 + dataSize;

  const wavHeader = Buffer.alloc(44);
  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(fileSize, 4);
  wavHeader.write("WAVE", 8);
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(dataSize, 40);

  const audioBuf = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, Number(samples[i]) || 0));
    audioBuf.writeInt16LE(Math.round(s * 32767), i * 2);
  }

  fs.writeFileSync(filePath, Buffer.concat([wavHeader, audioBuf]));
}

export function audioExtensionFromMime(mimeType: string): string {
  if (/ogg/i.test(mimeType)) return ".ogg";
  if (/wav/i.test(mimeType)) return ".wav";
  if (/mpeg|mp3/i.test(mimeType)) return ".mp3";
  if (/mp4|m4a/i.test(mimeType)) return ".m4a";
  return ".webm";
}

export async function transcribeAudioFile(filePath: string): Promise<string> {
  const script = String.raw`
import json
import sys
from tools.transcription_tools import transcribe_audio

result = transcribe_audio(sys.argv[1])
print(json.dumps(result, ensure_ascii=False))
`;
  const result = await runHermesPythonJson(script, [filePath], 180000);
  if (result.success && typeof result.transcript === "string") {
    return result.transcript.trim();
  }
  return "";
}

export async function synthesizeSpeech(text: string): Promise<string> {
  const outputPath = join(
    tmpdir(),
    "80m-voice",
    `tts_${Date.now()}_${Math.random().toString(16).slice(2)}.mp3`,
  );
  fs.mkdirSync(dirname(outputPath), { recursive: true });

  const script = String.raw`
import asyncio
import json
import sys

text = sys.argv[1]
output_path = sys.argv[2]

try:
    from tools.tts_tool import text_to_speech_tool
    result = json.loads(text_to_speech_tool(text, output_path))
    if result.get("success") and result.get("file_path"):
        print(json.dumps(result, ensure_ascii=False))
        raise SystemExit(0)
except Exception as exc:
    last_error = str(exc)
else:
    last_error = "Hermes TTS returned no audio"

try:
    import edge_tts
    async def main():
        communicate = edge_tts.Communicate(text, "en-US-AriaNeural")
        await communicate.save(output_path)
    asyncio.run(main())
    print(json.dumps({"success": True, "file_path": output_path, "provider": "edge-fallback"}, ensure_ascii=False))
except Exception as exc:
    print(json.dumps({"success": False, "error": f"{last_error}; edge fallback failed: {exc}"}, ensure_ascii=False))
`;
  const result = await runHermesPythonJson(script, [text, outputPath], 90000);
  if (result.success && typeof result.file_path === "string") {
    return result.file_path;
  }
  return "";
}

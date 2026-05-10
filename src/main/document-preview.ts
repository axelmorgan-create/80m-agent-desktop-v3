import * as fs from "fs";
import { basename, extname } from "path";
import { pathToFileURL } from "url";
import { normalizeLocalPath, resolveExistingLocalPath } from "./desktop-config";
import { runHermesPythonJson } from "./desktop-python";

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

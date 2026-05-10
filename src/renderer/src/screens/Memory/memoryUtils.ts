import type {
  DocumentPreviewData,
  FileNode,
  GraphEdge,
  GraphNote,
  NeuralClusterDefinition,
  NeuralVaultIndex,
  VaultIndexEntry,
} from "./memoryTypes";

const VAULT_SCAN_MAX_ENTRIES = 1600;
const VAULT_SCAN_MAX_NOTES = 700;
const VAULT_SCAN_MAX_DEPTH = 5;
const WIKILINK_RE = /\[\[([^\]|#]+)[^\]]*\]\]/g;
const LINK_SCAN_LIMIT = 4096;

export const EMPTY_VAULT_INDEX: NeuralVaultIndex = {
  folders: [],
  notes: [],
  scannedEntries: 0,
  truncated: false,
  graphNotes: [],
  graphEdges: [],
};

export function timeAgo(ts: number | null): string {
  if (!ts) return "";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 10000) return `${Math.round(value / 1000)}K`;
  return value.toLocaleString();
}

function noteIdFromRelPath(relPath: string): string {
  return relPath.replace(/\.(md|markdown)$/i, "").toLowerCase();
}

function noteIdFromWikilink(link: string): string {
  const parts = link.trim().split("/");
  return parts[parts.length - 1].toLowerCase();
}

async function extractWikilinks(notePath: string): Promise<string[]> {
  try {
    const preview = (await window.hermesAPI.readDocumentPreview(
      notePath,
    )) as DocumentPreviewData;
    const content = (preview.content || "").slice(0, LINK_SCAN_LIMIT);
    const links: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = WIKILINK_RE.exec(content)) !== null) {
      links.push(noteIdFromWikilink(match[1]));
    }
    return links;
  } catch {
    return [];
  }
}

export function documentExtension(note: DocumentPreviewData | null): string {
  if (!note) return "";
  const match = (note.path || note.name).toLowerCase().match(/\.([^.]+)$/);
  return match ? `.${match[1]}` : "";
}

export function displayFileName(name: string): string {
  const cleaned = name
    .replace(
      /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|\s)+/gu,
      "",
    )
    .trim();
  return cleaned || name;
}

export function displayLocalPath(value: string): string {
  return value
    .split(/([/\\])/)
    .map((part) =>
      part === "/" || part === "\\" ? part : displayFileName(part),
    )
    .join("");
}

function normalizeVaultPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function vaultRelativePath(rootPath: string, entryPath: string): string {
  const root = normalizeVaultPath(rootPath).replace(/\/$/, "");
  const entry = normalizeVaultPath(entryPath);
  if (entry === root) return "";
  return entry.startsWith(`${root}/`) ? entry.slice(root.length + 1) : entry;
}

function vaultMatchText(entry: VaultIndexEntry): string {
  return displayFileName(`${entry.relativePath} ${entry.name}`)
    .toLowerCase()
    .replace(/[_-]+/g, " ");
}

function isMarkdownVaultFile(node: FileNode): boolean {
  return /\.(md|markdown)$/i.test(node.name);
}

function shouldSkipVaultNode(node: FileNode): boolean {
  const name = node.name.toLowerCase();
  if (name.startsWith(".")) return true;
  return [
    "node_modules",
    "dist",
    "out",
    "build",
    "release",
    "releases",
    "vendor",
    "__pycache__",
  ].includes(name);
}

export function entryMatchesCluster(
  entry: VaultIndexEntry,
  cluster: NeuralClusterDefinition,
): boolean {
  if (cluster.id === "notes" || cluster.id === "sync") return true;
  const text = vaultMatchText(entry);
  return cluster.keywords.some((keyword) =>
    text.includes(keyword.toLowerCase()),
  );
}

export async function buildNeuralVaultIndex(
  vaultPath: string,
): Promise<NeuralVaultIndex> {
  const queue: Array<{ path: string; depth: number }> = [
    { path: vaultPath, depth: 0 },
  ];
  const folders: VaultIndexEntry[] = [];
  const notes: VaultIndexEntry[] = [];
  let scannedEntries = 0;
  let truncated = false;

  while (queue.length > 0) {
    const current = queue.shift()!;
    let entries: FileNode[] = [];
    try {
      entries = await window.hermesAPI.readDirectory(current.path);
    } catch {
      truncated = true;
      continue;
    }

    for (const node of entries) {
      if (shouldSkipVaultNode(node)) continue;
      scannedEntries += 1;
      if (scannedEntries > VAULT_SCAN_MAX_ENTRIES) {
        truncated = true;
        break;
      }

      const entry: VaultIndexEntry = {
        name: node.name,
        path: node.path,
        relativePath: vaultRelativePath(vaultPath, node.path),
        isDirectory: node.isDirectory,
        depth: current.depth,
      };

      if (node.isDirectory) {
        folders.push(entry);
        if (current.depth < VAULT_SCAN_MAX_DEPTH) {
          queue.push({ path: node.path, depth: current.depth + 1 });
        } else {
          truncated = true;
        }
        continue;
      }

      if (isMarkdownVaultFile(node)) {
        notes.push(entry);
        if (notes.length >= VAULT_SCAN_MAX_NOTES) {
          truncated = true;
          break;
        }
      }
    }
  }

  const idToNote = new Map<string, VaultIndexEntry>();
  for (const note of notes) {
    idToNote.set(noteIdFromRelPath(note.relativePath), note);
  }

  const linkMap = new Map<string, string[]>();
  const batchSize = 8;
  for (let i = 0; i < notes.length; i += batchSize) {
    const batch = notes.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (note) => {
        const links = await extractWikilinks(note.path);
        return { id: noteIdFromRelPath(note.relativePath), links };
      }),
    );
    for (const { id, links } of results) {
      linkMap.set(id, links);
    }
  }

  const edgeSet = new Set<string>();
  const graphEdges: GraphEdge[] = [];
  const connectionCount = new Map<string, number>();

  for (const [sourceId, links] of linkMap) {
    for (const targetName of links) {
      let targetId: string | null = null;
      if (idToNote.has(targetName)) {
        targetId = targetName;
      } else {
        for (const [id] of idToNote) {
          if (id.endsWith("/" + targetName) || id === targetName) {
            targetId = id;
            break;
          }
        }
      }
      if (!targetId || targetId === sourceId) continue;

      const edgeKey = [sourceId, targetId].sort().join("<>");
      if (edgeSet.has(edgeKey)) continue;
      edgeSet.add(edgeKey);
      graphEdges.push({ source: sourceId, target: targetId });
      connectionCount.set(sourceId, (connectionCount.get(sourceId) || 0) + 1);
      connectionCount.set(targetId, (connectionCount.get(targetId) || 0) + 1);
    }
  }

  const graphNotes: GraphNote[] = notes.map((note) => {
    const id = noteIdFromRelPath(note.relativePath);
    return {
      id,
      path: note.path,
      name: note.name,
      relativePath: note.relativePath,
      linkCount: connectionCount.get(id) || 0,
    };
  });
  graphNotes.sort((a, b) => b.linkCount - a.linkCount);

  return { folders, notes, scannedEntries, truncated, graphNotes, graphEdges };
}

export function isMarkdownDocument(note: DocumentPreviewData | null): boolean {
  const extension = documentExtension(note);
  return note?.kind === "markdown" || [".md", ".markdown"].includes(extension);
}

export function isJsonDocument(note: DocumentPreviewData | null): boolean {
  return [".json", ".jsonl"].includes(documentExtension(note));
}

export function isEditableDocument(note: DocumentPreviewData | null): boolean {
  if (!note || note.content === undefined || note.truncated) return false;
  return [
    ".txt",
    ".md",
    ".markdown",
    ".json",
    ".jsonl",
    ".yaml",
    ".yml",
  ].includes(documentExtension(note));
}

function readableJson(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

export function readableContent(note: DocumentPreviewData): string {
  const content = note.content || "";
  return isJsonDocument(note) ? readableJson(content) : content;
}

export function documentKindLabel(note: DocumentPreviewData): string {
  if (isMarkdownDocument(note)) return "Markdown";
  if (isJsonDocument(note)) return "JSON";
  if (note.kind === "office") return "Office";
  return note.kind.charAt(0).toUpperCase() + note.kind.slice(1);
}

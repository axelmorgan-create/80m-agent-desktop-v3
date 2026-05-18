import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  type Dirent,
} from "fs";
import { basename, extname, join, relative } from "path";
import { getModelConfig } from "./config";
import { sendMessageViaApi } from "./hermes-chat-api";
import type { ChatHandle, ChatToolProgress } from "./hermes-types";
import type { KanbanBoardData, KanbanTask } from "./kanban-types";
import { listKanbanBoard } from "./kanban";
import { readMemory, type MemoryInfo } from "./memory";
import { getObsidianVaultInfo, type ObsidianVaultInfo } from "./obsidian-vault";
import { listProfiles, type ProfileInfo } from "./profiles";
import {
  findSessionProfile,
  getSessionMessages,
  listSessions,
  searchSessions,
  type SearchResult,
  type SessionMessage,
  type SessionSummary,
} from "./sessions";

const MAX_VAULT_NOTES = 220;
const MAX_NOTE_BYTES = 350_000;
const NOTE_PREVIEW_CHARS = 280;
const CHAT_TIMEOUT_MS = 120_000;

export type MobileBrainSectionId =
  | "habits"
  | "timeline"
  | "tasks"
  | "finance"
  | "socials"
  | "system"
  | "vault";

export interface MobileVaultNote {
  title: string;
  path: string;
  relativePath: string;
  folder: string;
  category: MobileBrainSectionId;
  tags: string[];
  preview: string;
  updatedAt: number;
}

export interface MobileBrainSection {
  id: MobileBrainSectionId;
  label: string;
  count: number;
  notes: MobileVaultNote[];
  tasks?: MobileKanbanTask[];
  sessions?: MobileSessionSummary[];
  stats?: Record<string, string | number | boolean | null>;
}

export interface MobileKanbanTask {
  id: string;
  title: string;
  body: string;
  assignee: string;
  status: string;
  priority: number;
  updatedAt: number;
}

export interface MobileSessionSummary {
  id: string;
  profile: string;
  title: string;
  preview: string;
  model: string;
  source: string;
  messageCount: number;
  startedAt: number;
  updatedAt: number;
}

export interface MobileSessionDetail {
  id: string;
  profile: string;
  messages: SessionMessage[];
}

export interface MobileSecondBrainSnapshot {
  vault: ObsidianVaultInfo;
  indexedAt: number;
  truncated: boolean;
  notes: MobileVaultNote[];
  sections: Record<MobileBrainSectionId, MobileBrainSection>;
}

export interface MobileCompanionSnapshot {
  success: true;
  app: "80M Agent Desktop";
  companion: {
    running: true;
    port: number | null;
    localUrl: string;
  };
  runtime: unknown;
  model: ReturnType<typeof getModelConfig>;
  vault: ObsidianVaultInfo;
  profiles: ProfileInfo[];
  activeProfile: string;
  sessions: MobileSessionSummary[];
  memory: MemoryInfo;
  kanban: {
    success: boolean;
    total: number;
    columns: Record<string, number>;
    tasks: MobileKanbanTask[];
    error: string;
  };
  secondBrain: MobileSecondBrainSnapshot;
  now: number;
}

function cleanText(value: unknown, maxLength = NOTE_PREVIEW_CHARS): string {
  return String(value || "")
    .replaceAll("\u0000", "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

function stripMarkdown(value: string): string {
  return value
    .replace(/^---[\s\S]*?---/m, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[[^\]]+]\([^)]+\)/g, (match) => {
      const label = match.match(/\[([^\]]+)]/)?.[1];
      return label || match;
    })
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[>*\-+]\s+/gm, "")
    .replace(/[*_`~]/g, "");
}

function titleFromMarkdown(filePath: string, content: string): string {
  const frontmatterTitle = content.match(
    /^---[\s\S]*?\ntitle:\s*["']?(.+?)["']?\s*$/m,
  )?.[1];
  if (frontmatterTitle) return cleanText(frontmatterTitle, 120);
  const heading = content.match(/^#\s+(.+)$/m)?.[1];
  if (heading) return cleanText(heading, 120);
  return basename(filePath, extname(filePath)).replace(/[-_]/g, " ");
}

function tagsFromMarkdown(content: string): string[] {
  const tags = new Set<string>();
  const frontmatterTags = content.match(
    /^---[\s\S]*?\ntags:\s*([^\n]+)\n[\s\S]*?---/m,
  )?.[1];
  if (frontmatterTags) {
    frontmatterTags
      .replace(/[[\]",']/g, " ")
      .split(/[,\s]+/)
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean)
      .forEach((tag) => tags.add(tag));
  }
  for (const match of content.matchAll(/(^|\s)#([a-zA-Z0-9/_-]{2,})/g)) {
    tags.add(match[2]);
  }
  return [...tags].slice(0, 12);
}

function classifyNote(
  relativePath: string,
  content: string,
): MobileBrainSectionId {
  const haystack = `${relativePath}\n${content.slice(0, 4000)}`.toLowerCase();
  const rules: Array<[MobileBrainSectionId, string[]]> = [
    [
      "finance",
      [
        "finance",
        "budget",
        "invoice",
        "transaction",
        "capital",
        "revenue",
        "expense",
        "cash",
        "money",
      ],
    ],
    [
      "habits",
      [
        "habit",
        "routine",
        "daily",
        "meditation",
        "workout",
        "streak",
        "wellness",
      ],
    ],
    [
      "tasks",
      ["task", "todo", "kanban", "project", "sprint", "priority", "backlog"],
    ],
    [
      "timeline",
      [
        "timeline",
        "calendar",
        "schedule",
        "journal",
        "meeting",
        "today",
        "daily note",
      ],
    ],
    [
      "socials",
      [
        "social",
        "contact",
        "people",
        "network",
        "discord",
        "message",
        "dm",
        "client",
      ],
    ],
    [
      "system",
      ["system", "setting", "config", "profile", "soul", "memory", "agent"],
    ],
  ];
  return (
    rules.find(([, needles]) =>
      needles.some((needle) => haystack.includes(needle)),
    )?.[0] || "vault"
  );
}

function previewFromMarkdown(content: string): string {
  const stripped = stripMarkdown(content)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => !/^lifeos_|^[a-z_]+:/.test(line));
  return cleanText(stripped || "No preview available.");
}

function readVaultNotes(vault: ObsidianVaultInfo): {
  notes: MobileVaultNote[];
  truncated: boolean;
} {
  if (!vault.exists || !vault.path || !existsSync(vault.path)) {
    return { notes: [], truncated: false };
  }

  const notes: MobileVaultNote[] = [];
  const stack = [vault.path];
  let truncated = false;

  while (stack.length && notes.length < MAX_VAULT_NOTES) {
    const dir = stack.pop()!;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".obsidian") continue;
      const child = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(child);
        continue;
      }
      if (!entry.name.toLowerCase().endsWith(".md")) continue;
      if (notes.length >= MAX_VAULT_NOTES) {
        truncated = true;
        break;
      }

      try {
        const stat = statSync(child);
        if (stat.size > MAX_NOTE_BYTES) continue;
        const content = readFileSync(child, "utf-8");
        const relativePath = relative(vault.path, child);
        notes.push({
          title: titleFromMarkdown(child, content),
          path: child,
          relativePath,
          folder: relative(vault.path, dir) || vault.name,
          category: classifyNote(relativePath, content),
          tags: tagsFromMarkdown(content),
          preview: previewFromMarkdown(content),
          updatedAt: Math.floor(stat.mtimeMs / 1000),
        });
      } catch {
        // Skip unreadable notes; the mobile snapshot should still load.
      }
    }
  }

  return {
    notes: notes.sort((a, b) => b.updatedAt - a.updatedAt),
    truncated: truncated || stack.length > 0,
  };
}

function toMobileTask(task: KanbanTask): MobileKanbanTask {
  return {
    id: task.id,
    title: task.title,
    body: cleanText(task.body, 220),
    assignee: task.assignee || "",
    status: task.status,
    priority: task.priority,
    updatedAt: task.completed_at || task.started_at || task.created_at || 0,
  };
}

function toMobileSession(session: SessionSummary): MobileSessionSummary {
  const messages = getSessionMessages(session.id, session.profile).slice(-4);
  const preview =
    session.preview ||
    messages.map((message) => cleanText(message.content, 140)).find(Boolean) ||
    "";
  return {
    id: session.id,
    profile: session.profile,
    title: session.title || preview || "Untitled session",
    preview,
    model: session.model || "",
    source: session.source || "",
    messageCount: session.messageCount || messages.length,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
  };
}

function searchToMobileSession(result: SearchResult): MobileSessionSummary {
  return {
    id: result.sessionId,
    profile: result.profile,
    title: result.title || cleanText(result.snippet, 80) || "Search result",
    preview: cleanText(
      result.snippet.replaceAll("<<", "").replaceAll(">>", ""),
      180,
    ),
    model: result.model || "",
    source: result.source || "",
    messageCount: result.messageCount,
    startedAt: result.startedAt,
    updatedAt: result.updatedAt,
  };
}

function makeSection(
  id: MobileBrainSectionId,
  label: string,
  notes: MobileVaultNote[],
  extras: Partial<MobileBrainSection> = {},
): MobileBrainSection {
  return {
    id,
    label,
    count:
      notes.length +
      (extras.tasks?.length || 0) +
      (extras.sessions?.length || 0),
    notes: notes.slice(0, 8),
    ...extras,
  };
}

export function buildMobileSecondBrainSnapshot(
  board?: KanbanBoardData | null,
  sessions: MobileSessionSummary[] = [],
  memory?: MemoryInfo,
): MobileSecondBrainSnapshot {
  const vault = getObsidianVaultInfo();
  const { notes, truncated } = readVaultNotes(vault);
  const notesBySection = (section: MobileBrainSectionId) =>
    notes.filter((note) => note.category === section).slice(0, 10);
  const openTasks = (board?.tasks || [])
    .filter((task) => !["done", "archived"].includes(task.status))
    .slice(0, 10)
    .map(toMobileTask);

  return {
    vault,
    indexedAt: Date.now(),
    truncated,
    notes,
    sections: {
      habits: makeSection("habits", "Habits", notesBySection("habits")),
      timeline: makeSection(
        "timeline",
        "Timeline",
        notesBySection("timeline"),
        {
          sessions: sessions.slice(0, 4),
        },
      ),
      tasks: makeSection("tasks", "Tasks", notesBySection("tasks"), {
        tasks: openTasks,
      }),
      finance: makeSection("finance", "Finance", notesBySection("finance")),
      socials: makeSection("socials", "Socials", notesBySection("socials"), {
        sessions: sessions.slice(0, 5),
      }),
      system: makeSection("system", "System", notesBySection("system"), {
        stats: {
          vaultConnected: vault.exists,
          noteCount: vault.noteCount,
          totalFiles: vault.totalFiles,
          memoryEntries: memory?.memory.entries.length || 0,
          totalSessions: memory?.stats.totalSessions || 0,
          totalMessages: memory?.stats.totalMessages || 0,
        },
      }),
      vault: makeSection("vault", "Vault", notes.slice(0, 10), {
        stats: {
          noteCount: vault.noteCount,
          totalFiles: vault.totalFiles,
          truncated,
        },
      }),
    },
  };
}

export async function listMobileSessions(options: {
  profile?: string;
  query?: string;
  limit?: number;
}): Promise<MobileSessionSummary[]> {
  const limit = Math.max(1, Math.min(options.limit || 12, 40));
  if (options.query?.trim()) {
    return searchSessions(options.query.trim(), limit, options.profile).map(
      searchToMobileSession,
    );
  }
  return listSessions(limit, 0, options.profile).map(toMobileSession);
}

export function getMobileSessionDetail(
  sessionId: string,
  profile?: string,
): MobileSessionDetail {
  const resolvedProfile = profile || findSessionProfile(sessionId) || "default";
  return {
    id: sessionId,
    profile: resolvedProfile,
    messages: getSessionMessages(sessionId, resolvedProfile),
  };
}

export async function sendMobileChatMessage(input: {
  message: string;
  profile?: string;
  sessionId?: string;
}): Promise<{
  success: true;
  response: string;
  sessionId?: string;
  profile: string;
  toolProgress: Array<string | ChatToolProgress>;
}> {
  const profile = input.profile || "default";
  const history = input.sessionId
    ? getSessionMessages(input.sessionId, profile)
        .slice(-16)
        .filter((message) => ["user", "assistant"].includes(message.role))
        .map((message) => ({
          role: message.role,
          content: message.content,
        }))
    : [];

  return new Promise((resolve, reject) => {
    let response = "";
    let settled = false;
    let handle: ChatHandle | null = null;
    const toolProgress: Array<string | ChatToolProgress> = [];
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      handle?.abort();
      reject(new Error("Hermes chat timed out."));
    }, CHAT_TIMEOUT_MS);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn();
    };

    handle = sendMessageViaApi(
      input.message,
      {
        onChunk: (chunk) => {
          response += chunk;
        },
        onDone: (sessionId) =>
          finish(() =>
            resolve({
              success: true,
              response: cleanText(response, 12_000),
              sessionId: sessionId || input.sessionId,
              profile,
              toolProgress,
            }),
          ),
        onError: (error) => finish(() => reject(new Error(error))),
        onToolProgress: (event) => {
          toolProgress.push(event);
        },
      },
      profile,
      input.sessionId,
      history,
    );
  });
}

export async function buildMobileCompanionSnapshot(input: {
  port: number | null;
  localUrl: string;
  runtime: unknown;
}): Promise<MobileCompanionSnapshot> {
  const [profilesResult, boardResult] = await Promise.allSettled([
    listProfiles(),
    listKanbanBoard(),
  ]);
  const profiles =
    profilesResult.status === "fulfilled" ? profilesResult.value : [];
  const activeProfile =
    profiles.find((profile) => profile.isActive)?.name ||
    profiles[0]?.name ||
    "default";
  const memory = readMemory(activeProfile);
  const sessionProfiles = [
    ...new Set([activeProfile, ...profiles.map((profile) => profile.name)]),
  ].slice(0, 8);
  const sessionGroups = await Promise.all(
    sessionProfiles.map((profile) =>
      listMobileSessions({
        profile,
        limit: profile === activeProfile ? 12 : 6,
      }).catch(() => []),
    ),
  );
  const seenSessions = new Set<string>();
  const sessions = sessionGroups
    .flat()
    .filter((session) => {
      const key = `${session.profile}:${session.id}`;
      if (seenSessions.has(key)) return false;
      seenSessions.add(key);
      return true;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 40);
  const board =
    boardResult.status === "fulfilled" && boardResult.value.success
      ? boardResult.value.data || null
      : null;
  const secondBrain = buildMobileSecondBrainSnapshot(board, sessions, memory);

  return {
    success: true,
    app: "80M Agent Desktop",
    companion: {
      running: true,
      port: input.port,
      localUrl: input.localUrl,
    },
    runtime: input.runtime,
    model: getModelConfig(activeProfile),
    vault: secondBrain.vault,
    profiles,
    activeProfile,
    sessions,
    memory,
    kanban: {
      success: Boolean(board),
      total: board?.tasks.length || 0,
      columns: board?.stats.by_status || {},
      tasks: (board?.tasks || [])
        .filter((task) => task.status !== "archived")
        .slice(0, 20)
        .map(toMobileTask),
      error:
        boardResult.status === "rejected"
          ? String(boardResult.reason)
          : boardResult.status === "fulfilled"
            ? boardResult.value.error || ""
            : "",
    },
    secondBrain,
    now: Date.now(),
  };
}

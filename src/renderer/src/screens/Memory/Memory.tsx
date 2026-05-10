import { useState, useEffect, useCallback } from "react";
import { Plus, Trash, Refresh } from "../../assets/icons";
import { useI18n } from "../../components/useI18n";
import {
  BookOpen,
  Brain,
  Braces,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleEllipsis,
  DollarSign,
  Edit3,
  Eye,
  ExternalLink,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  MessageSquare,
  Radio,
  Save,
  User,
  Users,
  X,
} from "lucide-react";
import AgentMarkdown from "../../components/AgentMarkdown";
import NeuralMap3D from "../../components/80m/NeuralMap3D";
import type {
  DocumentPreviewData,
  FileNode,
  MemoryData,
  MemoryProviderInfo,
  NeuralCluster,
  NeuralClusterDefinition,
  NeuralClusterId,
  NeuralVaultIndex,
  ObsidianVaultInfo,
} from "./memoryTypes";
import {
  buildNeuralVaultIndex,
  displayFileName,
  displayLocalPath,
  documentExtension,
  documentKindLabel,
  EMPTY_VAULT_INDEX,
  entryMatchesCluster,
  formatCompact,
  isEditableDocument,
  isJsonDocument,
  isMarkdownDocument,
  readableContent,
  timeAgo,
} from "./memoryUtils";

const PROVIDER_URLS: Record<string, string> = {
  honcho: "https://app.honcho.dev",
  hindsight: "https://ui.hindsight.vectorize.io",
  mem0: "https://app.mem0.ai",
  retaindb: "https://retaindb.com",
  supermemory: "https://supermemory.ai",
  byterover: "https://app.byterover.dev",
};

function DocumentKindIcon({
  note,
}: {
  note: DocumentPreviewData;
}): React.JSX.Element {
  if (isMarkdownDocument(note)) return <BookOpen size={17} />;
  if (isJsonDocument(note)) return <FileJson size={17} />;
  if ([".yaml", ".yml"].includes(documentExtension(note))) {
    return <Braces size={17} />;
  }
  if (note.kind === "text") return <FileCode2 size={17} />;
  return <FileText size={17} />;
}

function VaultTreeNode({
  node,
  level,
  onFileClick,
}: {
  node: FileNode;
  level: number;
  onFileClick: (path: string) => void;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);

  async function toggle(): Promise<void> {
    if (!node.isDirectory) {
      onFileClick(node.path);
      return;
    }
    if (!expanded) {
      setLoading(true);
      try {
        const entries = await window.hermesAPI.readDirectory(node.path);
        setChildren(entries);
      } finally {
        setLoading(false);
      }
    }
    setExpanded((value) => !value);
  }

  return (
    <div className="memory-vault-node">
      <button
        type="button"
        className="memory-vault-tree-item"
        style={{ paddingLeft: `${level * 14 + 8}px` }}
        onClick={() => void toggle()}
        title={node.path}
      >
        {node.isDirectory ? (
          <>
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <FolderOpen size={13} />
          </>
        ) : (
          <>
            <span className="memory-vault-tree-spacer" />
            <FileText size={13} />
          </>
        )}
        <span className="memory-vault-tree-name">
          {displayFileName(node.name)}
        </span>
        {loading && <span className="memory-vault-tree-loading">...</span>}
      </button>
      {expanded && node.isDirectory && (
        <div>
          {children.map((child) => (
            <VaultTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Memory({ profile }: { profile?: string }): React.JSX.Element {
  const { t } = useI18n();
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<
    "map" | "vault" | "entries" | "profile" | "providers"
  >("map");
  const [error, setError] = useState("");
  const [memoryProvider, setMemoryProvider] = useState<string | null>(null);
  const [providers, setProviders] = useState<MemoryProviderInfo[]>([]);
  const [providerEnv, setProviderEnv] = useState<Record<string, string>>({});
  const [providerSavedKey, setProviderSavedKey] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [vault, setVault] = useState<ObsidianVaultInfo | null>(null);
  const [vaultRoot, setVaultRoot] = useState<FileNode[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultIndex, setVaultIndex] =
    useState<NeuralVaultIndex>(EMPTY_VAULT_INDEX);
  const [vaultIndexLoading, setVaultIndexLoading] = useState(false);
  const [activeNeuralId, setActiveNeuralId] =
    useState<NeuralClusterId>("notes");
  const [graphMode, setGraphMode] = useState<"cluster" | "graph">("cluster");
  const [graphSearch, setGraphSearch] = useState("");
  const [neuralLayout, setNeuralLayout] = useState<"stacked" | "side">(
    "stacked",
  );
  const [selectedNote, setSelectedNote] = useState<DocumentPreviewData | null>(
    null,
  );
  const [noteEditMode, setNoteEditMode] = useState(false);
  const [noteEditContent, setNoteEditContent] = useState("");
  const [noteOriginalContent, setNoteOriginalContent] = useState("");
  const [noteSaveStatus, setNoteSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [noteError, setNoteError] = useState("");

  // Entry management
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // User profile editing
  const [userContent, setUserContent] = useState("");
  const [userEditing, setUserEditing] = useState(false);
  const [userSaved, setUserSaved] = useState(false);

  const loadVaultRoot = useCallback(async (vaultPath: string | null) => {
    if (!vaultPath) {
      setVaultRoot([]);
      return;
    }
    setVaultLoading(true);
    try {
      const entries = await window.hermesAPI.readDirectory(vaultPath);
      setVaultRoot(entries);
    } finally {
      setVaultLoading(false);
    }
  }, []);

  const loadVaultIndex = useCallback(async (vaultPath: string | null) => {
    if (!vaultPath) {
      setVaultIndex(EMPTY_VAULT_INDEX);
      return;
    }
    setVaultIndexLoading(true);
    try {
      const index = await buildNeuralVaultIndex(vaultPath);
      setVaultIndex(index);
    } catch (err) {
      setVaultIndex(EMPTY_VAULT_INDEX);
      setVaultIndex(EMPTY_VAULT_INDEX);
      console.error(
        err instanceof Error ? err.message : "Unable to index this vault.",
      );
    } finally {
      setVaultIndexLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    const [d, provider, provs, env, vaultInfo] = await Promise.all([
      window.hermesAPI.readMemory(profile),
      window.hermesAPI.getConfig("memory.provider", profile),
      window.hermesAPI.discoverMemoryProviders(profile),
      window.hermesAPI.getEnv(profile),
      window.hermesAPI.getObsidianVault(),
    ]);
    setData(d as MemoryData);
    setUserContent(d.user.content);
    setMemoryProvider(provider);
    setProviders(provs);
    setProviderEnv(env);
    setVault(vaultInfo);
    await loadVaultRoot(vaultInfo.path);
    setLoading(false);
  }, [loadVaultRoot, profile]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!vault?.exists || !vault.path) {
      setVaultIndex(EMPTY_VAULT_INDEX);
      return;
    }
    void loadVaultIndex(vault.path);
  }, [loadVaultIndex, vault?.exists, vault?.path]);

  // ── Auto-sync: watch vault for file changes ──
  useEffect(() => {
    if (!vault?.exists || !vault.path) return;
    const vaultPath = vault.path;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    void window.hermesAPI.watchWorkspace(vaultPath);

    const unsub = window.hermesAPI.onWorkspaceFileChanged((change) => {
      // only re-index on markdown file changes
      if (!/\.(md|markdown)$/i.test(change.name)) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void loadVaultIndex(vaultPath);
      }, 2000);
    });

    return () => {
      unsub();
      if (debounceTimer) clearTimeout(debounceTimer);
      void window.hermesAPI.unwatchWorkspace();
    };
  }, [vault?.exists, vault?.path, loadVaultIndex]);

  useEffect(() => {
    if (
      tab !== "map" ||
      activeNeuralId !== "notes" ||
      selectedNote ||
      vaultIndexLoading ||
      vaultIndex.notes.length === 0
    ) {
      return;
    }

    let cancelled = false;
    const firstNote = vaultIndex.notes[0];
    async function loadInitialPreview(): Promise<void> {
      const preview = await window.hermesAPI.readDocumentPreview(
        firstNote.path,
      );
      if (cancelled) return;
      setSelectedNote(preview);
      setNoteEditMode(false);
      setNoteEditContent(preview.content || "");
      setNoteOriginalContent(preview.content || "");
      setNoteSaveStatus("idle");
      setNoteError("");
    }
    void loadInitialPreview();
    return () => {
      cancelled = true;
    };
  }, [activeNeuralId, selectedNote, tab, vaultIndex.notes, vaultIndexLoading]);

  async function handleAddEntry(): Promise<void> {
    if (!newEntry.trim()) return;
    setError("");
    const result = await window.hermesAPI.addMemoryEntry(
      newEntry.trim(),
      profile,
    );
    if (result.success) {
      setNewEntry("");
      setShowAdd(false);
      await loadData();
    } else {
      setError(result.error || t("memory.addFailed"));
    }
  }

  async function handleSaveEdit(): Promise<void> {
    if (editingIndex === null) return;
    setError("");
    const result = await window.hermesAPI.updateMemoryEntry(
      editingIndex,
      editContent.trim(),
      profile,
    );
    if (result.success) {
      setEditingIndex(null);
      setEditContent("");
      await loadData();
    } else {
      setError(result.error || t("memory.updateFailed"));
    }
  }

  async function handleDeleteEntry(index: number): Promise<void> {
    await window.hermesAPI.removeMemoryEntry(index, profile);
    setConfirmDelete(null);
    await loadData();
  }

  async function handleSaveUserProfile(): Promise<void> {
    setError("");
    const result = await window.hermesAPI.writeUserProfile(
      userContent,
      profile,
    );
    if (result.success) {
      setUserEditing(false);
      setUserSaved(true);
      setTimeout(() => setUserSaved(false), 2000);
      await loadData();
    } else {
      setError(result.error || t("memory.saveFailed"));
    }
  }

  async function handleChooseVault(): Promise<void> {
    const selected = await window.hermesAPI.selectProjectDirectory();
    if (!selected) return;
    const info = await window.hermesAPI.setObsidianVault(selected);
    setVault(info);
    setSelectedNote(null);
    await loadVaultRoot(info.path);
  }

  async function handleVaultFileClick(path: string): Promise<void> {
    const preview = await window.hermesAPI.readDocumentPreview(path);
    setSelectedNote(preview);
    setNoteEditMode(false);
    setNoteEditContent(preview.content || "");
    setNoteOriginalContent(preview.content || "");
    setNoteSaveStatus("idle");
    setNoteError("");
  }

  async function handleSaveVaultNote(): Promise<void> {
    if (!selectedNote || !isEditableDocument(selectedNote)) return;
    setNoteSaveStatus("saving");
    setNoteError("");
    const result = await window.hermesAPI.writeDocumentContent(
      selectedNote.path,
      noteEditContent,
    );
    if (!result.success) {
      setNoteSaveStatus("error");
      setNoteError(result.error || "Save failed.");
      return;
    }

    const preview = await window.hermesAPI.readDocumentPreview(
      result.path || selectedNote.path,
    );
    setSelectedNote(preview);
    setNoteEditContent(preview.content || noteEditContent);
    setNoteOriginalContent(preview.content || noteEditContent);
    setNoteEditMode(false);
    setNoteSaveStatus("saved");
    setTimeout(() => setNoteSaveStatus("idle"), 1800);
  }

  async function handleRevealVault(): Promise<void> {
    if (vault?.path) await window.hermesAPI.revealLocalPath(vault.path);
  }

  async function handleRefreshVaultIndex(): Promise<void> {
    if (!vault?.path) return;
    await Promise.all([loadVaultRoot(vault.path), loadVaultIndex(vault.path)]);
  }

  if (loading || !data) {
    return (
      <div className="settings-container">
        <h1 className="settings-header">{t("memory.title")}</h1>
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  const selectedNoteEditable = isEditableDocument(selectedNote);
  const selectedNoteDirty =
    selectedNoteEditable && noteEditContent !== noteOriginalContent;
  const neuralClusterDefinitions: NeuralClusterDefinition[] = [
    {
      id: "streams",
      label: "Inbox",
      description: "Captures, sparks, voice notes, and unprocessed inputs.",
      keywords: [
        "inbox",
        "capture",
        "captures",
        "spark",
        "sparks",
        "voice",
        "stream",
        "input",
      ],
      icon: <Radio size={18} />,
      x: 18,
      y: 34,
    },
    {
      id: "sync",
      label: "Vault Sync",
      description:
        "Every indexed markdown note in the configured Obsidian vault.",
      keywords: [],
      icon: <Refresh size={18} />,
      x: 38,
      y: 22,
    },
    {
      id: "habits",
      label: "Tasks",
      description: "Tasks, habits, todos, active work, and Kanban material.",
      keywords: [
        "task",
        "tasks",
        "todo",
        "todos",
        "habit",
        "habits",
        "kanban",
        "active task",
      ],
      icon: <CheckCircle2 size={18} />,
      x: 53,
      y: 17,
    },
    {
      id: "projects",
      label: "Projects",
      description: "Client work, project folders, roadmaps, and deliverables.",
      keywords: [
        "project",
        "projects",
        "client",
        "clients",
        "roadmap",
        "deliverable",
        "launch",
        "work",
      ],
      icon: <Folder size={18} />,
      x: 67,
      y: 25,
    },
    {
      id: "contacts",
      label: "People",
      description:
        "Contacts, client profiles, teams, vendors, and people notes.",
      keywords: [
        "people",
        "person",
        "contact",
        "contacts",
        "client",
        "clients",
        "team",
        "vendor",
        "crm",
      ],
      icon: <Users size={18} />,
      x: 83,
      y: 36,
    },
    {
      id: "calendar",
      label: "Calendar",
      description:
        "Dates, daily logs, weekly reviews, meetings, and schedules.",
      keywords: [
        "calendar",
        "schedule",
        "meeting",
        "meetings",
        "event",
        "events",
        "weekly",
        "monthly",
        "review",
      ],
      icon: <Calendar size={18} />,
      x: 82,
      y: 50,
    },
    {
      id: "cortex",
      label: "Knowledge",
      description:
        "Research, indexes, MOCs, reference notes, and second-brain material.",
      keywords: [
        "cortex",
        "knowledge",
        "research",
        "reference",
        "index",
        "moc",
        "wiki",
        "second brain",
        "memory",
      ],
      icon: <Brain size={18} />,
      x: 78,
      y: 62,
    },
    {
      id: "more",
      label: "Unsorted",
      description: "Vault notes that did not match a focused brain area yet.",
      keywords: [],
      icon: <CircleEllipsis size={18} />,
      x: 86,
      y: 78,
    },
    {
      id: "finance",
      label: "Finance",
      description:
        "Money, transactions, invoices, billing, budgets, and tax notes.",
      keywords: [
        "finance",
        "money",
        "transaction",
        "transactions",
        "invoice",
        "invoices",
        "billing",
        "budget",
        "tax",
        "stripe",
        "sales",
      ],
      icon: <DollarSign size={18} />,
      x: 63,
      y: 80,
    },
    {
      id: "daily",
      label: "Daily",
      description:
        "Daily notes, journals, logs, and personal operating rhythm.",
      keywords: [
        "daily",
        "journal",
        "journals",
        "log",
        "logs",
        "today",
        "morning",
        "evening",
      ],
      icon: <Calendar size={18} />,
      x: 45,
      y: 86,
    },
    {
      id: "chat",
      label: "Chat",
      description:
        "Chat sessions, transcripts, messages, and agent conversations.",
      keywords: [
        "chat",
        "chats",
        "conversation",
        "conversations",
        "message",
        "messages",
        "session",
        "sessions",
        "transcript",
      ],
      icon: <MessageSquare size={18} />,
      x: 28,
      y: 73,
    },
    {
      id: "agents",
      label: "Agents",
      description:
        "Agent rosters, assistant profiles, Hermes notes, and automations.",
      keywords: [
        "agent",
        "agents",
        "assistant",
        "assistants",
        "hermes",
        "profile",
        "profiles",
        "round table",
        "automation",
      ],
      icon: <User size={18} />,
      x: 18,
      y: 61,
    },
    {
      id: "notes",
      label: "Notes",
      description: "All indexed markdown notes from the selected vault.",
      keywords: [],
      icon: <FileText size={18} />,
      x: 17,
      y: 47,
    },
  ];
  const specificVaultClusters = neuralClusterDefinitions.filter(
    (cluster) => !["sync", "more", "notes"].includes(cluster.id),
  );
  const unassignedNotes = vaultIndex.notes.filter(
    (note) =>
      !specificVaultClusters.some((cluster) =>
        entryMatchesCluster(note, cluster),
      ),
  );
  const unassignedFolders = vaultIndex.folders.filter(
    (folder) =>
      !specificVaultClusters.some((cluster) =>
        entryMatchesCluster(folder, cluster),
      ),
  );
  const neuralNodes: NeuralCluster[] = neuralClusterDefinitions.map(
    (cluster) => {
      const notes =
        cluster.id === "more"
          ? unassignedNotes
          : vaultIndex.notes.filter((note) =>
              entryMatchesCluster(note, cluster),
            );
      const folders =
        cluster.id === "more"
          ? unassignedFolders
          : vaultIndex.folders.filter((folder) =>
              entryMatchesCluster(folder, cluster),
            );
      const value =
        cluster.id === "sync" || cluster.id === "notes"
          ? vaultIndex.notes.length || vault?.noteCount || 0
          : notes.length || folders.length;
      return { ...cluster, value, notes, folders };
    },
  );
  const activeCluster =
    neuralNodes.find((node) => node.id === activeNeuralId) ||
    neuralNodes[neuralNodes.length - 1];
  const selectedNoteInActiveCluster =
    !!selectedNote &&
    activeCluster.notes.some((note) => note.path === selectedNote.path);
  const neuralPreviewNote =
    graphMode === "graph"
      ? selectedNote
      : selectedNoteInActiveCluster
        ? selectedNote
        : null;

  async function handleNeuralClusterSelect(
    cluster: NeuralCluster,
  ): Promise<void> {
    setActiveNeuralId(cluster.id);
    setTab("map");
    if (cluster.notes.length > 0) {
      await handleVaultFileClick(cluster.notes[0].path);
      return;
    }
    setSelectedNote(null);
    setNoteEditMode(false);
    setNoteEditContent("");
    setNoteOriginalContent("");
    setNoteSaveStatus("idle");
    setNoteError("");
  }

  return (
    <div className="main-80m memory-main">
      <div className="screen-header-80m memory-screen-header">
        <div className="memory-screen-title-lockup">
          <span className="memory-brain-glyph">
            <Brain size={18} />
          </span>
          <div>
            <span className="screen-header-80m-title">
              SECOND BRAIN {vault?.exists ? `// ${vault.name}` : ""}
            </span>
            <p className="memory-subtitle">
              {vault?.path ||
                "Obsidian vault, agent memory, and long-term profile context."}
            </p>
          </div>
        </div>
        <div
          className="memory-vault-actions"
          style={{ display: "flex", gap: "8px", alignItems: "center" }}
        >
          {vault?.path && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => void handleRevealVault()}
            >
              Reveal
            </button>
          )}
          {vault?.path && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                void loadData();
                void handleRefreshVaultIndex();
              }}
              disabled={vaultIndexLoading}
            >
              <Refresh size={13} />
              Reindex Vault
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void handleChooseVault()}
          >
            {vault?.exists ? "Change Vault" : "Choose Vault"}
          </button>
        </div>
      </div>
      <div className="screen-content-80m memory-screen-content">
        <div className="memory-tabs memory-tabs-neural">
          <button
            className={`memory-tab ${tab === "map" ? "active" : ""}`}
            onClick={() => setTab("map")}
          >
            Neural Map
          </button>
          <button
            className={`memory-tab ${tab === "vault" ? "active" : ""}`}
            onClick={() => setTab("vault")}
          >
            Vault Index
            {vault?.exists && (
              <span className="memory-tab-time">{vault.name}</span>
            )}
          </button>
          <button
            className={`memory-tab ${tab === "entries" ? "active" : ""}`}
            onClick={() => setTab("entries")}
          >
            {t("memory.agentMemory")}
            {data.memory.lastModified && (
              <span className="memory-tab-time">
                {timeAgo(data.memory.lastModified)}
              </span>
            )}
          </button>
          <button
            className={`memory-tab ${tab === "profile" ? "active" : ""}`}
            onClick={() => setTab("profile")}
          >
            {t("memory.userProfile")}
            {data.user.lastModified && (
              <span className="memory-tab-time">
                {timeAgo(data.user.lastModified)}
              </span>
            )}
          </button>
          <button
            className={`memory-tab ${tab === "providers" ? "active" : ""}`}
            onClick={() => setTab("providers")}
          >
            {t("memory.providersTitle")}
            {memoryProvider && (
              <span className="memory-tab-time">{memoryProvider}</span>
            )}
          </button>
        </div>

        {error && <div className="memory-error">{error}</div>}

        {tab === "map" && (
          <div
            className={`memory-neural-dashboard memory-neural-layout-${neuralLayout}`}
          >
            <div className="memory-neural-pane-map">
              <div
                className={`memory-neural-stage ${
                  vaultIndexLoading ? "memory-neural-stage-scanning" : ""
                }`}
              >
                <NeuralMap3D
                  nodes={neuralNodes.map((n) => ({
                    id: n.id,
                    label: n.label,
                    value: n.value,
                  }))}
                  activeId={activeNeuralId}
                  onSelect={(id) => {
                    const cluster = neuralNodes.find((n) => n.id === id);
                    if (cluster) void handleNeuralClusterSelect(cluster);
                  }}
                  scanning={vaultIndexLoading}
                  vaultConnected={!!vault?.exists}
                  totalNotes={vaultIndex.notes.length || vault?.noteCount || 0}
                  mode={graphMode}
                  graphNotes={vaultIndex.graphNotes}
                  graphEdges={vaultIndex.graphEdges}
                  graphSearch={graphSearch}
                  onNoteSelect={(path) => void handleVaultFileClick(path)}
                />

                <div className="memory-neural-stage-status">
                  <span>
                    {vault?.exists
                      ? `${formatCompact(
                          vaultIndex.notes.length || vault.noteCount,
                        )} notes · ${formatCompact(vaultIndex.graphEdges.length)} links`
                      : "No vault connected"}
                  </span>
                  <span>
                    {vaultIndexLoading
                      ? "Scanning"
                      : vaultIndex.truncated
                        ? "Partial index"
                        : "Live sync"}
                  </span>
                </div>

                <div className="memory-neural-stage-controls">
                  <button
                    type="button"
                    className={`neural-mode-btn ${graphMode === "graph" ? "active" : ""}`}
                    onClick={() => setGraphMode("graph")}
                    title="Graph view — individual notes with backlink webs"
                  >
                    Graph
                  </button>
                  <button
                    type="button"
                    className={`neural-mode-btn ${graphMode === "cluster" ? "active" : ""}`}
                    onClick={() => setGraphMode("cluster")}
                    title="Cluster view — brain area categories"
                  >
                    Cluster
                  </button>
                  <button
                    type="button"
                    className={`neural-mode-btn ${neuralLayout === "side" ? "active" : ""}`}
                    onClick={() =>
                      setNeuralLayout(
                        neuralLayout === "stacked" ? "side" : "stacked",
                      )
                    }
                    title={
                      neuralLayout === "stacked"
                        ? "Switch to side-by-side layout"
                        : "Switch to stacked layout"
                    }
                  >
                    {neuralLayout === "stacked" ? "⇔" : "⇕"}
                  </button>
                  {graphMode === "graph" && (
                    <input
                      type="text"
                      className="neural-search-input"
                      placeholder="Search notes..."
                      value={graphSearch}
                      onChange={(e) => setGraphSearch(e.target.value)}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="memory-neural-pane-preview">
              <section className="memory-neural-card memory-neural-preview-card">
                <div className="memory-vault-index-header">
                  <span>Live Note Preview</span>
                  {neuralPreviewNote && (
                    <span>{documentKindLabel(neuralPreviewNote)}</span>
                  )}
                </div>
                {neuralPreviewNote ? (
                  <div className="memory-neural-preview">
                    <div className="memory-neural-preview-heading">
                      <DocumentKindIcon note={neuralPreviewNote} />
                      <div>
                        <strong>
                          {displayFileName(neuralPreviewNote.name)}
                        </strong>
                        <span>{displayLocalPath(neuralPreviewNote.path)}</span>
                      </div>
                    </div>
                    {neuralPreviewNote.content ? (
                      <div className="memory-neural-preview-body">
                        {isMarkdownDocument(neuralPreviewNote) ? (
                          <AgentMarkdown>
                            {readableContent(neuralPreviewNote)}
                          </AgentMarkdown>
                        ) : (
                          <pre>{readableContent(neuralPreviewNote)}</pre>
                        )}
                      </div>
                    ) : (
                      <div className="memory-empty memory-neural-empty">
                        {neuralPreviewNote.error || "Preview unavailable."}
                      </div>
                    )}
                    <div className="memory-vault-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          void window.hermesAPI.openLocalPath(
                            neuralPreviewNote.path,
                          )
                        }
                      >
                        Open
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          void window.hermesAPI.revealLocalPath(
                            neuralPreviewNote.path,
                          )
                        }
                      >
                        Reveal
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setTab("vault")}
                      >
                        Read / Edit
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="memory-neural-book">
                    <BookOpen size={38} />
                    <p>
                      Select a brain node to preview the first matching Obsidian
                      note here.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {tab === "vault" && (
          <div className="memory-vault">
            <div className="memory-vault-toolbar">
              <div>
                <div className="memory-vault-kicker">Personal Archive</div>
                <div className="memory-vault-title">
                  {vault?.exists ? vault.name : "No vault selected"}
                </div>
                <div className="memory-vault-path">
                  {vault?.path ||
                    "Choose your Obsidian vault to browse notes here."}
                </div>
              </div>
              <div className="memory-vault-actions">
                {vault?.path && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => void handleRevealVault()}
                  >
                    Reveal
                  </button>
                )}
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void handleChooseVault()}
                >
                  {vault?.exists ? "Change Vault" : "Choose Vault"}
                </button>
              </div>
            </div>

            {!vault?.exists ? (
              <div className="memory-empty">
                <p>Obsidian vault not found.</p>
                <p className="memory-empty-hint">
                  The desktop app will remember the folder you choose.
                </p>
              </div>
            ) : (
              <div className="memory-vault-browser">
                <div className="memory-vault-tree">
                  <div className="memory-vault-index-header">
                    <span>Vault Index</span>
                    <span>
                      {vault.noteCount.toLocaleString()} notes /{" "}
                      {vault.totalFiles.toLocaleString()} files
                    </span>
                  </div>
                  {vaultLoading ? (
                    <div className="memory-vault-loading">Loading vault...</div>
                  ) : (
                    vaultRoot.map((node) => (
                      <VaultTreeNode
                        key={node.path}
                        node={node}
                        level={0}
                        onFileClick={(path) => void handleVaultFileClick(path)}
                      />
                    ))
                  )}
                </div>
                <div className="memory-vault-preview">
                  {selectedNote ? (
                    <article className="memory-vault-article">
                      <header className="memory-vault-preview-header">
                        <div className="memory-vault-preview-heading">
                          <div className="memory-vault-document-icon">
                            <DocumentKindIcon note={selectedNote} />
                          </div>
                          <div>
                            <div className="memory-vault-kicker">
                              {documentKindLabel(selectedNote)} /{" "}
                              {selectedNote.size.toLocaleString()} bytes
                            </div>
                            <div className="memory-vault-preview-title">
                              {displayFileName(selectedNote.name)}
                            </div>
                            <div className="memory-vault-preview-path">
                              {displayLocalPath(selectedNote.path)}
                            </div>
                          </div>
                        </div>
                        <div className="memory-vault-actions">
                          {selectedNoteEditable && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setNoteEditMode((value) => !value);
                                setNoteError("");
                              }}
                            >
                              {noteEditMode ? (
                                <>
                                  <Eye size={13} />
                                  Preview
                                </>
                              ) : (
                                <>
                                  <Edit3 size={13} />
                                  Edit
                                </>
                              )}
                            </button>
                          )}
                          {noteEditMode && selectedNoteEditable && (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setNoteEditContent(noteOriginalContent);
                                  setNoteEditMode(false);
                                  setNoteError("");
                                }}
                                disabled={!selectedNoteDirty}
                              >
                                <X size={13} />
                                Reset
                              </button>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => void handleSaveVaultNote()}
                                disabled={
                                  !selectedNoteDirty ||
                                  noteSaveStatus === "saving"
                                }
                              >
                                <Save size={13} />
                                {noteSaveStatus === "saving"
                                  ? "Saving"
                                  : "Save"}
                              </button>
                            </>
                          )}
                          {!noteEditMode && (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() =>
                                  void window.hermesAPI.openLocalPath(
                                    selectedNote.path,
                                  )
                                }
                              >
                                Open
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() =>
                                  void window.hermesAPI.revealLocalPath(
                                    selectedNote.path,
                                  )
                                }
                              >
                                Reveal
                              </button>
                            </>
                          )}
                        </div>
                      </header>
                      {noteSaveStatus === "saved" && (
                        <div className="memory-vault-save-status">
                          <Check size={13} /> Saved
                        </div>
                      )}
                      {noteError && (
                        <div className="memory-error">{noteError}</div>
                      )}
                      {noteEditMode && selectedNoteEditable ? (
                        <textarea
                          className="memory-vault-editor"
                          value={noteEditContent}
                          onChange={(event) => {
                            setNoteEditContent(event.target.value);
                            setNoteSaveStatus("idle");
                            setNoteError("");
                          }}
                          spellCheck={isMarkdownDocument(selectedNote)}
                        />
                      ) : selectedNote.content ? (
                        <div className="memory-vault-readable">
                          {isMarkdownDocument(selectedNote) ? (
                            <div className="memory-vault-markdown">
                              <AgentMarkdown>
                                {readableContent(selectedNote)}
                              </AgentMarkdown>
                            </div>
                          ) : isJsonDocument(selectedNote) ? (
                            <pre className="memory-vault-json">
                              {readableContent(selectedNote)}
                            </pre>
                          ) : (
                            <pre className="memory-vault-note">
                              {readableContent(selectedNote)}
                            </pre>
                          )}
                        </div>
                      ) : selectedNote.kind === "image" &&
                        selectedNote.fileUrl ? (
                        <img
                          className="memory-vault-image"
                          src={selectedNote.fileUrl}
                          alt={selectedNote.name}
                        />
                      ) : selectedNote.kind === "pdf" &&
                        selectedNote.fileUrl ? (
                        <iframe
                          className="memory-vault-pdf"
                          src={selectedNote.fileUrl}
                          title={selectedNote.name}
                        />
                      ) : (
                        <div className="memory-empty">
                          <p>{selectedNote.error || "Preview unavailable."}</p>
                        </div>
                      )}
                      {selectedNote.truncated && (
                        <div className="memory-vault-footnote">
                          Preview truncated at the desktop safety limit.
                        </div>
                      )}
                    </article>
                  ) : (
                    <div className="memory-empty memory-vault-front-page">
                      <BookOpen size={34} />
                      <p>Second Brain Index</p>
                      <p className="memory-empty-hint">
                        Pick a file from the vault index to read it like a wiki
                        page.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Agent Memory Entries */}
        {tab === "entries" && (
          <div className="memory-entries">
            <div className="memory-entries-header">
              <span className="memory-entries-count">
                {t("memory.entries", { count: data.memory.entries.length })}
              </span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowAdd(!showAdd)}
              >
                <Plus size={13} />
                {t("memory.addMemory")}
              </button>
            </div>

            {showAdd && (
              <div className="memory-entry-form">
                <textarea
                  className="memory-entry-textarea"
                  value={newEntry}
                  onChange={(e) => setNewEntry(e.target.value)}
                  placeholder={t("memory.entriesPlaceholder")}
                  rows={3}
                  autoFocus
                />
                <div className="memory-entry-form-actions">
                  <span className="memory-entry-chars">
                    {newEntry.length} chars
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setShowAdd(false);
                      setNewEntry("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleAddEntry}
                    disabled={!newEntry.trim()}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {data.memory.entries.length === 0 ? (
              <div className="memory-empty">
                <p>{t("memory.noMemoriesYet")}</p>
                <p className="memory-empty-hint">
                  {t("memory.addManuallyHint")}
                </p>
              </div>
            ) : (
              data.memory.entries.map((entry) => (
                <div key={entry.index} className="memory-entry-card">
                  {editingIndex === entry.index ? (
                    <div className="memory-entry-form">
                      <textarea
                        className="memory-entry-textarea"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        autoFocus
                      />
                      <div className="memory-entry-form-actions">
                        <span className="memory-entry-chars">
                          {t("memory.chars", { count: editContent.length })}
                        </span>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditingIndex(null)}
                        >
                          {t("memory.cancel")}
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={handleSaveEdit}
                        >
                          {t("memory.save")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="memory-entry-content">
                        {entry.content}
                      </div>
                      <div className="memory-entry-actions">
                        <button
                          className="btn-ghost memory-entry-btn"
                          onClick={() => {
                            setEditingIndex(entry.index);
                            setEditContent(entry.content);
                          }}
                        >
                          {t("memory.edit")}
                        </button>
                        {confirmDelete === entry.index ? (
                          <span className="memory-entry-confirm">
                            {t("memory.deleteConfirm")}
                            <button
                              className="btn-ghost"
                              style={{ color: "var(--error)" }}
                              onClick={() => handleDeleteEntry(entry.index)}
                            >
                              {t("memory.yes")}
                            </button>
                            <button
                              className="btn-ghost"
                              onClick={() => setConfirmDelete(null)}
                            >
                              {t("memory.no")}
                            </button>
                          </span>
                        ) : (
                          <button
                            className="btn-ghost memory-entry-btn"
                            onClick={() => setConfirmDelete(entry.index)}
                          >
                            <Trash size={13} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* User Profile */}
        {tab === "profile" && (
          <div className="memory-profile">
            <div className="memory-profile-header">
              <span className="memory-profile-hint">
                {t("memory.userProfileHint")}
              </span>
              {userSaved && (
                <span
                  style={{
                    color: "var(--success)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {t("common.saved")}
                </span>
              )}
            </div>
            <textarea
              className="memory-profile-textarea"
              value={userContent}
              onChange={(e) => {
                setUserContent(e.target.value);
                setUserEditing(true);
              }}
              placeholder={t("memory.userProfilePlaceholder")}
              rows={8}
            />
            <div className="memory-profile-footer">
              <span className="memory-entry-chars">
                {t("memory.chars", { count: userContent.length })} /{" "}
                {data.user.charLimit}{" "}
                {t("memory.chars", { count: 1 }).split(" ")[1]}
              </span>
              {userEditing && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveUserProfile}
                >
                  {t("memory.saveProfile")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Memory Providers */}
        {tab === "providers" && (
          <div className="memory-providers">
            <div className="memory-providers-hint">
              {t("memory.providersHint")}
              {memoryProvider ? (
                <span>
                  {" "}
                  {t("memory.active")}: <strong>{memoryProvider}</strong>
                </span>
              ) : (
                <span> {t("memory.providersHintInactive")}</span>
              )}
            </div>

            {providers.length === 0 ? (
              <div className="memory-empty">
                <p>{t("memory.noProvidersFound")}</p>
              </div>
            ) : (
              <div className="memory-providers-grid">
                {providers.map((p) => (
                  <div
                    key={p.name}
                    className={`memory-provider-card ${p.active ? "memory-provider-active" : ""}`}
                  >
                    <div className="memory-provider-header">
                      <div className="memory-provider-name">
                        {p.name}
                        {p.active && (
                          <span className="memory-provider-badge">
                            <Check size={10} /> {t("memory.active")}
                          </span>
                        )}
                      </div>
                      {PROVIDER_URLS[p.name] && (
                        <button
                          className="btn-ghost"
                          style={{ padding: 2, opacity: 0.6 }}
                          onClick={() =>
                            window.hermesAPI.openExternal(PROVIDER_URLS[p.name])
                          }
                          title={t("memory.openProviderWebsite")}
                        >
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                    <div className="memory-provider-desc">
                      {t(p.description)}
                    </div>

                    {/* Env var config fields */}
                    {p.envVars.length > 0 && (
                      <div className="memory-provider-fields">
                        {p.envVars.map((envKey) => (
                          <div key={envKey} className="memory-provider-field">
                            <label className="memory-provider-field-label">
                              {envKey}
                              {providerSavedKey === envKey && (
                                <span
                                  style={{
                                    color: "var(--success)",
                                    fontSize: 10,
                                    marginLeft: 6,
                                  }}
                                >
                                  {t("common.saved")}
                                </span>
                              )}
                            </label>
                            <input
                              className="input"
                              type="password"
                              value={providerEnv[envKey] || ""}
                              onChange={(e) =>
                                setProviderEnv((prev) => ({
                                  ...prev,
                                  [envKey]: e.target.value,
                                }))
                              }
                              onBlur={async () => {
                                await window.hermesAPI.setEnv(
                                  envKey,
                                  providerEnv[envKey] || "",
                                  profile,
                                );
                                setProviderSavedKey(envKey);
                                setTimeout(
                                  () => setProviderSavedKey(null),
                                  2000,
                                );
                              }}
                              placeholder={t("memory.enterEnvKey", {
                                key: envKey,
                              })}
                              style={{ fontSize: 12 }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="memory-provider-actions">
                      {p.active ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={async () => {
                            setActivating(p.name);
                            await window.hermesAPI.setConfig(
                              "memory.provider",
                              "",
                              profile,
                            );
                            setMemoryProvider(null);
                            setProviders((prev) =>
                              prev.map((pr) => ({ ...pr, active: false })),
                            );
                            setActivating(null);
                          }}
                          disabled={activating !== null}
                        >
                          {t("memory.deactivate")}
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={async () => {
                            setActivating(p.name);
                            await window.hermesAPI.setConfig(
                              "memory.provider",
                              p.name,
                              profile,
                            );
                            setMemoryProvider(p.name);
                            setProviders((prev) =>
                              prev.map((pr) => ({
                                ...pr,
                                active: pr.name === p.name,
                              })),
                            );
                            setActivating(null);
                          }}
                          disabled={activating !== null}
                        >
                          {activating === p.name
                            ? t("memory.activating")
                            : t("memory.activate")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Memory;

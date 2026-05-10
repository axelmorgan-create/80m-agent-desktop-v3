import { useState, useEffect, useCallback } from "react";
import { Refresh } from "../../assets/icons";
import { useI18n } from "../../components/useI18n";
import { BookOpen, Brain, Check, Edit3, Eye, Save, X } from "lucide-react";
import AgentMarkdown from "../../components/AgentMarkdown";
import NeuralMap3D from "../../components/80m/NeuralMap3D";
import { MemoryDocumentIcon } from "./MemoryDocumentIcon";
import { MemoryEntriesPanel } from "./MemoryEntriesPanel";
import { MemoryProvidersPanel } from "./MemoryProvidersPanel";
import { MemoryUserProfilePanel } from "./MemoryUserProfilePanel";
import { MemoryVaultTreeNode } from "./MemoryVaultTreeNode";
import { buildNeuralNodes } from "./memoryNeuralModel";
import type {
  DocumentPreviewData,
  FileNode,
  MemoryData,
  MemoryProviderInfo,
  NeuralCluster,
  NeuralClusterId,
  NeuralVaultIndex,
  ObsidianVaultInfo,
} from "./memoryTypes";
import {
  buildNeuralVaultIndex,
  displayFileName,
  displayLocalPath,
  documentKindLabel,
  EMPTY_VAULT_INDEX,
  formatCompact,
  isEditableDocument,
  isJsonDocument,
  isMarkdownDocument,
  readableContent,
  timeAgo,
} from "./memoryUtils";

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
  const neuralNodes = buildNeuralNodes(vaultIndex, vault?.noteCount || 0);
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
                      <MemoryDocumentIcon note={neuralPreviewNote} />
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
                      <MemoryVaultTreeNode
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
                            <MemoryDocumentIcon note={selectedNote} />
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
          <MemoryEntriesPanel
            entries={data.memory.entries}
            showAdd={showAdd}
            newEntry={newEntry}
            editingIndex={editingIndex}
            editContent={editContent}
            confirmDelete={confirmDelete}
            setShowAdd={setShowAdd}
            setNewEntry={setNewEntry}
            setEditingIndex={setEditingIndex}
            setEditContent={setEditContent}
            setConfirmDelete={setConfirmDelete}
            onAddEntry={() => void handleAddEntry()}
            onSaveEdit={() => void handleSaveEdit()}
            onDeleteEntry={(index) => void handleDeleteEntry(index)}
          />
        )}

        {/* User Profile */}
        {tab === "profile" && (
          <MemoryUserProfilePanel
            user={data.user}
            userContent={userContent}
            userEditing={userEditing}
            userSaved={userSaved}
            setUserContent={setUserContent}
            setUserEditing={setUserEditing}
            onSaveUserProfile={() => void handleSaveUserProfile()}
          />
        )}

        {/* Memory Providers */}
        {tab === "providers" && (
          <MemoryProvidersPanel
            profile={profile}
            memoryProvider={memoryProvider}
            providers={providers}
            providerEnv={providerEnv}
            providerSavedKey={providerSavedKey}
            activating={activating}
            setMemoryProvider={setMemoryProvider}
            setProviders={setProviders}
            setProviderEnv={setProviderEnv}
            setProviderSavedKey={setProviderSavedKey}
            setActivating={setActivating}
          />
        )}
      </div>
    </div>
  );
}

export default Memory;

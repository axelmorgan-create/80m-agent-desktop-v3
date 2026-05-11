import { useState, useEffect, useCallback } from "react";
import { useI18n } from "../../components/useI18n";
import { MemoryEntriesPanel } from "./MemoryEntriesPanel";
import { MemoryHeader } from "./MemoryHeader";
import { MemoryNeuralMapPanel } from "./MemoryNeuralMapPanel";
import { MemoryProvidersPanel } from "./MemoryProvidersPanel";
import { MemoryTabs, type MemoryTabId } from "./MemoryTabs";
import { MemoryUserProfilePanel } from "./MemoryUserProfilePanel";
import { MemoryVaultPanel } from "./MemoryVaultPanel";
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
  EMPTY_VAULT_INDEX,
  isEditableDocument,
} from "./memoryUtils";

function Memory({ profile }: { profile?: string }): React.JSX.Element {
  const { t } = useI18n();
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MemoryTabId>("map");
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
      <MemoryHeader
        title={t("memory.title")}
        vault={vault}
        vaultIndexLoading={vaultIndexLoading}
        onChooseVault={() => void handleChooseVault()}
        onRefreshVaultIndex={() => {
          void loadData();
          void handleRefreshVaultIndex();
        }}
        onRevealVault={() => void handleRevealVault()}
      />
      <div className="screen-content-80m memory-screen-content">
        <MemoryTabs
          data={data}
          memoryProvider={memoryProvider}
          tab={tab}
          vault={vault}
          setTab={setTab}
        />

        {error && <div className="memory-error">{error}</div>}

        {tab === "map" && (
          <MemoryNeuralMapPanel
            vault={vault}
            vaultIndex={vaultIndex}
            vaultIndexLoading={vaultIndexLoading}
            neuralNodes={neuralNodes}
            activeNeuralId={activeNeuralId}
            graphMode={graphMode}
            graphSearch={graphSearch}
            neuralLayout={neuralLayout}
            neuralPreviewNote={neuralPreviewNote}
            setGraphMode={setGraphMode}
            setGraphSearch={setGraphSearch}
            setNeuralLayout={setNeuralLayout}
            onClusterSelect={(cluster) =>
              void handleNeuralClusterSelect(cluster)
            }
            onNoteSelect={(path) => void handleVaultFileClick(path)}
            onOpenPath={(path) => void window.hermesAPI.openLocalPath(path)}
            onRevealPath={(path) => void window.hermesAPI.revealLocalPath(path)}
            onShowVault={() => setTab("vault")}
          />
        )}

        {tab === "vault" && (
          <MemoryVaultPanel
            vault={vault}
            vaultRoot={vaultRoot}
            vaultLoading={vaultLoading}
            selectedNote={selectedNote}
            selectedNoteEditable={selectedNoteEditable}
            selectedNoteDirty={selectedNoteDirty}
            noteEditMode={noteEditMode}
            noteEditContent={noteEditContent}
            noteOriginalContent={noteOriginalContent}
            noteSaveStatus={noteSaveStatus}
            noteError={noteError}
            setNoteEditMode={setNoteEditMode}
            setNoteEditContent={setNoteEditContent}
            setNoteSaveStatus={setNoteSaveStatus}
            setNoteError={setNoteError}
            onChooseVault={() => void handleChooseVault()}
            onRevealVault={() => void handleRevealVault()}
            onFileClick={(path) => void handleVaultFileClick(path)}
            onSaveVaultNote={() => void handleSaveVaultNote()}
            onOpenPath={(path) => void window.hermesAPI.openLocalPath(path)}
            onRevealPath={(path) => void window.hermesAPI.revealLocalPath(path)}
          />
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

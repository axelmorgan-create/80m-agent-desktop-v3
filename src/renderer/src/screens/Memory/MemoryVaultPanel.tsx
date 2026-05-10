import type { Dispatch, SetStateAction } from "react";
import { BookOpen, Check, Edit3, Eye, Save, X } from "lucide-react";
import AgentMarkdown from "../../components/AgentMarkdown";
import { MemoryDocumentIcon } from "./MemoryDocumentIcon";
import { MemoryVaultTreeNode } from "./MemoryVaultTreeNode";
import type {
  DocumentPreviewData,
  FileNode,
  ObsidianVaultInfo,
} from "./memoryTypes";
import {
  displayFileName,
  displayLocalPath,
  documentKindLabel,
  isJsonDocument,
  isMarkdownDocument,
  readableContent,
} from "./memoryUtils";

type NoteSaveStatus = "idle" | "saving" | "saved" | "error";

interface MemoryVaultPanelProps {
  vault: ObsidianVaultInfo | null;
  vaultRoot: FileNode[];
  vaultLoading: boolean;
  selectedNote: DocumentPreviewData | null;
  selectedNoteEditable: boolean;
  selectedNoteDirty: boolean;
  noteEditMode: boolean;
  noteEditContent: string;
  noteOriginalContent: string;
  noteSaveStatus: NoteSaveStatus;
  noteError: string;
  setNoteEditMode: Dispatch<SetStateAction<boolean>>;
  setNoteEditContent: Dispatch<SetStateAction<string>>;
  setNoteSaveStatus: Dispatch<SetStateAction<NoteSaveStatus>>;
  setNoteError: Dispatch<SetStateAction<string>>;
  onChooseVault: () => void;
  onRevealVault: () => void;
  onFileClick: (path: string) => void;
  onSaveVaultNote: () => void;
  onOpenPath: (path: string) => void;
  onRevealPath: (path: string) => void;
}

export function MemoryVaultPanel({
  vault,
  vaultRoot,
  vaultLoading,
  selectedNote,
  selectedNoteEditable,
  selectedNoteDirty,
  noteEditMode,
  noteEditContent,
  noteOriginalContent,
  noteSaveStatus,
  noteError,
  setNoteEditMode,
  setNoteEditContent,
  setNoteSaveStatus,
  setNoteError,
  onChooseVault,
  onRevealVault,
  onFileClick,
  onSaveVaultNote,
  onOpenPath,
  onRevealPath,
}: MemoryVaultPanelProps): React.JSX.Element {
  return (
    <div className="memory-vault">
      <div className="memory-vault-toolbar">
        <div>
          <div className="memory-vault-kicker">Personal Archive</div>
          <div className="memory-vault-title">
            {vault?.exists ? vault.name : "No vault selected"}
          </div>
          <div className="memory-vault-path">
            {vault?.path || "Choose your Obsidian vault to browse notes here."}
          </div>
        </div>
        <div className="memory-vault-actions">
          {vault?.path && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onRevealVault}
            >
              Reveal
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={onChooseVault}>
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
                  onFileClick={onFileClick}
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
                          onClick={onSaveVaultNote}
                          disabled={
                            !selectedNoteDirty || noteSaveStatus === "saving"
                          }
                        >
                          <Save size={13} />
                          {noteSaveStatus === "saving" ? "Saving" : "Save"}
                        </button>
                      </>
                    )}
                    {!noteEditMode && (
                      <>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onOpenPath(selectedNote.path)}
                        >
                          Open
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onRevealPath(selectedNote.path)}
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
                {noteError && <div className="memory-error">{noteError}</div>}
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
                ) : selectedNote.kind === "image" && selectedNote.fileUrl ? (
                  <img
                    className="memory-vault-image"
                    src={selectedNote.fileUrl}
                    alt={selectedNote.name}
                  />
                ) : selectedNote.kind === "pdf" && selectedNote.fileUrl ? (
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
                  Pick a file from the vault index to read it like a wiki page.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

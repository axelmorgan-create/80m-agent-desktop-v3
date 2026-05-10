import { Plus, Trash } from "../../assets/icons";
import { useI18n } from "../../components/useI18n";
import type { MemoryData } from "./memoryTypes";

interface MemoryEntriesPanelProps {
  entries: MemoryData["memory"]["entries"];
  showAdd: boolean;
  newEntry: string;
  editingIndex: number | null;
  editContent: string;
  confirmDelete: number | null;
  setShowAdd: (value: boolean) => void;
  setNewEntry: (value: string) => void;
  setEditingIndex: (value: number | null) => void;
  setEditContent: (value: string) => void;
  setConfirmDelete: (value: number | null) => void;
  onAddEntry: () => void;
  onSaveEdit: () => void;
  onDeleteEntry: (index: number) => void;
}

export function MemoryEntriesPanel({
  entries,
  showAdd,
  newEntry,
  editingIndex,
  editContent,
  confirmDelete,
  setShowAdd,
  setNewEntry,
  setEditingIndex,
  setEditContent,
  setConfirmDelete,
  onAddEntry,
  onSaveEdit,
  onDeleteEntry,
}: MemoryEntriesPanelProps): React.JSX.Element {
  const { t } = useI18n();

  return (
    <div className="memory-entries">
      <div className="memory-entries-header">
        <span className="memory-entries-count">
          {t("memory.entries", { count: entries.length })}
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
            <span className="memory-entry-chars">{newEntry.length} chars</span>
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
              onClick={onAddEntry}
              disabled={!newEntry.trim()}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="memory-empty">
          <p>{t("memory.noMemoriesYet")}</p>
          <p className="memory-empty-hint">{t("memory.addManuallyHint")}</p>
        </div>
      ) : (
        entries.map((entry) => (
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
                    onClick={onSaveEdit}
                  >
                    {t("memory.save")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="memory-entry-content">{entry.content}</div>
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
                        onClick={() => onDeleteEntry(entry.index)}
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
  );
}

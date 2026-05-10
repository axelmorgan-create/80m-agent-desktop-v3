import type { Dispatch, SetStateAction } from "react";
import { BookOpen } from "lucide-react";
import AgentMarkdown from "../../components/AgentMarkdown";
import NeuralMap3D from "../../components/80m/NeuralMap3D";
import { MemoryDocumentIcon } from "./MemoryDocumentIcon";
import type {
  DocumentPreviewData,
  NeuralCluster,
  NeuralClusterId,
  NeuralVaultIndex,
  ObsidianVaultInfo,
} from "./memoryTypes";
import {
  displayFileName,
  displayLocalPath,
  documentKindLabel,
  formatCompact,
  isMarkdownDocument,
  readableContent,
} from "./memoryUtils";

type GraphMode = "cluster" | "graph";
type NeuralLayout = "stacked" | "side";

interface MemoryNeuralMapPanelProps {
  vault: ObsidianVaultInfo | null;
  vaultIndex: NeuralVaultIndex;
  vaultIndexLoading: boolean;
  neuralNodes: NeuralCluster[];
  activeNeuralId: NeuralClusterId;
  graphMode: GraphMode;
  graphSearch: string;
  neuralLayout: NeuralLayout;
  neuralPreviewNote: DocumentPreviewData | null;
  setGraphMode: Dispatch<SetStateAction<GraphMode>>;
  setGraphSearch: Dispatch<SetStateAction<string>>;
  setNeuralLayout: Dispatch<SetStateAction<NeuralLayout>>;
  onClusterSelect: (cluster: NeuralCluster) => void;
  onNoteSelect: (path: string) => void;
  onOpenPath: (path: string) => void;
  onRevealPath: (path: string) => void;
  onShowVault: () => void;
}

export function MemoryNeuralMapPanel({
  vault,
  vaultIndex,
  vaultIndexLoading,
  neuralNodes,
  activeNeuralId,
  graphMode,
  graphSearch,
  neuralLayout,
  neuralPreviewNote,
  setGraphMode,
  setGraphSearch,
  setNeuralLayout,
  onClusterSelect,
  onNoteSelect,
  onOpenPath,
  onRevealPath,
  onShowVault,
}: MemoryNeuralMapPanelProps): React.JSX.Element {
  return (
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
              if (cluster) onClusterSelect(cluster);
            }}
            scanning={vaultIndexLoading}
            vaultConnected={!!vault?.exists}
            totalNotes={vaultIndex.notes.length || vault?.noteCount || 0}
            mode={graphMode}
            graphNotes={vaultIndex.graphNotes}
            graphEdges={vaultIndex.graphEdges}
            graphSearch={graphSearch}
            onNoteSelect={onNoteSelect}
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
                setNeuralLayout(neuralLayout === "stacked" ? "side" : "stacked")
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
                  <strong>{displayFileName(neuralPreviewNote.name)}</strong>
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
                  onClick={() => onOpenPath(neuralPreviewNote.path)}
                >
                  Open
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onRevealPath(neuralPreviewNote.path)}
                >
                  Reveal
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={onShowVault}
                >
                  Read / Edit
                </button>
              </div>
            </div>
          ) : (
            <div className="memory-neural-book">
              <BookOpen size={38} />
              <p>
                Select a brain node to preview the first matching Obsidian note
                here.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

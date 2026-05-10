import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, FolderOpen } from "lucide-react";
import type { FileNode } from "./memoryTypes";
import { displayFileName } from "./memoryUtils";

interface VaultTreeNodeProps {
  node: FileNode;
  level: number;
  onFileClick: (path: string) => void;
}

export function MemoryVaultTreeNode({
  node,
  level,
  onFileClick,
}: VaultTreeNodeProps): React.JSX.Element {
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
            <MemoryVaultTreeNode
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

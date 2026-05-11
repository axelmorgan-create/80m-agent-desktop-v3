import { Brain } from "lucide-react";
import type React from "react";
import { Refresh } from "../../assets/icons";
import type { ObsidianVaultInfo } from "./memoryTypes";

interface MemoryHeaderProps {
  title: string;
  vault: ObsidianVaultInfo | null;
  vaultIndexLoading: boolean;
  onChooseVault: () => void;
  onRefreshVaultIndex: () => void;
  onRevealVault: () => void;
}

export function MemoryHeader({
  title,
  vault,
  vaultIndexLoading,
  onChooseVault,
  onRefreshVaultIndex,
  onRevealVault,
}: MemoryHeaderProps): React.JSX.Element {
  return (
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
          <button className="btn btn-secondary btn-sm" onClick={onRevealVault}>
            Reveal
          </button>
        )}
        {vault?.path && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={onRefreshVaultIndex}
            disabled={vaultIndexLoading}
          >
            <Refresh size={13} />
            Reindex Vault
          </button>
        )}
        <button className="btn btn-primary btn-sm" onClick={onChooseVault}>
          {vault?.exists ? "Change Vault" : "Choose Vault"}
        </button>
      </div>
      <span className="sr-only">{title}</span>
    </div>
  );
}

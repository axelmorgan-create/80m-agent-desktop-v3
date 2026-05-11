import type React from "react";
import { useI18n } from "../../components/useI18n";
import type { MemoryData, ObsidianVaultInfo } from "./memoryTypes";
import { timeAgo } from "./memoryUtils";

export type MemoryTabId = "map" | "vault" | "entries" | "profile" | "providers";

interface MemoryTabsProps {
  data: MemoryData;
  memoryProvider: string | null;
  tab: MemoryTabId;
  vault: ObsidianVaultInfo | null;
  setTab: (tab: MemoryTabId) => void;
}

export function MemoryTabs({
  data,
  memoryProvider,
  tab,
  vault,
  setTab,
}: MemoryTabsProps): React.JSX.Element {
  const { t } = useI18n();

  return (
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
        {vault?.exists && <span className="memory-tab-time">{vault.name}</span>}
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
  );
}

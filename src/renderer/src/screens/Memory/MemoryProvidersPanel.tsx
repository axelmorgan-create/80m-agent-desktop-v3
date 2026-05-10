import { Check, ExternalLink } from "lucide-react";
import { useI18n } from "../../components/useI18n";
import type { MemoryProviderInfo } from "./memoryTypes";

const PROVIDER_URLS: Record<string, string> = {
  honcho: "https://app.honcho.dev",
  hindsight: "https://ui.hindsight.vectorize.io",
  mem0: "https://app.mem0.ai",
  retaindb: "https://retaindb.com",
  supermemory: "https://supermemory.ai",
  byterover: "https://app.byterover.dev",
};

interface MemoryProvidersPanelProps {
  profile?: string;
  memoryProvider: string | null;
  providers: MemoryProviderInfo[];
  providerEnv: Record<string, string>;
  providerSavedKey: string | null;
  activating: string | null;
  setMemoryProvider: (value: string | null) => void;
  setProviders: (value: React.SetStateAction<MemoryProviderInfo[]>) => void;
  setProviderEnv: (value: React.SetStateAction<Record<string, string>>) => void;
  setProviderSavedKey: (value: string | null) => void;
  setActivating: (value: string | null) => void;
}

export function MemoryProvidersPanel({
  profile,
  memoryProvider,
  providers,
  providerEnv,
  providerSavedKey,
  activating,
  setMemoryProvider,
  setProviders,
  setProviderEnv,
  setProviderSavedKey,
  setActivating,
}: MemoryProvidersPanelProps): React.JSX.Element {
  const { t } = useI18n();

  return (
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
              <div className="memory-provider-desc">{t(p.description)}</div>

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
                          setTimeout(() => setProviderSavedKey(null), 2000);
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
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import {
  Activity,
  Download,
  ShieldCheck,
  Smartphone,
  User,
  Wifi,
  Info,
  Sparkles,
} from "lucide-react";
import { useProfiles } from "../../hooks/useProfiles";
import { SettingsAboutPanel } from "./SettingsAboutPanel";
import { SettingsAuditPanel } from "./SettingsAuditPanel";
import { SettingsBackupPanel } from "./SettingsBackupPanel";
import { SettingsConnectionPanel } from "./SettingsConnectionPanel";
import { SettingsCuratorPanel } from "./SettingsCuratorPanel";
import { SettingsHealthPanel } from "./SettingsHealthPanel";
import { SettingsMobilePanel } from "./SettingsMobilePanel";
import { SettingsProfilesPanel } from "./SettingsProfilesPanel";
import {
  buildActiveModelPresets,
  modelConfigIssue,
} from "./settingsModelConfig";
import type {
  CredentialPool,
  CuratorCommandResult,
  HermesCapabilities,
  HermesHealth,
  SettingsAudit,
  SettingsAuditActionResult,
  SettingsAuditCard,
  TailscaleMobileStatus,
} from "./settingsTypes";

interface Props {
  onBack: () => void;
  profile?: string;
}

type TabId =
  | "overview"
  | "connection"
  | "mobile"
  | "health"
  | "curator"
  | "profiles"
  | "backup"
  | "about";

const Settings80m: React.FC<Props> = ({ onBack, profile }) => {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [provider, setProvider] = useState("openrouter");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Connection
  const [connMode, setConnMode] = useState<"local" | "remote">("local");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  // Profiles
  const { profiles, refreshProfiles } = useProfiles();
  const [profileName, setProfileName] = useState("");
  const [profileCreateMode, setProfileCreateMode] = useState<
    "clone" | "blank" | "clone-all"
  >("clone");
  const [profileCloneFrom, setProfileCloneFrom] = useState(
    profile || "default",
  );
  const [profileNoAlias, setProfileNoAlias] = useState(false);
  const [profileNoSkills, setProfileNoSkills] = useState(false);
  const [profileCreateResult, setProfileCreateResult] = useState("");
  const [creatingProfile, setCreatingProfile] = useState(false);

  // Backup/Import
  const [backingUp, setBackingUp] = useState(false);
  const [importing, setImporting] = useState(false);
  const [backupResult, setBackupResult] = useState("");
  const [importResult, setImportResult] = useState("");

  // About
  const [hermesVersion, setHermesVersion] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("");
  const [env, setEnv] = useState<Record<string, string>>({});
  const [credentialPool, setCredentialPool] = useState<CredentialPool>({});
  const [health, setHealth] = useState<HermesHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<HermesCapabilities | null>(
    null,
  );
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
  const [audit, setAudit] = useState<SettingsAudit | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditActionBusy, setAuditActionBusy] = useState<string | null>(null);
  const [auditActionOutput, setAuditActionOutput] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState("");
  const [curator, setCurator] = useState<CuratorCommandResult | null>(null);
  const [curatorBusy, setCuratorBusy] = useState<string | null>(null);
  const [curatorSkill, setCuratorSkill] = useState("");
  const [curatorOutput, setCuratorOutput] = useState("");
  const [tailscale, setTailscale] = useState<TailscaleMobileStatus | null>(
    null,
  );
  const [tailscaleBusy, setTailscaleBusy] = useState<
    "enable" | "disable" | "rotate" | null
  >(null);
  const [tailscaleError, setTailscaleError] = useState("");
  const [tailscaleQr, setTailscaleQr] = useState("");

  const activeModelPresets = buildActiveModelPresets(env, credentialPool);

  const refreshHealth = useCallback(async () => {
    if (!window.hermesAPI?.getHermesHealth) return;
    setHealthLoading(true);
    try {
      const next = (await window.hermesAPI.getHermesHealth(
        profile,
      )) as HermesHealth;
      setHealth(next);
    } finally {
      setHealthLoading(false);
    }
  }, [profile]);

  const refreshCapabilities = useCallback(async () => {
    if (!window.hermesAPI?.getHermesCapabilities) return;
    setCapabilitiesLoading(true);
    try {
      const next = (await window.hermesAPI.getHermesCapabilities(
        profile,
      )) as HermesCapabilities;
      setCapabilities(next);
    } finally {
      setCapabilitiesLoading(false);
    }
  }, [profile]);

  const refreshAudit = useCallback(async () => {
    if (!window.hermesAPI?.getSettingsAudit) return;
    setAuditLoading(true);
    try {
      const next = (await window.hermesAPI.getSettingsAudit(
        profile,
      )) as SettingsAudit;
      setAudit(next);
    } finally {
      setAuditLoading(false);
    }
  }, [profile]);

  const runCuratorAction = useCallback(
    async (action: string, skill?: string) => {
      if (!window.hermesAPI?.runHermesCurator) return;
      setCuratorBusy(action);
      setCuratorOutput("");
      try {
        const result = (await window.hermesAPI.runHermesCurator(
          action,
          skill,
          profile,
        )) as CuratorCommandResult;
        setCurator(result);
        setCuratorOutput(result.output || result.error || "");
      } catch (err) {
        setCuratorOutput(err instanceof Error ? err.message : String(err));
      } finally {
        setCuratorBusy(null);
      }
    },
    [profile],
  );

  const refreshTailscale = useCallback(async () => {
    if (!window.hermesAPI?.getTailscaleMobileStatus) return;
    try {
      const status = await window.hermesAPI.getTailscaleMobileStatus();
      setTailscale(status);
      setTailscaleError(status.error || "");
    } catch (err) {
      setTailscaleError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const runTailscaleAction = useCallback(
    async (action: "enable" | "disable" | "rotate") => {
      setTailscaleBusy(action);
      setTailscaleError("");
      try {
        const api = window.hermesAPI;
        if (!api?.enableTailscaleMobileAccess) return;
        const status =
          action === "enable"
            ? await api.enableTailscaleMobileAccess()
            : action === "disable"
              ? await api.disableTailscaleMobileAccess()
              : await api.rotateTailscalePairingToken();
        setTailscale(status);
        setTailscaleError(status.error || "");
      } catch (err) {
        setTailscaleError(err instanceof Error ? err.message : String(err));
      } finally {
        setTailscaleBusy(null);
      }
    },
    [],
  );

  const copyMobileUrl = useCallback(async () => {
    const url = tailscale?.pairUrl || tailscale?.tailnetUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setTailscaleError("Mobile URL copied.");
    } catch (err) {
      setTailscaleError(err instanceof Error ? err.message : String(err));
    }
  }, [tailscale?.pairUrl, tailscale?.tailnetUrl]);

  const openMobileUrl = useCallback(() => {
    const url = tailscale?.pairUrl || tailscale?.tailnetUrl;
    if (!url) return;
    void window.hermesAPI?.openExternal?.(url);
  }, [tailscale?.pairUrl, tailscale?.tailnetUrl]);

  const handleSafeUpgrade = async () => {
    if (!window.hermesAPI?.runSafeHermesUpgrade) return;
    setUpgrading(true);
    setUpgradeResult("");
    try {
      const result = await window.hermesAPI.runSafeHermesUpgrade(profile);
      setUpgradeResult(
        result.success
          ? `Upgrade complete. Backup: ${result.backupPath || "created"}`
          : `Upgrade failed: ${result.error || "Unknown error"}`,
      );
      await Promise.all([refreshCapabilities(), refreshHealth()]);
    } catch (err) {
      setUpgradeResult(err instanceof Error ? err.message : String(err));
    } finally {
      setUpgrading(false);
    }
  };

  const runAuditAction = async (card: SettingsAuditCard) => {
    const actionId = card.action?.id;
    if (!actionId) return;

    const docsActions: Record<string, string> = {
      "tool-gateway-docs":
        "https://hermes-agent.nousresearch.com/docs/user-guide/features/tool-gateway",
      "memory-docs":
        "https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers/",
      "mcp-docs":
        "https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp",
    };
    if (docsActions[actionId]) {
      void window.hermesAPI?.openExternal?.(docsActions[actionId]);
      return;
    }

    if (actionId === "safe-upgrade") {
      await handleSafeUpgrade();
      await refreshAudit();
      return;
    }

    if (!window.hermesAPI?.runSettingsAuditAction) return;
    setAuditActionBusy(actionId);
    setAuditActionOutput("");
    try {
      const result = (await window.hermesAPI.runSettingsAuditAction(
        actionId,
        profile,
      )) as SettingsAuditActionResult;
      setAuditActionOutput(
        result.success
          ? result.output || `${card.action?.label || actionId} complete.`
          : result.error ||
              result.output ||
              `${card.action?.label || actionId} failed.`,
      );
      await Promise.all([
        refreshAudit(),
        refreshHealth(),
        refreshCapabilities(),
      ]);
    } catch (err) {
      setAuditActionOutput(err instanceof Error ? err.message : String(err));
    } finally {
      setAuditActionBusy(null);
    }
  };

  useEffect(() => {
    if (window.hermesAPI) {
      // Load model config
      window.hermesAPI.getModelConfig?.(profile).then(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cfg: any) => {
          if (cfg) {
            setProvider(cfg.provider || "openrouter");
            setModel(cfg.model || "");
            setBaseUrl(cfg.baseUrl || "");
          }
          setLoading(false);
        },
        () => setLoading(false),
      );

      // Load connection config
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.hermesAPI.getConnectionConfig?.().then((conn: any) => {
        if (conn) {
          setConnMode(conn.mode || "local");
          setRemoteUrl(conn.remoteUrl || "");
          setApiKey(conn.apiKey || "");
        }
      });

      window.hermesAPI.getEnv?.(profile).then((values) => {
        setEnv(values || {});
      });

      window.hermesAPI.getCredentialPool?.().then((pool) => {
        setCredentialPool((pool || {}) as CredentialPool);
      });

      void refreshHealth();
      void refreshCapabilities();
      void refreshAudit();
      void refreshTailscale();
      void runCuratorAction("status");

      // Load versions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.hermesAPI.getHermesVersion?.().then((v: any) => {
        setHermesVersion(v || null);
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.hermesAPI.getAppVersion?.().then((v: any) => {
        setAppVersion(v || "");
      });
    } else {
      setLoading(false);
    }
  }, [
    profile,
    refreshHealth,
    refreshCapabilities,
    refreshAudit,
    refreshTailscale,
    runCuratorAction,
  ]);

  useEffect(() => {
    setProfileCloneFrom(profile || "default");
  }, [profile]);

  useEffect(() => {
    const url = tailscale?.pairUrl || tailscale?.tailnetUrl;
    if (!url) {
      setTailscaleQr("");
      return;
    }

    let active = true;
    QRCode.toDataURL(url, {
      width: 220,
      margin: 1,
      color: { dark: "#111611", light: "#f4fff7" },
    })
      .then((dataUrl) => {
        if (active) setTailscaleQr(dataUrl);
      })
      .catch(() => {
        if (active) setTailscaleQr("");
      });

    return () => {
      active = false;
    };
  }, [tailscale?.pairUrl, tailscale?.tailnetUrl]);

  const handleSave = async () => {
    if (window.hermesAPI) {
      try {
        const issue = modelConfigIssue(
          provider,
          model,
          baseUrl,
          env,
          credentialPool,
        );
        if (issue) {
          setModelError(issue);
          return;
        }
        setModelError(null);
        await window.hermesAPI.setModelConfig(
          provider,
          model,
          baseUrl,
          profile,
        );
        await window.hermesAPI.setConnectionConfig(connMode, remoteUrl, apiKey);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (_) {}
    }
  };

  const handleQuickModelSelect = async (m: {
    provider: string;
    model: string;
    baseUrl: string;
  }) => {
    setProvider(m.provider);
    setModel(m.model);
    setBaseUrl(m.baseUrl || "");
    if (window.hermesAPI) {
      try {
        const issue = modelConfigIssue(
          m.provider,
          m.model,
          m.baseUrl || "",
          env,
          credentialPool,
        );
        if (issue) {
          setModelError(issue);
          return;
        }
        setModelError(null);
        await window.hermesAPI.setModelConfig(
          m.provider,
          m.model,
          m.baseUrl || "",
          profile,
        );
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (_) {}
    }
  };

  const handleCreateProfile = async () => {
    if (!profileName.trim()) return;
    setCreatingProfile(true);
    setProfileCreateResult("");
    try {
      const normalizedName = profileName.trim().toLowerCase();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await window.hermesAPI.createProfile(normalizedName, {
        mode: profileCreateMode,
        cloneFrom:
          profileCreateMode === "blank"
            ? undefined
            : profileCloneFrom || profile || "default",
        noAlias: profileNoAlias,
        noSkills: profileNoSkills,
      });
      if (!result?.success) {
        setProfileCreateResult(result?.error || "Profile create failed.");
      } else {
        setProfileName("");
        setProfileCreateResult(
          `Created ${result.profile?.name || result.name || normalizedName}.`,
        );
        await refreshProfiles(false);
        await refreshAudit();
      }
    } catch (err) {
      setProfileCreateResult(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingProfile(false);
    }
  };

  const handleDeleteProfile = async (name: string) => {
    try {
      await window.hermesAPI.deleteProfile(name);
      await refreshProfiles(false);
      await refreshAudit();
    } catch (_) {}
  };

  const handleSetActiveProfile = async (name: string) => {
    try {
      await window.hermesAPI.setActiveProfile(name);
      await refreshProfiles(false);
      await refreshAudit();
    } catch (_) {}
  };

  const handleBackup = async () => {
    setBackingUp(true);
    setBackupResult("");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await window.hermesAPI.runHermesBackup(
        profile || "default",
      );
      setBackupResult(
        result?.success
          ? `Backup saved for ${profile || "default"}: ${result.path || "Success"}`
          : `Error: ${result?.error || "Unknown error"}`,
      );
      await refreshAudit();
    } catch {
      setBackupResult("Backup failed");
    }
    setBackingUp(false);
  };

  const handleImport = async () => {
    setImporting(true);
    setImportResult("");
    try {
      const archivePath = await window.hermesAPI.selectHermesImportArchive?.();
      if (!archivePath) {
        setImportResult("Import canceled.");
        setImporting(false);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await window.hermesAPI.runHermesImport(
        archivePath,
        profile || "default",
      );
      setImportResult(
        result?.success
          ? `Import complete for ${profile || "default"}`
          : `Error: ${result?.error || "Unknown error"}`,
      );
      await refreshAudit();
    } catch {
      setImportResult("Import failed");
    }
    setImporting(false);
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <Activity size={14} /> },
    { id: "connection", label: "Connection", icon: <Wifi size={14} /> },
    { id: "mobile", label: "Mobile", icon: <Smartphone size={14} /> },
    { id: "health", label: "Health", icon: <ShieldCheck size={14} /> },
    { id: "curator", label: "Curator", icon: <Sparkles size={14} /> },
    { id: "profiles", label: "Profiles", icon: <User size={14} /> },
    { id: "backup", label: "Backup", icon: <Download size={14} /> },
    { id: "about", label: "About", icon: <Info size={14} /> },
  ];

  if (loading) {
    return (
      <div className="main-80m">
        <div className="chat-header-80m">
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "#4ade80",
              cursor: "pointer",
              fontFamily: "'Fira Code', monospace",
              fontSize: "12px",
            }}
          >
            ← Back
          </button>
          <span className="chat-header-80m-title">SETTINGS</span>
          <span />
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Fira Code', monospace",
            color: "#e8e8e8",
            fontSize: "12px",
          }}
        >
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="main-80m">
      <div className="chat-header-80m">
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "#4ade80",
            cursor: "pointer",
            fontFamily: "'Fira Code', monospace",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          ← Back
        </button>
        <span className="chat-header-80m-title">SETTINGS</span>
        <span />
      </div>

      <div className="settings-80m-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-80m-tab${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="settings-80m-content">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <SettingsAuditPanel
              audit={audit}
              profile={profile}
              auditLoading={auditLoading}
              healthLoading={healthLoading}
              capabilitiesLoading={capabilitiesLoading}
              auditActionBusy={auditActionBusy}
              auditActionOutput={auditActionOutput}
              onRefresh={() =>
                void Promise.all([
                  refreshAudit(),
                  refreshHealth(),
                  refreshCapabilities(),
                ])
              }
              onRunAuditAction={(card) => void runAuditAction(card)}
            />
          )}

          {activeTab === "connection" && (
            <SettingsConnectionPanel
              connMode={connMode}
              setConnMode={setConnMode}
              remoteUrl={remoteUrl}
              setRemoteUrl={setRemoteUrl}
              apiKey={apiKey}
              setApiKey={setApiKey}
              activeModelPresets={activeModelPresets}
              provider={provider}
              setProvider={setProvider}
              model={model}
              setModel={setModel}
              baseUrl={baseUrl}
              setBaseUrl={setBaseUrl}
              modelError={modelError}
              setModelError={setModelError}
              saved={saved}
              onQuickModelSelect={(modelPreset) =>
                void handleQuickModelSelect(modelPreset)
              }
              onSave={() => void handleSave()}
            />
          )}

          {activeTab === "mobile" && (
            <SettingsMobilePanel
              tailscale={tailscale}
              tailscaleBusy={tailscaleBusy}
              tailscaleError={tailscaleError}
              tailscaleQr={tailscaleQr}
              onRefresh={() => void refreshTailscale()}
              onRunAction={(action) => void runTailscaleAction(action)}
              onCopyMobileUrl={() => void copyMobileUrl()}
              onOpenMobileUrl={openMobileUrl}
            />
          )}

          {activeTab === "health" && (
            <SettingsHealthPanel
              health={health}
              healthLoading={healthLoading}
              capabilities={capabilities}
              capabilitiesLoading={capabilitiesLoading}
              upgrading={upgrading}
              upgradeResult={upgradeResult}
              onRefresh={() => {
                void refreshHealth();
                void refreshCapabilities();
              }}
              onSafeUpgrade={() => void handleSafeUpgrade()}
            />
          )}

          {activeTab === "curator" && (
            <SettingsCuratorPanel
              capabilities={capabilities}
              curator={curator}
              curatorBusy={curatorBusy}
              curatorSkill={curatorSkill}
              setCuratorSkill={setCuratorSkill}
              curatorOutput={curatorOutput}
              onRunCuratorAction={(action, skill) =>
                void runCuratorAction(action, skill)
              }
            />
          )}

          {activeTab === "profiles" && (
            <SettingsProfilesPanel
              profiles={profiles}
              profileName={profileName}
              setProfileName={setProfileName}
              profileCreateMode={profileCreateMode}
              setProfileCreateMode={setProfileCreateMode}
              profileCloneFrom={profileCloneFrom}
              setProfileCloneFrom={setProfileCloneFrom}
              profileNoAlias={profileNoAlias}
              setProfileNoAlias={setProfileNoAlias}
              profileNoSkills={profileNoSkills}
              setProfileNoSkills={setProfileNoSkills}
              profileCreateResult={profileCreateResult}
              creatingProfile={creatingProfile}
              onCreateProfile={() => void handleCreateProfile()}
              onDeleteProfile={(name) => void handleDeleteProfile(name)}
              onSetActiveProfile={(name) => void handleSetActiveProfile(name)}
            />
          )}

          {activeTab === "backup" && (
            <SettingsBackupPanel
              backingUp={backingUp}
              importing={importing}
              backupResult={backupResult}
              importResult={importResult}
              onBackup={() => void handleBackup()}
              onImport={() => void handleImport()}
            />
          )}

          {activeTab === "about" && (
            <SettingsAboutPanel
              appVersion={appVersion}
              hermesVersion={hermesVersion}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Settings80m;

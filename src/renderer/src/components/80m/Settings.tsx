import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  Download,
  ExternalLink,
  RefreshCw,
  Power,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Upload,
  User,
  Wifi,
  WifiOff,
  Info,
  Sparkles,
  Terminal,
  Wrench,
} from "lucide-react";
import Animated80MLogo from "../Animated80MLogo";
import { useProfiles } from "../../hooks/useProfiles";
import {
  buildActiveModelPresets,
  modelConfigIssue,
  PROVIDER_CHOICES,
  settingsChoiceButtonStyle,
} from "./settingsModelConfig";
import type {
  CredentialPool,
  CuratorCommandResult,
  HermesCapabilities,
  HermesHealth,
  SettingsAudit,
  SettingsAuditActionResult,
  SettingsAuditBucket,
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

  const auditBucketMeta: Record<
    SettingsAuditBucket,
    { title: string; icon: React.ReactNode }
  > = {
    needsAttention: {
      title: "Needs Attention",
      icon: <AlertTriangle size={15} />,
    },
    behindUpstream: {
      title: "Behind Upstream",
      icon: <Clock3 size={15} />,
    },
    ready: {
      title: "Ready",
      icon: <CheckCircle2 size={15} />,
    },
    optional: {
      title: "Optional Setup",
      icon: <Wrench size={15} />,
    },
    planGated: {
      title: "Plan-Gated",
      icon: <ShieldCheck size={15} />,
    },
  };

  const auditBucketOrder: SettingsAuditBucket[] = [
    "needsAttention",
    "behindUpstream",
    "ready",
    "optional",
    "planGated",
  ];

  const auditCategoryIcon = (category: string) => {
    const lower = category.toLowerCase();
    if (lower.includes("memory")) return <Database size={14} />;
    if (lower.includes("api") || lower.includes("runtime")) {
      return <Terminal size={14} />;
    }
    if (lower.includes("tool") || lower.includes("provider")) {
      return <Wrench size={14} />;
    }
    return <Activity size={14} />;
  };

  const renderAuditCard = (card: SettingsAuditCard) => (
    <div
      key={card.id}
      className={`settings-80m-audit-card settings-80m-audit-card-${card.severity}`}
    >
      <div className="settings-80m-audit-card-top">
        <span className="settings-80m-audit-category">
          {auditCategoryIcon(card.category)}
          {card.category}
        </span>
        <span className={`settings-80m-audit-severity ${card.severity}`}>
          {card.severity}
        </span>
      </div>
      <div className="settings-80m-audit-title">{card.title}</div>
      <p className="settings-80m-audit-summary">{card.summary}</p>
      <div className="settings-80m-audit-meta">
        <span>{card.source}</span>
        {card.commandPreview && <code>{card.commandPreview}</code>}
      </div>
      <div className="settings-80m-audit-actions">
        {card.action && (
          <button
            className="settings-80m-profile-btn"
            onClick={() => void runAuditAction(card)}
            disabled={Boolean(auditActionBusy)}
          >
            {auditActionBusy === card.action.id ? "Running" : card.action.label}
          </button>
        )}
        {card.docsUrl && (
          <button
            className="settings-80m-profile-btn"
            onClick={() => void window.hermesAPI?.openExternal?.(card.docsUrl!)}
          >
            <ExternalLink size={12} />
            Docs
          </button>
        )}
      </div>
    </div>
  );

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
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="settings-80m-section settings-80m-overview"
            >
              <div className="settings-80m-overview-header">
                <div>
                  <label className="settings-80m-label">
                    Runtime Command Center
                  </label>
                  <p>
                    Profile {audit?.profile || profile || "default"} ·{" "}
                    {audit
                      ? new Date(audit.createdAt).toLocaleTimeString()
                      : "waiting for audit"}
                  </p>
                </div>
                <button
                  onClick={() =>
                    void Promise.all([
                      refreshAudit(),
                      refreshHealth(),
                      refreshCapabilities(),
                    ])
                  }
                  disabled={
                    auditLoading || healthLoading || capabilitiesLoading
                  }
                  className="settings-80m-save-btn"
                >
                  <RefreshCw size={13} />
                  {auditLoading ? "REFRESHING" : "REFRESH AUDIT"}
                </button>
              </div>

              <div className="settings-80m-audit-scoreboard">
                <div>
                  <span>{audit?.summary.needsAttention ?? 0}</span>
                  <p>Needs Attention</p>
                </div>
                <div>
                  <span>{audit?.summary.behindUpstream ?? 0}</span>
                  <p>Behind Upstream</p>
                </div>
                <div>
                  <span>{audit?.summary.ready ?? 0}</span>
                  <p>Ready</p>
                </div>
                <div>
                  <span>{audit?.summary.optional ?? 0}</span>
                  <p>Optional</p>
                </div>
                <div>
                  <span>{audit?.summary.planGated ?? 0}</span>
                  <p>Plan-Gated</p>
                </div>
              </div>

              {auditActionOutput && (
                <pre className="settings-80m-log-block">
                  {auditActionOutput}
                </pre>
              )}

              {audit ? (
                <div className="settings-80m-audit-groups">
                  {auditBucketOrder.map((bucket) => {
                    const cards = audit.buckets[bucket] || [];
                    if (cards.length === 0) return null;
                    const meta = auditBucketMeta[bucket];
                    return (
                      <section
                        key={bucket}
                        className="settings-80m-audit-group"
                      >
                        <div className="settings-80m-audit-group-title">
                          {meta.icon}
                          <span>{meta.title}</span>
                          <strong>{cards.length}</strong>
                        </div>
                        <div className="settings-80m-audit-card-grid">
                          {cards.map(renderAuditCard)}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="settings-80m-result">
                  {auditLoading
                    ? "Auditing Hermes runtime..."
                    : "No audit loaded yet."}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "connection" && (
            <motion.div
              key="connection"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="settings-80m-section"
            >
              <div className="settings-80m-field">
                <label className="settings-80m-label">Mode</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setConnMode("local")}
                    style={settingsChoiceButtonStyle(connMode === "local")}
                  >
                    <Wifi size={12} /> Local
                  </button>
                  <button
                    onClick={() => setConnMode("remote")}
                    style={settingsChoiceButtonStyle(connMode === "remote")}
                  >
                    <WifiOff size={12} /> Remote
                  </button>
                </div>
              </div>

              {connMode === "remote" && (
                <>
                  <div className="settings-80m-field">
                    <label className="settings-80m-label">Remote URL</label>
                    <input
                      type="text"
                      value={remoteUrl}
                      onChange={(e) => setRemoteUrl(e.target.value)}
                      placeholder="https://hermes.example.com"
                      className="settings-80m-input"
                    />
                  </div>
                  <div className="settings-80m-field">
                    <label className="settings-80m-label">API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="settings-80m-input"
                    />
                  </div>
                </>
              )}

              <div className="settings-80m-divider" />

              <div className="settings-80m-field">
                <label className="settings-80m-label">Active Model</label>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                    marginBottom: "16px",
                  }}
                >
                  {activeModelPresets.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleQuickModelSelect(m)}
                      style={settingsChoiceButtonStyle(
                        provider === m.provider && model === m.model,
                      )}
                    >
                      {m.name || m.model}
                    </button>
                  ))}
                </div>

                <div className="settings-80m-divider" />
                <label
                  className="settings-80m-label"
                  style={{ marginTop: "16px" }}
                >
                  Custom Model Override
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {PROVIDER_CHOICES.map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setProvider(p);
                        if (p === "minimax-oauth") {
                          setModel("MiniMax-M2.7");
                          setBaseUrl("https://api.minimax.io/anthropic");
                        }
                        setModelError(null);
                      }}
                      style={settingsChoiceButtonStyle(provider === p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-80m-field">
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. openai/gpt-5.5 or codex"
                  className="settings-80m-input"
                />
                {modelError && (
                  <div
                    style={{
                      color: "#ef4444",
                      fontFamily: "'Fira Code', monospace",
                      fontSize: "11px",
                      marginTop: "8px",
                    }}
                  >
                    {modelError}
                  </div>
                )}
              </div>

              <div className="settings-80m-field">
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="Base URL (Optional)"
                  className="settings-80m-input"
                />
              </div>

              <button onClick={handleSave} className="settings-80m-save-btn">
                {saved ? "SAVED ✓" : "SAVE CONFIG"}
              </button>
            </motion.div>
          )}

          {activeTab === "mobile" && (
            <motion.div
              key="mobile"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="settings-80m-section"
            >
              <div className="settings-80m-health-header">
                <label className="settings-80m-label">
                  Tailscale Mobile Access
                </label>
                <button
                  type="button"
                  className="settings-80m-profile-btn"
                  onClick={() => void refreshTailscale()}
                  disabled={Boolean(tailscaleBusy)}
                >
                  <RefreshCw size={13} />
                  Refresh
                </button>
              </div>

              <div className="settings-80m-health-grid">
                <div className="settings-80m-health-card">
                  <span className="settings-80m-health-title">
                    Tailscale CLI
                  </span>
                  <span
                    className={`settings-80m-health-pill ${
                      tailscale?.installed && tailscale.daemonRunning
                        ? "ok"
                        : "bad"
                    }`}
                  >
                    {tailscale?.installed
                      ? tailscale.daemonRunning
                        ? "ready"
                        : "daemon off"
                      : "missing"}
                  </span>
                  <p>{tailscale?.version || "No CLI version reported"}</p>
                  <p>{tailscale?.backendState || "unknown state"}</p>
                </div>

                <div className="settings-80m-health-card">
                  <span className="settings-80m-health-title">Tailnet</span>
                  <span
                    className={`settings-80m-health-pill ${
                      tailscale?.online ? "ok" : "bad"
                    }`}
                  >
                    {tailscale?.online ? "online" : "offline"}
                  </span>
                  <p>{tailscale?.dnsName || "MagicDNS not reported"}</p>
                  <p>
                    {(tailscale?.tailscaleIps || []).join(", ") ||
                      "No tailnet IP"}
                  </p>
                </div>

                <div className="settings-80m-health-card">
                  <span className="settings-80m-health-title">Mobile PWA</span>
                  <span
                    className={`settings-80m-health-pill ${
                      tailscale?.mobileServerRunning ? "ok" : "bad"
                    }`}
                  >
                    {tailscale?.mobileServerRunning ? "running" : "stopped"}
                  </span>
                  <p>Local port: {tailscale?.mobileServerPort || 8780}</p>
                  <p>
                    Pairing token: {tailscale?.pairingToken ? "set" : "new"}
                  </p>
                </div>

                <div className="settings-80m-health-card">
                  <span className="settings-80m-health-title">
                    Private Serve
                  </span>
                  <span
                    className={`settings-80m-health-pill ${
                      tailscale?.serveEnabled ? "ok" : "bad"
                    }`}
                  >
                    {tailscale?.serveEnabled ? "enabled" : "off"}
                  </span>
                  <p>No Funnel</p>
                  <p>{tailscale?.serveTarget || "localhost:8780"}</p>
                </div>
              </div>

              <div className="settings-80m-divider" />

              <div className="settings-80m-mobile-pairing">
                <div className="settings-80m-mobile-url-card">
                  <label className="settings-80m-label">Pairing URL</label>
                  <div className="settings-80m-mobile-url-row">
                    <input
                      readOnly
                      className="settings-80m-input"
                      value={tailscale?.pairUrl || tailscale?.tailnetUrl || ""}
                      placeholder="Enable Tailscale Mobile Access"
                    />
                    <button
                      type="button"
                      className="settings-80m-profile-btn"
                      onClick={() => void copyMobileUrl()}
                      disabled={!(tailscale?.pairUrl || tailscale?.tailnetUrl)}
                      title="Copy"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      className="settings-80m-profile-btn"
                      onClick={openMobileUrl}
                      disabled={!(tailscale?.pairUrl || tailscale?.tailnetUrl)}
                      title="Open"
                    >
                      <ExternalLink size={13} />
                    </button>
                  </div>
                  <div className="settings-80m-action-grid">
                    <button
                      type="button"
                      className="settings-80m-save-btn"
                      onClick={() => void runTailscaleAction("enable")}
                      disabled={
                        Boolean(tailscaleBusy) || tailscale?.installed === false
                      }
                    >
                      <Power size={13} />
                      {tailscaleBusy === "enable" ? "Starting" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className="settings-80m-profile-btn"
                      onClick={() => void runTailscaleAction("disable")}
                      disabled={Boolean(tailscaleBusy)}
                    >
                      <Power size={13} />
                      {tailscaleBusy === "disable" ? "Stopping" : "Disable"}
                    </button>
                    <button
                      type="button"
                      className="settings-80m-profile-btn"
                      onClick={() => void runTailscaleAction("rotate")}
                      disabled={Boolean(tailscaleBusy)}
                    >
                      <RotateCcw size={13} />
                      {tailscaleBusy === "rotate" ? "Rotating" : "Rotate"}
                    </button>
                  </div>
                </div>

                <div className="settings-80m-qr-card">
                  {tailscaleQr ? (
                    <img src={tailscaleQr} alt="80M mobile pairing QR code" />
                  ) : (
                    <QrCode size={64} />
                  )}
                  <span>
                    <ShieldCheck size={13} />
                    Tailnet only
                  </span>
                </div>
              </div>

              {tailscaleError && (
                <div
                  className={`settings-80m-result ${
                    tailscaleError.includes("copied") ? "success" : "error"
                  }`}
                >
                  {tailscaleError}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "health" && (
            <motion.div
              key="health"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="settings-80m-section"
            >
              <div className="settings-80m-health-header">
                <label className="settings-80m-label">80M Health</label>
                <button
                  type="button"
                  className="settings-80m-profile-btn"
                  onClick={() => {
                    void refreshHealth();
                    void refreshCapabilities();
                  }}
                  disabled={healthLoading || capabilitiesLoading}
                >
                  <RefreshCw size={13} />
                  {healthLoading || capabilitiesLoading
                    ? "Checking"
                    : "Refresh"}
                </button>
              </div>

              {health ? (
                <div className="settings-80m-health-grid">
                  <div className="settings-80m-health-card">
                    <span className="settings-80m-health-title">Install</span>
                    <span
                      className={`settings-80m-health-pill ${health.install.installed && health.install.verified ? "ok" : "bad"}`}
                    >
                      {health.install.installed && health.install.verified
                        ? "Ready"
                        : "Needs attention"}
                    </span>
                    <p>
                      Config: {health.install.configured ? "found" : "missing"}
                    </p>
                    <p>
                      Provider key:{" "}
                      {health.install.hasApiKey ? "found" : "missing"}
                    </p>
                  </div>

                  <div className="settings-80m-health-card">
                    <span className="settings-80m-health-title">Gateway</span>
                    <span
                      className={`settings-80m-health-pill ${health.gateway.running && health.gateway.apiOk ? "ok" : "bad"}`}
                    >
                      {health.gateway.apiOk ? "API online" : "API offline"}
                    </span>
                    <p>{health.gateway.apiUrl}</p>
                    <p>
                      HTTP: {health.gateway.apiStatus || "none"}
                      {health.gateway.apiError
                        ? ` / ${health.gateway.apiError}`
                        : ""}
                    </p>
                    <p>
                      Local API key:{" "}
                      {health.gateway.hasApiServerKey ? "present" : "missing"}
                    </p>
                  </div>

                  <div className="settings-80m-health-card">
                    <span className="settings-80m-health-title">Model</span>
                    <span className="settings-80m-health-pill ok">
                      {health.model.provider || "auto"}
                    </span>
                    <p>{health.model.model || "No model configured"}</p>
                    <p>{health.model.baseUrl || "Default base URL"}</p>
                  </div>

                  <div className="settings-80m-health-card">
                    <span className="settings-80m-health-title">
                      Credentials
                    </span>
                    <span className="settings-80m-health-pill ok">
                      {health.credentialProviders.length} pools
                    </span>
                    <p>
                      Env keys:{" "}
                      {Object.entries(health.env)
                        .filter(([, present]) => present)
                        .map(([key]) => key.replace(/^has/, ""))
                        .join(", ") || "none detected"}
                    </p>
                    <p>
                      Pools:{" "}
                      {health.credentialProviders
                        .map((entry) => `${entry.provider} (${entry.count})`)
                        .join(", ") || "none detected"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="settings-80m-health-empty">
                  Health data is not available yet.
                </p>
              )}

              {capabilities && (
                <>
                  <div className="settings-80m-divider" />
                  <div className="settings-80m-health-grid">
                    <div className="settings-80m-health-card">
                      <span className="settings-80m-health-title">
                        Runtime Version
                      </span>
                      <span
                        className={`settings-80m-health-pill ${
                          capabilities.isAtLeastV12 ? "ok" : "bad"
                        }`}
                      >
                        {capabilities.semver || "unknown"}
                      </span>
                      <p>
                        v0.12 features:{" "}
                        {capabilities.isAtLeastV12
                          ? "enabled"
                          : "upgrade gated"}
                      </p>
                      <p>
                        Update:{" "}
                        {capabilities.updateAvailable
                          ? "available"
                          : "not reported"}
                      </p>
                      <button
                        type="button"
                        className="settings-80m-profile-btn"
                        onClick={() => void handleSafeUpgrade()}
                        disabled={upgrading}
                      >
                        {upgrading ? "Upgrading" : "Backup + Upgrade"}
                      </button>
                      {upgradeResult && (
                        <div
                          className={`settings-80m-result ${
                            upgradeResult.startsWith("Upgrade failed")
                              ? "error"
                              : "success"
                          }`}
                        >
                          {upgradeResult}
                        </div>
                      )}
                    </div>

                    <div className="settings-80m-health-card">
                      <span className="settings-80m-health-title">
                        API Surface
                      </span>
                      <span
                        className={`settings-80m-health-pill ${
                          capabilities.api.ok ? "ok" : "bad"
                        }`}
                      >
                        {capabilities.api.ok ? "online" : "offline"}
                      </span>
                      <p>{capabilities.api.url}</p>
                      <p>
                        Models:{" "}
                        {capabilities.api.models.join(", ") || "none reported"}
                      </p>
                    </div>

                    <div className="settings-80m-health-card">
                      <span className="settings-80m-health-title">
                        Runs Runtime
                      </span>
                      <span
                        className={`settings-80m-health-pill ${
                          capabilities.supports.runs ? "ok" : "bad"
                        }`}
                      >
                        {capabilities.supports.runs ? "ready" : "unavailable"}
                      </span>
                      <p>
                        Responses:{" "}
                        {capabilities.supports.responses ? "yes" : "no"}
                      </p>
                      <p>
                        Events/stop:{" "}
                        {capabilities.supports.runEvents
                          ? "events"
                          : "no events"}
                        {" / "}
                        {capabilities.supports.runStop ? "stop" : "no stop"}
                      </p>
                    </div>

                    <div className="settings-80m-health-card">
                      <span className="settings-80m-health-title">
                        80M Tool Gateway
                      </span>
                      <span
                        className={`settings-80m-health-pill ${
                          capabilities.toolGateway.available ? "ok" : "bad"
                        }`}
                      >
                        {capabilities.toolGateway.available
                          ? "available"
                          : "gated"}
                      </span>
                      <p>{capabilities.toolGateway.reason}</p>
                      <p>
                        Managed tools:{" "}
                        {capabilities.toolGateway.managedTools.join(", ") ||
                          "none"}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === "curator" && (
            <motion.div
              key="curator"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="settings-80m-section"
            >
              <div className="settings-80m-health-header">
                <label className="settings-80m-label">Curator</label>
                <button
                  type="button"
                  className="settings-80m-profile-btn"
                  onClick={() => void runCuratorAction("status")}
                  disabled={Boolean(curatorBusy)}
                >
                  <RefreshCw size={13} />
                  {curatorBusy === "status" ? "Checking" : "Status"}
                </button>
              </div>

              {!capabilities?.supports.curator && (
                <div className="settings-80m-result error">
                  Curator controls require runtime v0.12+. Run the safe upgrade
                  from Health first.
                </div>
              )}

              <div className="settings-80m-health-grid">
                <div className="settings-80m-health-card">
                  <span className="settings-80m-health-title">State</span>
                  <span
                    className={`settings-80m-health-pill ${
                      curator?.success ? "ok" : "bad"
                    }`}
                  >
                    {curator?.supported === false
                      ? "not supported"
                      : curator?.success
                        ? "ready"
                        : "unknown"}
                  </span>
                  <p>
                    Pinned skills:{" "}
                    {curator?.pinned.length
                      ? curator.pinned.join(", ")
                      : "none"}
                  </p>
                  <p>
                    Report:{" "}
                    {curator?.report.reportPath || "No curator report yet"}
                  </p>
                </div>

                <div className="settings-80m-health-card">
                  <span className="settings-80m-health-title">Actions</span>
                  <div className="settings-80m-action-grid">
                    {[
                      ["dry-run", "Dry Run"],
                      ["run", "Run"],
                      ["pause", "Pause"],
                      ["resume", "Resume"],
                      ["list-archived", "Archived"],
                      ["prune", "Prune Preview"],
                      ["backup", "Backup"],
                      ["rollback", "Rollback"],
                    ].map(([action, label]) => (
                      <button
                        key={action}
                        type="button"
                        className="settings-80m-profile-btn"
                        onClick={() => void runCuratorAction(action)}
                        disabled={Boolean(curatorBusy)}
                      >
                        {curatorBusy === action ? "Working" : label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="settings-80m-field">
                <label className="settings-80m-label">Skill Guard</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="settings-80m-input"
                    style={{ flex: 1 }}
                    value={curatorSkill}
                    onChange={(event) => setCuratorSkill(event.target.value)}
                    placeholder="skill-name"
                  />
                  {["pin", "unpin", "archive", "restore"].map((action) => (
                    <button
                      key={action}
                      type="button"
                      className="settings-80m-profile-btn"
                      onClick={() =>
                        void runCuratorAction(action, curatorSkill.trim())
                      }
                      disabled={Boolean(curatorBusy) || !curatorSkill.trim()}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>

              {(curatorOutput || curator?.report.report) && (
                <div className="settings-80m-field">
                  <label className="settings-80m-label">Latest Output</label>
                  <pre className="settings-80m-log-block">
                    {curatorOutput || curator?.report.report}
                  </pre>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "profiles" && (
            <motion.div
              key="profiles"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="settings-80m-section"
            >
              <div className="settings-80m-field">
                <label className="settings-80m-label">Create Profile</label>
                <div className="settings-80m-profile-create-grid">
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) =>
                      setProfileName(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_-]/g, ""),
                      )
                    }
                    placeholder="Profile name"
                    className="settings-80m-input"
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleCreateProfile()
                    }
                  />
                  <select
                    value={profileCreateMode}
                    onChange={(e) =>
                      setProfileCreateMode(
                        e.target.value as "clone" | "blank" | "clone-all",
                      )
                    }
                    className="settings-80m-input"
                  >
                    <option value="clone">Clone config</option>
                    <option value="blank">Blank profile</option>
                    <option value="clone-all">Clone everything</option>
                  </select>
                  <select
                    value={profileCloneFrom}
                    onChange={(e) => setProfileCloneFrom(e.target.value)}
                    className="settings-80m-input"
                    disabled={profileCreateMode === "blank"}
                  >
                    {profiles.map((item) => (
                      <option key={item.name} value={item.name}>
                        from {item.name}
                      </option>
                    ))}
                  </select>
                  <label className="settings-80m-check-row">
                    <input
                      type="checkbox"
                      checked={profileNoAlias}
                      onChange={(e) => setProfileNoAlias(e.target.checked)}
                    />
                    No alias
                  </label>
                  <label className="settings-80m-check-row">
                    <input
                      type="checkbox"
                      checked={profileNoSkills}
                      onChange={(e) => setProfileNoSkills(e.target.checked)}
                    />
                    No skills
                  </label>
                  <button
                    onClick={handleCreateProfile}
                    disabled={creatingProfile || !profileName.trim()}
                    className="settings-80m-save-btn"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {creatingProfile ? "CREATING..." : "CREATE"}
                  </button>
                </div>
                <p className="settings-80m-hint">
                  Clone config copies model, API, and SOUL settings with fresh
                  sessions and memory. Profiles isolate Hermes state, not your
                  filesystem workspace.
                </p>
                {profileCreateResult && (
                  <div
                    className={`settings-80m-result ${profileCreateResult.startsWith("Created") ? "success" : "error"}`}
                  >
                    {profileCreateResult}
                  </div>
                )}
              </div>

              <div className="settings-80m-divider" />

              <div className="settings-80m-profiles-list">
                {profiles.length === 0 ? (
                  <p
                    style={{
                      color: "#e8e8e8",
                      fontFamily: "'Fira Code', monospace",
                      fontSize: "12px",
                      textAlign: "center",
                      padding: "20px",
                    }}
                  >
                    No profiles yet
                  </p>
                ) : (
                  profiles.map((profileItem) => (
                    <div
                      key={profileItem.name}
                      className="settings-80m-profile-card"
                    >
                      <div className="settings-80m-profile-info">
                        <span className="settings-80m-profile-name">
                          {profileItem.name}
                        </span>
                        {profileItem.isActive && (
                          <span className="settings-80m-profile-badge">
                            ACTIVE
                          </span>
                        )}
                        <span className="settings-80m-profile-meta">
                          {profileItem.model || "model unknown"} ·{" "}
                          {profileItem.provider || "provider unknown"} ·{" "}
                          {profileItem.gatewayRunning
                            ? "gateway on"
                            : "gateway off"}
                        </span>
                      </div>
                      <div className="settings-80m-profile-actions">
                        {!profileItem.isActive && (
                          <button
                            onClick={() =>
                              handleSetActiveProfile(profileItem.name)
                            }
                            className="settings-80m-profile-btn"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteProfile(profileItem.name)}
                          className="settings-80m-profile-btn settings-80m-profile-btn-danger"
                          disabled={profileItem.isDefault}
                        >
                          Delete
                        </button>
                      </div>
                      <div className="settings-80m-profile-path">
                        {profileItem.path}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "backup" && (
            <motion.div
              key="backup"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="settings-80m-section"
            >
              <div className="settings-80m-field">
                <label className="settings-80m-label">80M Backup</label>
                <p
                  style={{
                    color: "#e8e8e8",
                    fontFamily: "'Fira Code', monospace",
                    fontSize: "11px",
                    marginBottom: "12px",
                  }}
                >
                  Export all 80M data including sessions, memory, skills, and
                  configuration.
                </p>
                <button
                  onClick={handleBackup}
                  disabled={backingUp}
                  className="settings-80m-save-btn"
                >
                  {backingUp ? (
                    "BACKING UP..."
                  ) : (
                    <>
                      <Download size={13} style={{ marginRight: 6 }} />
                      RUN BACKUP
                    </>
                  )}
                </button>
                {backupResult && (
                  <div
                    className={`settings-80m-result ${backupResult.startsWith("Error") ? "error" : "success"}`}
                  >
                    {backupResult}
                  </div>
                )}
              </div>

              <div className="settings-80m-divider" />

              <div className="settings-80m-field">
                <label className="settings-80m-label">Restore / Import</label>
                <p
                  style={{
                    color: "#e8e8e8",
                    fontFamily: "'Fira Code', monospace",
                    fontSize: "11px",
                    marginBottom: "12px",
                  }}
                >
                  Restore from a previous 80M backup. This will merge with
                  existing data.
                </p>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="settings-80m-save-btn"
                  style={{ background: "#4ade80" }}
                >
                  {importing ? (
                    "IMPORTING..."
                  ) : (
                    <>
                      <Upload size={13} style={{ marginRight: 6 }} />
                      RUN IMPORT
                    </>
                  )}
                </button>
                {importResult && (
                  <div
                    className={`settings-80m-result ${importResult.startsWith("Error") ? "error" : "success"}`}
                  >
                    {importResult}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "about" && (
            <motion.div
              key="about"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="settings-80m-section"
            >
              <div className="settings-80m-about">
                <Animated80MLogo className="animated-80m-logo-about" />
                <p className="settings-80m-about-tagline">Agent Desktop</p>
                <div className="settings-80m-about-versions">
                  <div className="settings-80m-about-version">
                    <span className="settings-80m-label">Desktop App</span>
                    <span className="settings-80m-version-value">
                      v{appVersion || "0.3.0"}
                    </span>
                  </div>
                  <div className="settings-80m-about-version">
                    <span className="settings-80m-label">80M Runtime</span>
                    <span className="settings-80m-version-value">
                      {hermesVersion || "Unknown"}
                    </span>
                  </div>
                </div>
                <p className="settings-80m-about-desc">
                  Agent Desktop — A brutalist dark UI for the 80M multi-agent
                  system.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Settings80m;

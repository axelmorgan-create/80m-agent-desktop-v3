import React, { useState, useEffect, useCallback } from "react";
import { useProfiles } from "../../hooks/useProfiles";
import { SettingsFrame } from "./SettingsFrame";
import { SettingsLoadingState } from "./SettingsLoadingState";
import { SettingsPanelContent } from "./SettingsPanelContent";
import { type SettingsTabId } from "./settingsTabs";
import { useTailscaleQr } from "./useTailscaleQr";
import {
  buildActiveModelPresets,
  modelConfigIssue,
} from "./settingsModelConfig";
import type {
  CredentialPool,
  CuratorCommandResult,
  CortexClipperInstallInfo,
  HermesCapabilities,
  HermesHealth,
  SettingsAudit,
  SettingsAuditActionResult,
  SettingsAuditCard,
  NotebookLmInstallResult,
  NotebookLmStatus,
  TailscaleMobileStatus,
} from "./settingsTypes";

interface Props {
  onBack: () => void;
  profile?: string;
}

const Settings80m: React.FC<Props> = ({ onBack, profile }) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>("overview");
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
  const [clipperInfo, setClipperInfo] =
    useState<CortexClipperInstallInfo | null>(null);
  const [clipperStatus, setClipperStatus] = useState("");
  const [notebookLmStatus, setNotebookLmStatus] =
    useState<NotebookLmStatus | null>(null);
  const [notebookLmLoading, setNotebookLmLoading] = useState(false);
  const [notebookLmInstalling, setNotebookLmInstalling] = useState(false);
  const [notebookLmInstallResult, setNotebookLmInstallResult] =
    useState<NotebookLmInstallResult | null>(null);
  const tailscaleQr = useTailscaleQr(tailscale);

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

  const refreshClipper = useCallback(async () => {
    if (!window.hermesAPI?.getCortexClipperInstallInfo) return;
    try {
      const info = await window.hermesAPI.getCortexClipperInstallInfo();
      setClipperInfo(info);
      setClipperStatus(
        info.exists ? "Cortex Clipper ready." : info.installNote,
      );
    } catch (err) {
      setClipperStatus(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const openClipperFolder = useCallback(async () => {
    try {
      const opened = await window.hermesAPI?.openCortexClipperFolder?.();
      setClipperStatus(
        opened ? "Clipper folder opened." : "Clipper folder is not ready.",
      );
      await refreshClipper();
    } catch (err) {
      setClipperStatus(err instanceof Error ? err.message : String(err));
    }
  }, [refreshClipper]);

  const openChromeExtensions = useCallback(async () => {
    try {
      await window.hermesAPI?.openChromeExtensionsPage?.();
      setClipperStatus("Chrome extensions page opened.");
    } catch (err) {
      setClipperStatus(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const refreshNotebookLm = useCallback(async () => {
    if (!window.hermesAPI?.getNotebookLmStatus) return;
    setNotebookLmLoading(true);
    try {
      const status = await window.hermesAPI.getNotebookLmStatus();
      setNotebookLmStatus(status as NotebookLmStatus);
    } finally {
      setNotebookLmLoading(false);
    }
  }, []);

  const installNotebookLm = useCallback(async () => {
    if (!window.hermesAPI?.installNotebookLm) return;
    setNotebookLmInstalling(true);
    setNotebookLmInstallResult(null);
    try {
      const result =
        (await window.hermesAPI.installNotebookLm()) as NotebookLmInstallResult;
      setNotebookLmInstallResult(result);
      await refreshNotebookLm();
    } catch (err) {
      setNotebookLmInstallResult({
        success: false,
        output: "",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setNotebookLmInstalling(false);
    }
  }, [refreshNotebookLm]);

  const openNotebookLmDocs = useCallback(() => {
    void window.hermesAPI?.openNotebookLmDocs?.();
  }, []);

  const openNotebookLm = useCallback(() => {
    void window.hermesAPI?.openNotebookLm?.();
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
      void refreshClipper();
      void refreshNotebookLm();
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
    refreshClipper,
    refreshNotebookLm,
    runCuratorAction,
  ]);

  useEffect(() => {
    setProfileCloneFrom(profile || "default");
  }, [profile]);

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

  if (loading) return <SettingsLoadingState onBack={onBack} />;

  return (
    <SettingsFrame
      activeTab={activeTab}
      onBack={onBack}
      onTabChange={setActiveTab}
    >
      <SettingsPanelContent
        activeTab={activeTab}
        profile={profile}
        audit={audit}
        auditLoading={auditLoading}
        healthLoading={healthLoading}
        capabilitiesLoading={capabilitiesLoading}
        auditActionBusy={auditActionBusy}
        auditActionOutput={auditActionOutput}
        onRefreshAudit={() =>
          void Promise.all([
            refreshAudit(),
            refreshHealth(),
            refreshCapabilities(),
          ])
        }
        onRunAuditAction={(card) => void runAuditAction(card)}
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
        tailscale={tailscale}
        tailscaleBusy={tailscaleBusy}
        tailscaleError={tailscaleError}
        tailscaleQr={tailscaleQr}
        onRefreshTailscale={() => void refreshTailscale()}
        onRunTailscaleAction={(action) => void runTailscaleAction(action)}
        onCopyMobileUrl={() => void copyMobileUrl()}
        onOpenMobileUrl={openMobileUrl}
        clipperInfo={clipperInfo}
        clipperStatus={clipperStatus}
        onRefreshClipper={() => void refreshClipper()}
        onOpenClipperFolder={() => void openClipperFolder()}
        onOpenChromeExtensions={() => void openChromeExtensions()}
        health={health}
        capabilities={capabilities}
        upgrading={upgrading}
        upgradeResult={upgradeResult}
        onRefreshHealth={() => {
          void refreshHealth();
          void refreshCapabilities();
        }}
        onSafeUpgrade={() => void handleSafeUpgrade()}
        notebookLmStatus={notebookLmStatus}
        notebookLmLoading={notebookLmLoading}
        notebookLmInstalling={notebookLmInstalling}
        notebookLmInstallResult={notebookLmInstallResult}
        onRefreshNotebookLm={() => void refreshNotebookLm()}
        onInstallNotebookLm={() => void installNotebookLm()}
        onOpenNotebookLmDocs={openNotebookLmDocs}
        onOpenNotebookLm={openNotebookLm}
        curator={curator}
        curatorBusy={curatorBusy}
        curatorSkill={curatorSkill}
        setCuratorSkill={setCuratorSkill}
        curatorOutput={curatorOutput}
        onRunCuratorAction={(action, skill) =>
          void runCuratorAction(action, skill)
        }
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
        backingUp={backingUp}
        importing={importing}
        backupResult={backupResult}
        importResult={importResult}
        onBackup={() => void handleBackup()}
        onImport={() => void handleImport()}
        appVersion={appVersion}
        hermesVersion={hermesVersion}
      />
    </SettingsFrame>
  );
};

export default Settings80m;

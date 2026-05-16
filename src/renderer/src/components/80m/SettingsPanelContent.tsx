import type React from "react";
import type { Dispatch, SetStateAction } from "react";
import { AnimatePresence } from "framer-motion";
import type { RendererProfileInfo } from "../../hooks/useProfiles";
import { SettingsAboutPanel } from "./SettingsAboutPanel";
import { SettingsAuditPanel } from "./SettingsAuditPanel";
import { SettingsBackupPanel } from "./SettingsBackupPanel";
import { SettingsConnectionPanel } from "./SettingsConnectionPanel";
import { SettingsCuratorPanel } from "./SettingsCuratorPanel";
import { SettingsHealthPanel } from "./SettingsHealthPanel";
import { SettingsMobilePanel } from "./SettingsMobilePanel";
import { SettingsNotebookLmPanel } from "./SettingsNotebookLmPanel";
import { SettingsProfilesPanel } from "./SettingsProfilesPanel";
import type { SettingsTabId } from "./settingsTabs";
import type {
  CuratorCommandResult,
  CortexClipperInstallInfo,
  HermesCapabilities,
  HermesHealth,
  ModelPreset,
  NotebookLmInstallResult,
  NotebookLmStatus,
  SettingsAudit,
  SettingsAuditCard,
  TailscaleMobileStatus,
} from "./settingsTypes";

interface SettingsPanelContentProps {
  activeTab: SettingsTabId;
  profile?: string;
  audit: SettingsAudit | null;
  auditLoading: boolean;
  healthLoading: boolean;
  capabilitiesLoading: boolean;
  auditActionBusy: string | null;
  auditActionOutput: string;
  onRefreshAudit: () => void;
  onRunAuditAction: (card: SettingsAuditCard) => void;
  connMode: "local" | "remote";
  setConnMode: Dispatch<SetStateAction<"local" | "remote">>;
  remoteUrl: string;
  setRemoteUrl: Dispatch<SetStateAction<string>>;
  apiKey: string;
  setApiKey: Dispatch<SetStateAction<string>>;
  activeModelPresets: ModelPreset[];
  provider: string;
  setProvider: Dispatch<SetStateAction<string>>;
  model: string;
  setModel: Dispatch<SetStateAction<string>>;
  baseUrl: string;
  setBaseUrl: Dispatch<SetStateAction<string>>;
  modelError: string | null;
  setModelError: Dispatch<SetStateAction<string | null>>;
  saved: boolean;
  onQuickModelSelect: (modelPreset: ModelPreset) => void;
  onSave: () => void;
  tailscale: TailscaleMobileStatus | null;
  tailscaleBusy: "enable" | "disable" | "rotate" | null;
  tailscaleError: string;
  tailscaleQr: string;
  onRefreshTailscale: () => void;
  onRunTailscaleAction: (action: "enable" | "disable" | "rotate") => void;
  onCopyMobileUrl: () => void;
  onOpenMobileUrl: () => void;
  clipperInfo: CortexClipperInstallInfo | null;
  clipperStatus: string;
  onRefreshClipper: () => void;
  onOpenClipperFolder: () => void;
  onOpenChromeExtensions: () => void;
  health: HermesHealth | null;
  capabilities: HermesCapabilities | null;
  upgrading: boolean;
  upgradeResult: string;
  onRefreshHealth: () => void;
  onSafeUpgrade: () => void;
  notebookLmStatus: NotebookLmStatus | null;
  notebookLmLoading: boolean;
  notebookLmInstalling: boolean;
  notebookLmInstallResult: NotebookLmInstallResult | null;
  onRefreshNotebookLm: () => void;
  onInstallNotebookLm: () => void;
  onOpenNotebookLmDocs: () => void;
  onOpenNotebookLm: () => void;
  curator: CuratorCommandResult | null;
  curatorBusy: string | null;
  curatorSkill: string;
  setCuratorSkill: Dispatch<SetStateAction<string>>;
  curatorOutput: string;
  onRunCuratorAction: (action: string, skill?: string) => void;
  profiles: RendererProfileInfo[];
  profileName: string;
  setProfileName: Dispatch<SetStateAction<string>>;
  profileCreateMode: "clone" | "blank" | "clone-all";
  setProfileCreateMode: Dispatch<
    SetStateAction<"clone" | "blank" | "clone-all">
  >;
  profileCloneFrom: string;
  setProfileCloneFrom: Dispatch<SetStateAction<string>>;
  profileNoAlias: boolean;
  setProfileNoAlias: Dispatch<SetStateAction<boolean>>;
  profileNoSkills: boolean;
  setProfileNoSkills: Dispatch<SetStateAction<boolean>>;
  profileCreateResult: string;
  creatingProfile: boolean;
  onCreateProfile: () => void;
  onDeleteProfile: (name: string) => void;
  onSetActiveProfile: (name: string) => void;
  backingUp: boolean;
  importing: boolean;
  backupResult: string;
  importResult: string;
  onBackup: () => void;
  onImport: () => void;
  appVersion: string;
  hermesVersion: string | null;
}

export function SettingsPanelContent({
  activeTab,
  profile,
  audit,
  auditLoading,
  healthLoading,
  capabilitiesLoading,
  auditActionBusy,
  auditActionOutput,
  onRefreshAudit,
  onRunAuditAction,
  connMode,
  setConnMode,
  remoteUrl,
  setRemoteUrl,
  apiKey,
  setApiKey,
  activeModelPresets,
  provider,
  setProvider,
  model,
  setModel,
  baseUrl,
  setBaseUrl,
  modelError,
  setModelError,
  saved,
  onQuickModelSelect,
  onSave,
  tailscale,
  tailscaleBusy,
  tailscaleError,
  tailscaleQr,
  onRefreshTailscale,
  onRunTailscaleAction,
  onCopyMobileUrl,
  onOpenMobileUrl,
  clipperInfo,
  clipperStatus,
  onRefreshClipper,
  onOpenClipperFolder,
  onOpenChromeExtensions,
  health,
  capabilities,
  upgrading,
  upgradeResult,
  onRefreshHealth,
  onSafeUpgrade,
  notebookLmStatus,
  notebookLmLoading,
  notebookLmInstalling,
  notebookLmInstallResult,
  onRefreshNotebookLm,
  onInstallNotebookLm,
  onOpenNotebookLmDocs,
  onOpenNotebookLm,
  curator,
  curatorBusy,
  curatorSkill,
  setCuratorSkill,
  curatorOutput,
  onRunCuratorAction,
  profiles,
  profileName,
  setProfileName,
  profileCreateMode,
  setProfileCreateMode,
  profileCloneFrom,
  setProfileCloneFrom,
  profileNoAlias,
  setProfileNoAlias,
  profileNoSkills,
  setProfileNoSkills,
  profileCreateResult,
  creatingProfile,
  onCreateProfile,
  onDeleteProfile,
  onSetActiveProfile,
  backingUp,
  importing,
  backupResult,
  importResult,
  onBackup,
  onImport,
  appVersion,
  hermesVersion,
}: SettingsPanelContentProps): React.JSX.Element {
  return (
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
          onRefresh={onRefreshAudit}
          onRunAuditAction={onRunAuditAction}
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
          onQuickModelSelect={onQuickModelSelect}
          onSave={onSave}
        />
      )}

      {activeTab === "mobile" && (
        <SettingsMobilePanel
          tailscale={tailscale}
          tailscaleBusy={tailscaleBusy}
          tailscaleError={tailscaleError}
          tailscaleQr={tailscaleQr}
          onRefresh={onRefreshTailscale}
          onRunAction={onRunTailscaleAction}
          onCopyMobileUrl={onCopyMobileUrl}
          onOpenMobileUrl={onOpenMobileUrl}
          clipperInfo={clipperInfo}
          clipperStatus={clipperStatus}
          onRefreshClipper={onRefreshClipper}
          onOpenClipperFolder={onOpenClipperFolder}
          onOpenChromeExtensions={onOpenChromeExtensions}
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
          onRefresh={onRefreshHealth}
          onSafeUpgrade={onSafeUpgrade}
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
          onRunCuratorAction={onRunCuratorAction}
        />
      )}

      {activeTab === "notebooklm" && (
        <SettingsNotebookLmPanel
          status={notebookLmStatus}
          loading={notebookLmLoading}
          installing={notebookLmInstalling}
          installResult={notebookLmInstallResult}
          onRefresh={onRefreshNotebookLm}
          onInstall={onInstallNotebookLm}
          onOpenDocs={onOpenNotebookLmDocs}
          onOpenNotebookLm={onOpenNotebookLm}
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
          onCreateProfile={onCreateProfile}
          onDeleteProfile={onDeleteProfile}
          onSetActiveProfile={onSetActiveProfile}
        />
      )}

      {activeTab === "backup" && (
        <SettingsBackupPanel
          backingUp={backingUp}
          importing={importing}
          backupResult={backupResult}
          importResult={importResult}
          onBackup={onBackup}
          onImport={onImport}
        />
      )}

      {activeTab === "about" && (
        <SettingsAboutPanel
          appVersion={appVersion}
          hermesVersion={hermesVersion}
        />
      )}
    </AnimatePresence>
  );
}

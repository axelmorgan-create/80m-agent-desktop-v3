import type React from "react";
import { motion } from "framer-motion";
import { BookOpen, ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import type {
  NotebookLmInstallResult,
  NotebookLmStatus,
} from "./settingsTypes";

interface SettingsNotebookLmPanelProps {
  status: NotebookLmStatus | null;
  loading: boolean;
  installing: boolean;
  installResult: NotebookLmInstallResult | null;
  onRefresh: () => void;
  onInstall: () => void;
  onOpenDocs: () => void;
  onOpenNotebookLm: () => void;
}

function statusTone(status: NotebookLmStatus | null): "ok" | "bad" {
  return status?.ready ? "ok" : "bad";
}

function statusLabel(status: NotebookLmStatus | null): string {
  if (!status) return "unknown";
  if (status.state === "connected") return "connected";
  if (status.state === "needs_auth") return "auth needed";
  return "not installed";
}

function formatUpdatedAt(value: number | null): string {
  if (!value) return "not found";
  return new Date(value).toLocaleString();
}

export function SettingsNotebookLmPanel({
  status,
  loading,
  installing,
  installResult,
  onRefresh,
  onInstall,
  onOpenDocs,
  onOpenNotebookLm,
}: SettingsNotebookLmPanelProps): React.JSX.Element {
  return (
    <motion.div
      key="notebooklm"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="settings-80m-section"
    >
      <div className="settings-80m-health-header">
        <label className="settings-80m-label">NotebookLM</label>
        <button
          type="button"
          className="settings-80m-profile-btn"
          onClick={onRefresh}
          disabled={loading || installing}
        >
          <RefreshCw size={13} />
          {loading ? "Checking" : "Refresh"}
        </button>
      </div>

      <div className="settings-80m-health-grid">
        <div className="settings-80m-health-card">
          <span className="settings-80m-health-title">Integration</span>
          <span className={`settings-80m-health-pill ${statusTone(status)}`}>
            {statusLabel(status)}
          </span>
          <p>{status?.message || "Checking NotebookLM status."}</p>
          <p>{status?.nextAction || "Refresh to inspect the local setup."}</p>
        </div>

        <div className="settings-80m-health-card">
          <span className="settings-80m-health-title">Local package</span>
          <span
            className={`settings-80m-health-pill ${
              status?.cliFound || status?.pythonModuleFound ? "ok" : "bad"
            }`}
          >
            {status?.cliFound || status?.pythonModuleFound
              ? "installed"
              : "missing"}
          </span>
          <p>CLI: {status?.cliFound ? "found" : "missing"}</p>
          <p>
            Python module: {status?.pythonModuleFound ? "found" : "missing"}
          </p>
          <p>Version: {status?.version || "not reported"}</p>
        </div>

        <div className="settings-80m-health-card">
          <span className="settings-80m-health-title">Google session</span>
          <span
            className={`settings-80m-health-pill ${
              status?.authFileFound ? "ok" : "bad"
            }`}
          >
            {status?.authFileFound ? "saved" : "not saved"}
          </span>
          <p>Session file: {status?.authFileFound ? "present" : "missing"}</p>
          <p>Updated: {formatUpdatedAt(status?.authFileUpdatedAt || null)}</p>
        </div>

        <div className="settings-80m-health-card">
          <span className="settings-80m-health-title">Security note</span>
          <span className="settings-80m-health-pill bad">
            <ShieldAlert size={12} /> unofficial
          </span>
          <p>Uses unofficial Google NotebookLM APIs.</p>
          <p>
            Saved browser session cookies are sensitive and must stay local.
          </p>
        </div>
      </div>

      <div className="settings-80m-divider" />

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          className="settings-80m-save-btn"
          onClick={onInstall}
          disabled={installing}
          style={{ width: "auto" }}
        >
          <BookOpen size={13} />
          {installing ? "INSTALLING" : "INSTALL NOTEBOOKLM-PY"}
        </button>
        <button
          type="button"
          className="settings-80m-profile-btn"
          onClick={onOpenNotebookLm}
        >
          <ExternalLink size={13} /> Open NotebookLM
        </button>
        <button
          type="button"
          className="settings-80m-profile-btn"
          onClick={onOpenDocs}
        >
          <ExternalLink size={13} /> Docs
        </button>
      </div>

      <div className="settings-80m-result" style={{ marginTop: "12px" }}>
        Login step: after install, use the NotebookLM login flow once so Google
        can create the local session file. Foleybot will only mark this ready
        after the package exists and the session file is present.
      </div>

      {installResult && (
        <div
          className={`settings-80m-result ${installResult.success ? "success" : "error"}`}
          style={{ marginTop: "12px" }}
        >
          {installResult.success
            ? "Install finished. Refresh the status, then complete Google login if needed."
            : installResult.error || installResult.output || "Install failed."}
        </div>
      )}
    </motion.div>
  );
}

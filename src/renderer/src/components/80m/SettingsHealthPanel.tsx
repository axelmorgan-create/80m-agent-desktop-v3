import type React from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import type { HermesCapabilities, HermesHealth } from "./settingsTypes";

interface SettingsHealthPanelProps {
  health: HermesHealth | null;
  healthLoading: boolean;
  capabilities: HermesCapabilities | null;
  capabilitiesLoading: boolean;
  upgrading: boolean;
  upgradeResult: string;
  onRefresh: () => void;
  onSafeUpgrade: () => void;
}

export function SettingsHealthPanel({
  health,
  healthLoading,
  capabilities,
  capabilitiesLoading,
  upgrading,
  upgradeResult,
  onRefresh,
  onSafeUpgrade,
}: SettingsHealthPanelProps): React.JSX.Element {
  return (
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
          onClick={onRefresh}
          disabled={healthLoading || capabilitiesLoading}
        >
          <RefreshCw size={13} />
          {healthLoading || capabilitiesLoading ? "Checking" : "Refresh"}
        </button>
      </div>

      {health ? (
        <div className="settings-80m-health-grid">
          <div className="settings-80m-health-card">
            <span className="settings-80m-health-title">Install</span>
            <span
              className={`settings-80m-health-pill ${
                health.install.installed && health.install.verified
                  ? "ok"
                  : "bad"
              }`}
            >
              {health.install.installed && health.install.verified
                ? "Ready"
                : "Needs attention"}
            </span>
            <p>Config: {health.install.configured ? "found" : "missing"}</p>
            <p>
              Provider key: {health.install.hasApiKey ? "found" : "missing"}
            </p>
          </div>

          <div className="settings-80m-health-card">
            <span className="settings-80m-health-title">Gateway</span>
            <span
              className={`settings-80m-health-pill ${
                health.gateway.running && health.gateway.apiOk ? "ok" : "bad"
              }`}
            >
              {health.gateway.apiOk ? "API online" : "API offline"}
            </span>
            <p>{health.gateway.apiUrl}</p>
            <p>
              HTTP: {health.gateway.apiStatus || "none"}
              {health.gateway.apiError ? ` / ${health.gateway.apiError}` : ""}
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
            <span className="settings-80m-health-title">Credentials</span>
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
              <span className="settings-80m-health-title">Runtime Version</span>
              <span
                className={`settings-80m-health-pill ${
                  capabilities.isAtLeastV12 ? "ok" : "bad"
                }`}
              >
                {capabilities.semver || "unknown"}
              </span>
              <p>
                v0.12 features:{" "}
                {capabilities.isAtLeastV12 ? "enabled" : "upgrade gated"}
              </p>
              <p>
                Update:{" "}
                {capabilities.updateAvailable ? "available" : "not reported"}
              </p>
              <button
                type="button"
                className="settings-80m-profile-btn"
                onClick={onSafeUpgrade}
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
              <span className="settings-80m-health-title">API Surface</span>
              <span
                className={`settings-80m-health-pill ${
                  capabilities.api.ok ? "ok" : "bad"
                }`}
              >
                {capabilities.api.ok ? "online" : "offline"}
              </span>
              <p>{capabilities.api.url}</p>
              <p>
                Models: {capabilities.api.models.join(", ") || "none reported"}
              </p>
            </div>

            <div className="settings-80m-health-card">
              <span className="settings-80m-health-title">Runs Runtime</span>
              <span
                className={`settings-80m-health-pill ${
                  capabilities.supports.runs ? "ok" : "bad"
                }`}
              >
                {capabilities.supports.runs ? "ready" : "unavailable"}
              </span>
              <p>Responses: {capabilities.supports.responses ? "yes" : "no"}</p>
              <p>
                Events/stop:{" "}
                {capabilities.supports.runEvents ? "events" : "no events"}
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
                {capabilities.toolGateway.available ? "available" : "gated"}
              </span>
              <p>{capabilities.toolGateway.reason}</p>
              <p>
                Managed tools:{" "}
                {capabilities.toolGateway.managedTools.join(", ") || "none"}
              </p>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

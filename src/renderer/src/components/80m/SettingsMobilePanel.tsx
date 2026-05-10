import type React from "react";
import { motion } from "framer-motion";
import {
  Copy,
  ExternalLink,
  Power,
  QrCode,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import type { TailscaleMobileStatus } from "./settingsTypes";

interface SettingsMobilePanelProps {
  tailscale: TailscaleMobileStatus | null;
  tailscaleBusy: "enable" | "disable" | "rotate" | null;
  tailscaleError: string;
  tailscaleQr: string;
  onRefresh: () => void;
  onRunAction: (action: "enable" | "disable" | "rotate") => void;
  onCopyMobileUrl: () => void;
  onOpenMobileUrl: () => void;
}

export function SettingsMobilePanel({
  tailscale,
  tailscaleBusy,
  tailscaleError,
  tailscaleQr,
  onRefresh,
  onRunAction,
  onCopyMobileUrl,
  onOpenMobileUrl,
}: SettingsMobilePanelProps): React.JSX.Element {
  const pairingUrl = tailscale?.pairUrl || tailscale?.tailnetUrl || "";

  return (
    <motion.div
      key="mobile"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="settings-80m-section"
    >
      <div className="settings-80m-health-header">
        <label className="settings-80m-label">Tailscale Mobile Access</label>
        <button
          type="button"
          className="settings-80m-profile-btn"
          onClick={onRefresh}
          disabled={Boolean(tailscaleBusy)}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="settings-80m-health-grid">
        <div className="settings-80m-health-card">
          <span className="settings-80m-health-title">Tailscale CLI</span>
          <span
            className={`settings-80m-health-pill ${
              tailscale?.installed && tailscale.daemonRunning ? "ok" : "bad"
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
          <p>{(tailscale?.tailscaleIps || []).join(", ") || "No tailnet IP"}</p>
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
          <p>Pairing token: {tailscale?.pairingToken ? "set" : "new"}</p>
        </div>

        <div className="settings-80m-health-card">
          <span className="settings-80m-health-title">Private Serve</span>
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
              value={pairingUrl}
              placeholder="Enable Tailscale Mobile Access"
            />
            <button
              type="button"
              className="settings-80m-profile-btn"
              onClick={onCopyMobileUrl}
              disabled={!pairingUrl}
              title="Copy"
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              className="settings-80m-profile-btn"
              onClick={onOpenMobileUrl}
              disabled={!pairingUrl}
              title="Open"
            >
              <ExternalLink size={13} />
            </button>
          </div>
          <div className="settings-80m-action-grid">
            <button
              type="button"
              className="settings-80m-save-btn"
              onClick={() => onRunAction("enable")}
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
              onClick={() => onRunAction("disable")}
              disabled={Boolean(tailscaleBusy)}
            >
              <Power size={13} />
              {tailscaleBusy === "disable" ? "Stopping" : "Disable"}
            </button>
            <button
              type="button"
              className="settings-80m-profile-btn"
              onClick={() => onRunAction("rotate")}
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
  );
}

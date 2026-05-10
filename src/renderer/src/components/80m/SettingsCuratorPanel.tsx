import type React from "react";
import type { Dispatch, SetStateAction } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import type { CuratorCommandResult, HermesCapabilities } from "./settingsTypes";

interface SettingsCuratorPanelProps {
  capabilities: HermesCapabilities | null;
  curator: CuratorCommandResult | null;
  curatorBusy: string | null;
  curatorSkill: string;
  setCuratorSkill: Dispatch<SetStateAction<string>>;
  curatorOutput: string;
  onRunCuratorAction: (action: string, skill?: string) => void;
}

export function SettingsCuratorPanel({
  capabilities,
  curator,
  curatorBusy,
  curatorSkill,
  setCuratorSkill,
  curatorOutput,
  onRunCuratorAction,
}: SettingsCuratorPanelProps): React.JSX.Element {
  return (
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
          onClick={() => onRunCuratorAction("status")}
          disabled={Boolean(curatorBusy)}
        >
          <RefreshCw size={13} />
          {curatorBusy === "status" ? "Checking" : "Status"}
        </button>
      </div>

      {!capabilities?.supports.curator && (
        <div className="settings-80m-result error">
          Curator controls require runtime v0.12+. Run the safe upgrade from
          Health first.
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
            {curator?.pinned.length ? curator.pinned.join(", ") : "none"}
          </p>
          <p>Report: {curator?.report.reportPath || "No curator report yet"}</p>
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
                onClick={() => onRunCuratorAction(action)}
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
              onClick={() => onRunCuratorAction(action, curatorSkill.trim())}
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
  );
}

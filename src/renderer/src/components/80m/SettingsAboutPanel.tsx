import type React from "react";
import { motion } from "framer-motion";
import Animated80MLogo from "../Animated80MLogo";

interface SettingsAboutPanelProps {
  appVersion: string;
  hermesVersion: string | null;
}

export function SettingsAboutPanel({
  appVersion,
  hermesVersion,
}: SettingsAboutPanelProps): React.JSX.Element {
  return (
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
          Agent Desktop — A brutalist dark UI for the 80M multi-agent system.
        </p>
      </div>
    </motion.div>
  );
}

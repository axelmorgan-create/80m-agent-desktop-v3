import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Wrench,
} from "lucide-react";
import type {
  SettingsAudit,
  SettingsAuditBucket,
  SettingsAuditCard,
} from "./settingsTypes";

interface SettingsAuditPanelProps {
  audit: SettingsAudit | null;
  profile?: string;
  auditLoading: boolean;
  healthLoading: boolean;
  capabilitiesLoading: boolean;
  auditActionBusy: string | null;
  auditActionOutput: string;
  onRefresh: () => void;
  onRunAuditAction: (card: SettingsAuditCard) => void;
}

const AUDIT_BUCKET_META: Record<
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

const AUDIT_BUCKET_ORDER: SettingsAuditBucket[] = [
  "needsAttention",
  "behindUpstream",
  "ready",
  "optional",
  "planGated",
];

function auditCategoryIcon(category: string): React.ReactNode {
  const lower = category.toLowerCase();
  if (lower.includes("memory")) return <Database size={14} />;
  if (lower.includes("api") || lower.includes("runtime")) {
    return <Terminal size={14} />;
  }
  if (lower.includes("tool") || lower.includes("provider")) {
    return <Wrench size={14} />;
  }
  return <Activity size={14} />;
}

function SettingsAuditCardView({
  card,
  auditActionBusy,
  onRunAuditAction,
}: {
  card: SettingsAuditCard;
  auditActionBusy: string | null;
  onRunAuditAction: (card: SettingsAuditCard) => void;
}): React.JSX.Element {
  return (
    <div
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
            onClick={() => onRunAuditAction(card)}
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
}

export function SettingsAuditPanel({
  audit,
  profile,
  auditLoading,
  healthLoading,
  capabilitiesLoading,
  auditActionBusy,
  auditActionOutput,
  onRefresh,
  onRunAuditAction,
}: SettingsAuditPanelProps): React.JSX.Element {
  return (
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
          <label className="settings-80m-label">Runtime Command Center</label>
          <p>
            Profile {audit?.profile || profile || "default"} ·{" "}
            {audit
              ? new Date(audit.createdAt).toLocaleTimeString()
              : "waiting for audit"}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={auditLoading || healthLoading || capabilitiesLoading}
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
        <pre className="settings-80m-log-block">{auditActionOutput}</pre>
      )}

      {audit ? (
        <div className="settings-80m-audit-groups">
          {AUDIT_BUCKET_ORDER.map((bucket) => {
            const cards = audit.buckets[bucket] || [];
            if (cards.length === 0) return null;
            const meta = AUDIT_BUCKET_META[bucket];
            return (
              <section key={bucket} className="settings-80m-audit-group">
                <div className="settings-80m-audit-group-title">
                  {meta.icon}
                  <span>{meta.title}</span>
                  <strong>{cards.length}</strong>
                </div>
                <div className="settings-80m-audit-card-grid">
                  {cards.map((card) => (
                    <SettingsAuditCardView
                      key={card.id}
                      card={card}
                      auditActionBusy={auditActionBusy}
                      onRunAuditAction={onRunAuditAction}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="settings-80m-result">
          {auditLoading ? "Auditing Hermes runtime..." : "No audit loaded yet."}
        </div>
      )}
    </motion.div>
  );
}

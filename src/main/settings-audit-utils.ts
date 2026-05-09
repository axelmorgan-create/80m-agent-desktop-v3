export type SettingsAuditSeverity = "ok" | "info" | "warning" | "error";

export type SettingsAuditBucket =
  | "needsAttention"
  | "behindUpstream"
  | "ready"
  | "optional"
  | "planGated";

export interface SettingsAuditAction {
  id: string;
  label: string;
  destructive?: boolean;
}

export interface SettingsAuditCard {
  id: string;
  title: string;
  summary: string;
  severity: SettingsAuditSeverity;
  category: string;
  source: string;
  details?: string;
  docsUrl?: string;
  commandPreview?: string;
  action?: SettingsAuditAction;
  bucket?: SettingsAuditBucket;
}

export type SettingsAuditBuckets = Record<
  SettingsAuditBucket,
  SettingsAuditCard[]
>;

export interface SettingsAuditSummary {
  needsAttention: number;
  warnings: number;
  ready: number;
  optional: number;
  planGated: number;
  behindUpstream: number;
}

const EMPTY_BUCKETS: SettingsAuditBuckets = {
  needsAttention: [],
  behindUpstream: [],
  ready: [],
  optional: [],
  planGated: [],
};

export function redactSettingsAuditText(value: string): string {
  return String(value || "")
    .replace(
      /\b(?:sk|sk-or|hsk|xai|ghp|gho|ghu|ghs|github_pat|hf|brv)_[A-Za-z0-9._-]{12,}\b/g,
      "[redacted]",
    )
    .replace(
      /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
      "[redacted.jwt]",
    )
    .replace(
      /((?:API|AUTH|ACCESS|REFRESH|USER)?_?(?:KEY|TOKEN|SECRET|PASSWORD)\s*[=:]\s*)(["']?)[^\s"']+/gi,
      "$1$2[redacted]",
    );
}

export function bucketForSettingsAuditCard(
  card: SettingsAuditCard,
): SettingsAuditBucket {
  if (card.bucket) return card.bucket;
  if (card.severity === "error" || card.severity === "warning") {
    return "needsAttention";
  }
  if (card.severity === "ok") return "ready";
  return "optional";
}

export function buildSettingsAuditBuckets(
  cards: SettingsAuditCard[],
): SettingsAuditBuckets {
  const buckets: SettingsAuditBuckets = {
    needsAttention: [],
    behindUpstream: [],
    ready: [],
    optional: [],
    planGated: [],
  };

  for (const card of cards) {
    buckets[bucketForSettingsAuditCard(card)].push(card);
  }

  return buckets;
}

export function summarizeSettingsAuditBuckets(
  buckets: SettingsAuditBuckets = EMPTY_BUCKETS,
): SettingsAuditSummary {
  const all = Object.values(buckets).flat();
  return {
    needsAttention: buckets.needsAttention.length,
    warnings: all.filter((card) => card.severity === "warning").length,
    ready: buckets.ready.length,
    optional: buckets.optional.length,
    planGated: buckets.planGated.length,
    behindUpstream: buckets.behindUpstream.length,
  };
}

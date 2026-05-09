import { describe, expect, it } from "vitest";
import {
  buildSettingsAuditBuckets,
  redactSettingsAuditText,
  summarizeSettingsAuditBuckets,
  type SettingsAuditCard,
} from "../src/main/settings-audit-utils";

describe("settings audit helpers", () => {
  it("redacts obvious secrets from command output", () => {
    const raw = [
      "OPENAI_API_KEY=sk_test_1234567890abcdefghijkl",
      "API_SERVER_KEY=hsk_1234567890abcdefghijklmnop",
      "token: github_pat_1234567890abcdefghijklmnop",
    ].join("\n");

    const redacted = redactSettingsAuditText(raw);
    expect(redacted).not.toContain("sk_test_1234567890abcdefghijkl");
    expect(redacted).not.toContain("hsk_1234567890abcdefghijklmnop");
    expect(redacted).not.toContain("github_pat_1234567890abcdefghijklmnop");
    expect(redacted).toContain("[redacted]");
  });

  it("buckets cards by severity and explicit bucket", () => {
    const cards: SettingsAuditCard[] = [
      {
        id: "api",
        title: "API",
        summary: "offline",
        severity: "error",
        category: "API",
        source: "test",
      },
      {
        id: "gateway",
        title: "Gateway",
        summary: "free tier",
        severity: "info",
        category: "Tools",
        source: "test",
        bucket: "planGated",
      },
      {
        id: "memory",
        title: "Memory",
        summary: "ready",
        severity: "ok",
        category: "Memory",
        source: "test",
      },
    ];

    const buckets = buildSettingsAuditBuckets(cards);
    expect(buckets.needsAttention.map((card) => card.id)).toEqual(["api"]);
    expect(buckets.planGated.map((card) => card.id)).toEqual(["gateway"]);
    expect(buckets.ready.map((card) => card.id)).toEqual(["memory"]);
    expect(summarizeSettingsAuditBuckets(buckets)).toMatchObject({
      needsAttention: 1,
      ready: 1,
      planGated: 1,
    });
  });
});

import { describe, expect, it } from "vitest";
import { validateHermesImportArchive } from "../src/main/installer";

describe("Hermes import validation", () => {
  it("rejects empty archive paths before invoking Hermes", () => {
    expect(validateHermesImportArchive("")).toBe(
      "Choose a Hermes backup archive first.",
    );
  });

  it("rejects missing archive paths before invoking Hermes", () => {
    expect(validateHermesImportArchive("/tmp/80m-missing-backup.tgz")).toBe(
      "Backup archive not found: /tmp/80m-missing-backup.tgz",
    );
  });
});

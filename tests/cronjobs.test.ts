import { describe, expect, it } from "vitest";
import { buildCronCreateArgs } from "../src/main/cronjobs";

describe("cron job command planning", () => {
  it("preserves the existing simple create shape", () => {
    expect(
      buildCronCreateArgs("every 2h", "Check status", "Status check", "local"),
    ).toEqual([
      "create",
      "every 2h",
      "--name",
      "Status check",
      "--deliver",
      "local",
      "--",
      "Check status",
    ]);
  });

  it("supports v0.13 no-agent watchdog script options", () => {
    expect(
      buildCronCreateArgs("*/5 * * * *", undefined, "Disk watchdog", "local", {
        script: "check-disk.sh",
        noAgent: true,
        workdir: "/home/falcon/Apps/code/80m-agent-desktop",
        repeat: 3,
        skills: ["ops"],
      }),
    ).toEqual([
      "create",
      "*/5 * * * *",
      "--name",
      "Disk watchdog",
      "--deliver",
      "local",
      "--repeat",
      "3",
      "--skill",
      "ops",
      "--script",
      "check-disk.sh",
      "--no-agent",
      "--workdir",
      "/home/falcon/Apps/code/80m-agent-desktop",
    ]);
  });
});

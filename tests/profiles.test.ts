import { describe, expect, it } from "vitest";
import {
  buildCreateProfileArgs,
  normalizeProfileCreateOptions,
} from "../src/main/profiles";

describe("profile creation planning", () => {
  it("defaults to clone mode so new agents are usable immediately", () => {
    expect(normalizeProfileCreateOptions()).toEqual({ mode: "clone" });
    expect(buildCreateProfileArgs("Researcher")).toEqual({
      success: true,
      profileName: "researcher",
      args: ["profile", "create", "researcher", "--clone"],
    });
  });

  it("preserves legacy boolean createProfile calls", () => {
    expect(buildCreateProfileArgs("blankbot", false)).toEqual({
      success: true,
      profileName: "blankbot",
      args: ["profile", "create", "blankbot"],
    });
    expect(buildCreateProfileArgs("clonebot", true)).toEqual({
      success: true,
      profileName: "clonebot",
      args: ["profile", "create", "clonebot", "--clone"],
    });
  });

  it("maps clone-all, clone-from, no-alias, and no-skills to Hermes flags", () => {
    expect(
      buildCreateProfileArgs("writer", {
        mode: "clone-all",
        cloneFrom: "Default",
        noAlias: true,
        noSkills: true,
      }),
    ).toEqual({
      success: true,
      profileName: "writer",
      args: [
        "profile",
        "create",
        "writer",
        "--clone-all",
        "--clone-from",
        "default",
        "--no-alias",
        "--no-skills",
      ],
    });
  });

  it("rejects invalid profile ids and invalid clone-from combinations", () => {
    expect(buildCreateProfileArgs("bad name")).toMatchObject({
      success: false,
    });
    expect(
      buildCreateProfileArgs("blankbot", {
        mode: "blank",
        cloneFrom: "default",
      }),
    ).toMatchObject({
      success: false,
      error: "cloneFrom can only be used with clone or clone-all mode.",
    });
  });
});

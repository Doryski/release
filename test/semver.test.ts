import { describe, expect, it } from "vitest";
import {
  applyBump,
  determineBump,
  parseSemver,
  stripV,
} from "../src/semver.js";

describe("parseSemver", () => {
  it("parses a plain version", () => {
    expect(parseSemver("v1.2.3")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: null,
    });
  });

  it("captures the prerelease", () => {
    expect(parseSemver("v1.2.3-rc.1")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: "rc.1",
    });
  });

  it("rejects invalid strings", () => {
    expect(parseSemver("1.2.3")).toBeNull();
    expect(parseSemver("v1.2")).toBeNull();
    expect(parseSemver("vabc")).toBeNull();
    expect(parseSemver("")).toBeNull();
  });
});

describe("applyBump", () => {
  const base = { major: 1, minor: 2, patch: 3 };

  it("bumps major", () => {
    expect(applyBump(base, "major")).toBe("v2.0.0");
  });

  it("bumps minor", () => {
    expect(applyBump(base, "minor")).toBe("v1.3.0");
  });

  it("bumps patch", () => {
    expect(applyBump(base, "patch")).toBe("v1.2.4");
  });
});

describe("determineBump", () => {
  it("maps feat to minor", () => {
    expect(determineBump(["feat: add thing"])).toBe("minor");
  });

  it("maps fix to patch", () => {
    expect(determineBump(["fix: a bug"])).toBe("patch");
  });

  it("maps feat! to major", () => {
    expect(determineBump(["feat!: breaking feature"])).toBe("major");
  });

  it("maps a BREAKING CHANGE footer to major", () => {
    expect(
      determineBump(["feat: something\n\nBREAKING CHANGE: drops API"]),
    ).toBe("major");
  });

  it("maps chore/docs to patch", () => {
    expect(determineBump(["chore: deps", "docs: readme"])).toBe("patch");
  });

  it("defaults empty history to patch", () => {
    expect(determineBump([])).toBe("patch");
  });
});

describe("stripV", () => {
  it("strips a leading v", () => {
    expect(stripV("v1.2.3")).toBe("1.2.3");
  });

  it("leaves a bare version untouched", () => {
    expect(stripV("1.2.3")).toBe("1.2.3");
  });
});

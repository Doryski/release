import { describe, expect, it } from "vitest";
import { parseActionsUrl } from "../src/git.js";

describe("parseActionsUrl", () => {
  it("parses the ssh form", () => {
    expect(parseActionsUrl("git@github.com:Doryski/release.git")).toBe(
      "https://github.com/Doryski/release/actions",
    );
  });

  it("parses the ssh form without .git", () => {
    expect(parseActionsUrl("git@github.com:Doryski/release")).toBe(
      "https://github.com/Doryski/release/actions",
    );
  });

  it("parses the https form", () => {
    expect(parseActionsUrl("https://github.com/Doryski/release.git")).toBe(
      "https://github.com/Doryski/release/actions",
    );
  });

  it("parses the https form without .git", () => {
    expect(parseActionsUrl("https://github.com/Doryski/release")).toBe(
      "https://github.com/Doryski/release/actions",
    );
  });

  it("returns null for a non-github remote", () => {
    expect(parseActionsUrl("git@gitlab.com:Doryski/release.git")).toBeNull();
  });

  it("returns null for an empty remote", () => {
    expect(parseActionsUrl("")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { buildChangelog, parseCommit, renderEntries } from "../src/changelog.js";

const DOC = `## Changelog

All notable changes are documented here.

## [Unreleased]

## [0.1.0] - 2026-05-01

### Added

- Initial release.

[0.1.0]: https://example.com/releases/tag/v0.1.0
`;

describe("parseCommit", () => {
  it("maps conventional types to Keep a Changelog sections", () => {
    expect(parseCommit("feat: add users command")?.section).toBe("Added");
    expect(parseCommit("fix: guard redirects")?.section).toBe("Fixed");
    expect(parseCommit("refactor: drop the local extractor")?.section).toBe("Changed");
    expect(parseCommit("perf: cache createmeta")?.section).toBe("Changed");
  });

  it("keeps the scope and description separate", () => {
    expect(parseCommit("feat(attach): type the attachment objects")).toEqual({
      section: "Added",
      scope: "attach",
      description: "type the attachment objects",
    });
  });

  it("routes breaking changes to their own section", () => {
    expect(parseCommit("feat!: drop node 18")?.section).toBe("Breaking Changes");
    expect(
      parseCommit("chore: rework config\n\nBREAKING CHANGE: config moved")?.section,
    ).toBe("Breaking Changes");
  });

  it("drops non-user-facing and non-conventional commits", () => {
    expect(parseCommit("chore: drop PR evidence")).toBeNull();
    expect(parseCommit("docs: add CLAUDE.md")).toBeNull();
    expect(parseCommit("release: v0.12.0")).toBeNull();
    expect(parseCommit("wip")).toBeNull();
  });
});

describe("renderEntries", () => {
  it("groups by section in a fixed order", () => {
    const out = renderEntries([
      "fix: stop double-encoding",
      "feat: add users command",
      "feat!: drop node 18",
      "refactor: extract helper",
    ]);

    expect(out).toBe(
      [
        "### Breaking Changes",
        "",
        "- drop node 18",
        "",
        "### Added",
        "",
        "- add users command",
        "",
        "### Changed",
        "",
        "- extract helper",
        "",
        "### Fixed",
        "",
        "- stop double-encoding",
      ].join("\n"),
    );
  });

  it("is empty when nothing is user-facing", () => {
    expect(renderEntries(["chore: tidy", "release: v0.2.0"])).toBe("");
  });
});

describe("buildChangelog", () => {
  it("generates a dated section from commits and leaves Unreleased empty", () => {
    const out = buildChangelog({
      content: DOC,
      version: "v0.2.0",
      date: "2026-08-01",
      commits: ["feat: add users command", "chore: tidy"],
    });

    expect(out).toContain("## [Unreleased]\n\n## [0.2.0] - 2026-08-01\n");
    expect(out).toContain("### Added\n\n- add users command");
    expect(out).toContain("## [0.1.0] - 2026-05-01");
    expect(out?.endsWith("[0.1.0]: https://example.com/releases/tag/v0.1.0\n")).toBe(true);
  });

  it("mirrors the document's link-ref convention for the new version", () => {
    const out = buildChangelog({
      content: DOC,
      version: "v0.2.0",
      date: "2026-08-01",
      commits: ["feat: add users command"],
    });

    expect(out).toContain(
      "[0.2.0]: https://example.com/releases/tag/v0.2.0\n[0.1.0]: https://example.com/releases/tag/v0.1.0",
    );
  });

  it("repoints the Unreleased compare ref at the new version", () => {
    const content = DOC.replace(
      "[0.1.0]: https://example.com/releases/tag/v0.1.0",
      "[Unreleased]: https://example.com/compare/v0.1.0...HEAD\n[0.1.0]: https://example.com/releases/tag/v0.1.0",
    );

    const out = buildChangelog({
      content,
      version: "0.2.0",
      date: "2026-08-01",
      commits: ["feat: add users command"],
    });

    expect(out).toContain("[Unreleased]: https://example.com/compare/v0.2.0...HEAD");
    expect(out).not.toContain("compare/v0.1.0...HEAD");
  });

  it("adds no link ref when the document keeps none", () => {
    const out = buildChangelog({
      content: DOC.replace("\n[0.1.0]: https://example.com/releases/tag/v0.1.0\n", ""),
      version: "0.2.0",
      date: "2026-08-01",
      commits: ["feat: add users command"],
    });

    expect(out).not.toContain("[0.2.0]:");
  });

  it("promotes hand-written Unreleased notes verbatim over generated ones", () => {
    const content = DOC.replace(
      "## [Unreleased]\n",
      "## [Unreleased]\n\n### Added\n\n- Hand-written note.\n",
    );

    const out = buildChangelog({
      content,
      version: "0.2.0",
      date: "2026-08-01",
      commits: ["feat: add users command"],
    });

    expect(out).toContain("### Added\n\n- Hand-written note.");
    expect(out).not.toContain("add users command");
    expect(out).toContain("## [Unreleased]\n\n## [0.2.0] - 2026-08-01");
  });

  it("returns null when there is nothing to record", () => {
    expect(
      buildChangelog({
        content: DOC,
        version: "0.2.0",
        date: "2026-08-01",
        commits: ["chore: tidy"],
      }),
    ).toBeNull();
  });

  it("inserts above the newest version when there is no Unreleased heading", () => {
    const content = DOC.replace("## [Unreleased]\n\n", "");

    const out = buildChangelog({
      content,
      version: "0.2.0",
      date: "2026-08-01",
      commits: ["fix: stop double-encoding"],
    });

    expect(out).toContain(
      "## [0.2.0] - 2026-08-01\n\n### Fixed\n\n- stop double-encoding\n\n## [0.1.0]",
    );
  });
});

import { readFile, writeFile } from "node:fs/promises";
import { stripV } from "./semver.js";

const SECTION_BY_TYPE = {
  feat: "Added",
  fix: "Fixed",
  perf: "Changed",
  refactor: "Changed",
  revert: "Changed",
} as const;

const BREAKING_SECTION = "Breaking Changes";

const SECTION_ORDER = [
  BREAKING_SECTION,
  "Added",
  "Changed",
  "Fixed",
] as const;

export type ChangelogSection = (typeof SECTION_ORDER)[number];

export type ChangelogEntry = {
  section: ChangelogSection;
  scope: string | null;
  description: string;
};

const SUBJECT_RE = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;

const isKnownType = (type: string): type is keyof typeof SECTION_BY_TYPE =>
  type in SECTION_BY_TYPE;

export const parseCommit = (message: string): ChangelogEntry | null => {
  const [subject = "", ...rest] = message.split("\n");
  const match = SUBJECT_RE.exec(subject.trim());
  if (!match) return null;

  const [, type, scope, bang, description] = match;
  const breaking = bang === "!" || /^BREAKING CHANGE:/m.test(rest.join("\n"));

  if (breaking) return { section: BREAKING_SECTION, scope: scope ?? null, description };
  if (!isKnownType(type)) return null;

  return { section: SECTION_BY_TYPE[type], scope: scope ?? null, description };
};

const renderEntry = ({ scope, description }: ChangelogEntry) =>
  scope ? `- **${scope}**: ${description}` : `- ${description}`;

export const renderEntries = (commits: string[]) => {
  const entries = commits
    .map(parseCommit)
    .filter((entry) => entry !== null);

  return SECTION_ORDER.flatMap((section) => {
    const forSection = entries.filter((entry) => entry.section === section);
    if (!forSection.length) return [];
    return [`### ${section}`, "", ...forSection.map(renderEntry), ""];
  })
    .join("\n")
    .trimEnd();
};

const VERSION_HEADING_RE = /^## \[/;
const UNRELEASED_HEADING_RE = /^## \[unreleased\]/i;

const splitDocument = (content: string) => {
  const lines = content.split("\n");
  const headings = lines.flatMap((line, index) =>
    VERSION_HEADING_RE.test(line) ? [index] : [],
  );
  const unreleasedAt = headings.find((index) =>
    UNRELEASED_HEADING_RE.test(lines[index]),
  );

  if (unreleasedAt === undefined) {
    const at = headings[0] ?? lines.length;
    return {
      head: lines.slice(0, at).join("\n"),
      unreleasedHeading: null,
      unreleasedBody: "",
      tail: lines.slice(at).join("\n"),
    };
  }

  const tailAt =
    headings.find(
      (index) => index > unreleasedAt && !UNRELEASED_HEADING_RE.test(lines[index]),
    ) ?? lines.length;

  return {
    head: lines.slice(0, unreleasedAt).join("\n"),
    unreleasedHeading: lines[unreleasedAt],
    unreleasedBody: lines.slice(unreleasedAt + 1, tailAt).join("\n").trim(),
    tail: lines.slice(tailAt).join("\n"),
  };
};

const LINK_REF_RE = /^\[(\d+\.\d+\.\d+)\]:\s*(\S*\/tag\/)v\d+\.\d+\.\d+\s*$/;

// Only mirrors a convention the document already follows; files without
// per-version link refs keep none.
const withLinkRef = (tail: string, version: string) => {
  const lines = tail.split("\n");
  const at = lines.findIndex((line) => LINK_REF_RE.test(line));
  if (at < 0) return tail;

  const [, , base] = LINK_REF_RE.exec(lines[at]) ?? [];
  const ref = `[${version}]: ${base}v${version}`;
  if (lines.some((line) => line.startsWith(`[${version}]:`))) return tail;

  return [...lines.slice(0, at), ref, ...lines.slice(at)].join("\n");
};

const UNRELEASED_REF_RE =
  /^(\[Unreleased\]:\s*\S*\/compare\/)v\d+\.\d+\.\d+(\.{3}HEAD)\s*$/i;

const withUnreleasedRef = (tail: string, version: string) =>
  tail
    .split("\n")
    .map((line) => line.replace(UNRELEASED_REF_RE, `$1v${version}$2`))
    .join("\n");

export type BuildChangelogInput = {
  content: string;
  version: string;
  date: string;
  commits: string[];
};

// Hand-written `[Unreleased]` notes win: when that section has content it is
// promoted verbatim, otherwise the section is generated from the commits.
export const buildChangelog = ({
  content,
  version,
  date,
  commits,
}: BuildChangelogInput) => {
  const { head, unreleasedHeading, unreleasedBody, tail } =
    splitDocument(content);

  const body = unreleasedBody || renderEntries(commits);
  if (!body) return null;

  const released = stripV(version);
  const blocks = [
    head.trimEnd(),
    unreleasedHeading,
    `## [${released}] - ${date}\n\n${body}`,
    withUnreleasedRef(withLinkRef(tail.trim(), released), released),
  ].filter((block): block is string => Boolean(block));

  return `${blocks.join("\n\n")}\n`;
};

export const today = () => new Date().toISOString().slice(0, 10);

export const updateChangelogFile = async (
  file: string,
  version: string,
  commits: string[],
) => {
  const content = await readFile(file, "utf8").catch(() => null);
  if (content === null) return false;

  const next = buildChangelog({ content, version, date: today(), commits });
  if (!next || next === content) return false;

  await writeFile(file, next, "utf8");
  return true;
};

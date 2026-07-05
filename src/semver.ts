export type BumpType = "major" | "minor" | "patch";

export type ParsedSemver = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
};

export const parseSemver = (tag: string): ParsedSemver | null => {
  const match = /^v(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?$/.exec(tag);
  if (!match) return null;
  const [, major, minor, patch, prerelease] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease ?? null,
  };
};

export const applyBump = (
  v: { major: number; minor: number; patch: number },
  type: BumpType,
) => {
  if (type === "major") return `v${v.major + 1}.0.0`;
  if (type === "minor") return `v${v.major}.${v.minor + 1}.0`;
  return `v${v.major}.${v.minor}.${v.patch + 1}`;
};

export const determineBump = (commits: string[]): BumpType => {
  let bump: BumpType = "patch";
  const subjectRe = /^(\w+)(?:\([^)]*\))?(!)?:/;
  for (const msg of commits) {
    const subject = msg.split("\n")[0];
    const match = subjectRe.exec(subject);
    const breaking = match?.[2] === "!" || /^BREAKING CHANGE:/m.test(msg);
    if (breaking) return "major";
    if (match?.[1] === "feat") bump = "minor";
  }
  return bump;
};

export const stripV = (tag: string) => (tag.startsWith("v") ? tag.slice(1) : tag);

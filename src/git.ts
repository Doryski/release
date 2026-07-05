import { execSync } from "node:child_process";

export const sh = (cmd: string) => execSync(cmd, { encoding: "utf8" }).trim();

export const getRecentTags = () => {
  try {
    const out = sh("git tag --sort=-v:refname");
    return out ? out.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
};

export const getCommitsSince = (ref: string | null): string[] => {
  try {
    const range = ref ? `${ref}..HEAD` : "HEAD";
    const out = sh(`git log ${range} --format=%B%x00`);
    return out
      ? out
          .split("\0")
          .map((msg) => msg.trim())
          .filter(Boolean)
      : [];
  } catch {
    return [];
  }
};

export const ensureCleanTree = () => {
  const status = sh("git status --porcelain");
  if (status) {
    console.error(
      "\n✗ Working tree is not clean. Commit or stash changes first:\n",
    );
    console.error(status);
    process.exit(1);
  }
};

export const ensureOnDefaultBranch = () => {
  const branch = sh("git rev-parse --abbrev-ref HEAD");
  if (branch !== "main" && branch !== "master") {
    console.warn(`\n⚠ You are on branch "${branch}", not main/master.`);
  }
  return branch;
};

export const parseActionsUrl = (remoteUrl: string): string | null => {
  const trimmed = remoteUrl.trim();
  if (!trimmed) return null;
  const ssh = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/.exec(trimmed);
  if (ssh) return `https://github.com/${ssh[1]}/${ssh[2]}/actions`;
  const https = /^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/.exec(trimmed);
  if (https) return `https://github.com/${https[1]}/${https[2]}/actions`;
  return null;
};

export const getRemoteActionsUrl = (): string | null => {
  try {
    const remote = sh("git remote get-url origin");
    return parseActionsUrl(remote);
  } catch {
    return null;
  }
};

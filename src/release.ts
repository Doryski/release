import { spawnSync } from "node:child_process";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  ensureCleanTree,
  ensureOnDefaultBranch,
  getCommitsSince,
  getRecentTags,
  getRemoteActionsUrl,
} from "./git.js";
import { readJson, updateVersionFile } from "./pkg.js";
import {
  applyBump,
  BumpType,
  determineBump,
  parseSemver,
  stripV,
} from "./semver.js";

export type ReleaseOptions = {
  releaseVersion?: string;
  bump?: BumpType;
  yes?: boolean;
  dryRun?: boolean;
};

const PACKAGE_JSON = path.join(process.cwd(), "package.json");

const makeRunStep =
  (dryRun: boolean) => (label: string, cmd: string, args: string[]) => {
    if (dryRun) {
      console.log(`→ [dry-run] ${label}`);
      return;
    }
    console.log(`→ ${label}`);
    const result = spawnSync(cmd, args, { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  };

export const release = async (options: ReleaseOptions = {}) => {
  const flags = {
    releaseVersion: options.releaseVersion,
    bump: options.bump,
    yes: options.yes ?? false,
    dryRun: options.dryRun ?? false,
  };

  ensureCleanTree();
  const branch = ensureOnDefaultBranch();

  const tags = getRecentTags();
  const pkg = await readJson<{ name: string; version: string }>(PACKAGE_JSON);

  console.log(`\n📦 ${pkg.name} — release\n`);
  console.log(`Package:           ${pkg.name}`);
  console.log(`Current branch:    ${branch}`);
  console.log(`package.json:      ${pkg.version}`);
  console.log(
    `Recent tags:       ${tags.length ? tags.slice(0, 5).join(", ") : "(none)"}`,
  );

  const latest = tags.find((t) => parseSemver(t));
  const latestParsed = latest ? parseSemver(latest) : null;

  const commitsSinceTag = getCommitsSince(latest ?? null);
  const detectedBump = determineBump(commitsSinceTag);
  const bumpType = flags.bump ?? detectedBump;

  const proposed = latestParsed
    ? applyBump(latestParsed, bumpType)
    : `v${stripV(pkg.version)}`;

  const bumpSource = flags.bump ? `${bumpType} bump, forced` : `${bumpType} bump`;
  console.log(`Commits since tag: ${commitsSinceTag.length} (${bumpSource})`);
  console.log(`Proposed new tag:  ${proposed}\n`);

  const interactive = stdin.isTTY === true;
  const rl = interactive
    ? createInterface({ input: stdin, output: stdout })
    : null;

  const askVersion = async () => {
    if (flags.releaseVersion) {
      console.log(`Version (from --release-version):  ${flags.releaseVersion}`);
      return flags.releaseVersion;
    }
    if (!rl) return proposed;
    return (
      await rl.question(`Enter version (press Enter to accept ${proposed}): `)
    ).trim();
  };

  const askConfirm = async () => {
    if (flags.yes) {
      console.log(`Proceed? [y/N]  y  (from --yes)`);
      return true;
    }
    if (!rl) {
      console.error(
        "\n✗ Non-interactive run: pass --yes to skip the confirmation prompt.",
      );
      process.exit(1);
    }
    const ans = (await rl.question(`Proceed? [y/N] `)).trim().toLowerCase();
    return ans === "y" || ans === "yes";
  };

  const input = await askVersion();
  const chosen = input || proposed;

  const normalized = chosen.startsWith("v") ? chosen : `v${chosen}`;
  const bareVersion = stripV(normalized);

  if (!parseSemver(normalized)) {
    console.error(`\n✗ Invalid semver tag: ${normalized}`);
    rl?.close();
    process.exit(1);
  }

  if (tags.includes(normalized)) {
    console.error(`\n✗ Tag ${normalized} already exists.`);
    rl?.close();
    process.exit(1);
  }

  console.log(`\nThis will:`);
  console.log(`  1. Bump package.json   ${pkg.version}  →  ${bareVersion}`);
  console.log(`  2. Commit on ${branch}`);
  console.log(`  3. Tag ${normalized} and push ${branch} + tag`);
  console.log(`  4. GitHub Actions will build, test, and publish to npm\n`);

  if (flags.dryRun) console.log("Dry-run mode: no changes will be made.\n");

  const confirmed = await askConfirm();
  rl?.close();

  if (!confirmed) {
    console.log("Aborted.");
    process.exit(0);
  }

  const runStep = makeRunStep(flags.dryRun);

  if (flags.dryRun) {
    console.log(`→ [dry-run] would bump package.json to ${bareVersion}`);
  } else {
    const pkgChanged = await updateVersionFile(PACKAGE_JSON, bareVersion);
    if (!pkgChanged) {
      console.warn("\n⚠ package.json already at target version.");
    } else {
      runStep(`git add package.json`, "git", ["add", "package.json"]);
      runStep(`git commit -m "release: ${normalized}"`, "git", [
        "commit",
        "-m",
        `release: ${normalized}`,
      ]);
    }
  }

  runStep(`git tag ${normalized}`, "git", ["tag", normalized]);

  // Push the commit first so the tag resolves on the remote.
  runStep(`git push origin ${branch}`, "git", ["push", "origin", branch]);

  if (!flags.dryRun) {
    const pushTag = spawnSync("git", ["push", "origin", normalized], {
      stdio: "inherit",
    });
    if (pushTag.status !== 0) {
      console.error("\n✗ Tag push failed. Clean up local tag with:");
      console.error(`  git tag -d ${normalized}`);
      process.exit(pushTag.status ?? 1);
    }
  } else {
    runStep(`git push origin ${normalized}`, "git", [
      "push",
      "origin",
      normalized,
    ]);
  }

  if (flags.dryRun) {
    console.log(
      `\n✓ Dry-run complete. Re-run without --dry-run to actually release ${normalized}.`,
    );
    return;
  }

  console.log(
    `\n✓ Tag ${normalized} pushed. GitHub Actions will build, test, and publish to npm.`,
  );

  const actionsUrl = getRemoteActionsUrl();
  if (actionsUrl) console.log(`  Watch: ${actionsUrl}`);
};

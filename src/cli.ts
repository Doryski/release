#!/usr/bin/env node
import { Command, InvalidArgumentError } from "commander";
import { release } from "./release.js";
import { BumpType } from "./semver.js";

const BUMP_LEVELS = ["major", "minor", "patch"] as const;

const parseBump = (value: string): BumpType => {
  if ((BUMP_LEVELS as readonly string[]).includes(value)) {
    return value as BumpType;
  }
  throw new InvalidArgumentError("--bump must be one of: major, minor, patch");
};

// `--version`/`-V` is reserved by commander for printing its own version, so
// we expose the release-target as `--release-version`.
const program = new Command()
  .name("doryski-release")
  .description("Bump package.json, tag, and push to trigger the npm release.")
  .option(
    "-r, --release-version <ver>",
    "release version (e.g. 0.2.0 or v0.2.0); defaults to a conventional-commit bump of the latest tag",
  )
  .option(
    "--bump <major|minor|patch>",
    "force the bump level (overrides the auto-detected level; ignored when --release-version is set)",
    parseBump,
  )
  .option("-y, --yes", "skip the confirmation prompt", false)
  .option(
    "-n, --dry-run",
    "preview the actions without modifying files, committing, tagging, or pushing",
    false,
  )
  .helpOption("-h, --help", "show help");

type CliFlags = {
  releaseVersion?: string;
  bump?: BumpType;
  yes: boolean;
  dryRun: boolean;
};

program.parse();
const flags = program.opts<CliFlags>();

release({
  releaseVersion: flags.releaseVersion,
  bump: flags.bump,
  yes: flags.yes,
  dryRun: flags.dryRun,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});

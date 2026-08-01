# @doryski/release

A conventional-commit release CLI and a reusable GitHub Actions workflow, shared
across npm packages. One source of truth for "bump, tag, push, publish".

The CLI runs in a consuming repo's root, inspects git history since the latest
tag, proposes a semver bump derived from conventional commits, bumps
`package.json`, commits `release: vX.Y.Z`, and pushes the branch then the tag —
which triggers the reusable workflow to build, test, and publish to npm.

## Install

```bash
pnpm add -D @doryski/release
```

Add a `release` script to your `package.json`:

```json
{
  "scripts": {
    "release": "doryski-release"
  }
}
```

Then run:

```bash
pnpm release
```

## CLI flags

| Flag | Description |
| --- | --- |
| `-r, --release-version <ver>` | Exact release version (`0.2.0` or `v0.2.0`). Highest precedence. |
| `--bump <major\|minor\|patch>` | Force the bump level. Overrides the auto-detected level; ignored when `--release-version` is set. |
| `-y, --yes` | Skip the confirmation prompt (required for non-interactive runs). |
| `--no-changelog` | Skip cutting a `CHANGELOG.md` section for this release. |
| `-n, --dry-run` | Preview actions without modifying files, committing, tagging, or pushing. |
| `-h, --help` | Show help. |

Version precedence: `--release-version` > `--bump` > auto-detected from commits.

The auto-detected bump follows conventional commits since the latest tag:

- a `!`-marked type (e.g. `feat!:`) or a `BREAKING CHANGE:` footer → **major**
- any `feat:` → **minor**
- everything else (`fix`, `chore`, `docs`, …) → **patch**

## Changelog

If the repo has a `CHANGELOG.md`, the CLI cuts a dated section for the release
and includes it in the `release: vX.Y.Z` commit, so the file can never drift
behind the tags. Repos without the file are unaffected; `--no-changelog` opts
out.

The format follows [Keep a Changelog](https://keepachangelog.com/): the new
section goes directly below `## [Unreleased]`, which is left in place, empty and
ready for the next cycle.

Section content comes from one of two places:

- **Hand-written notes win.** Anything under `## [Unreleased]` is promoted
  verbatim into the new version section. Write prose there as you go and the
  release just files it under the right version.
- **Otherwise it is generated** from the conventional commits since the last
  tag: `feat` → `### Added`, `fix` → `### Fixed`, `perf`/`refactor`/`revert` →
  `### Changed`, and anything marked `!` or carrying a `BREAKING CHANGE:` footer
  → `### Breaking Changes`. Scopes render as a bold prefix. Non-user-facing
  types (`chore`, `docs`, `test`, `ci`, `build`, `style`, `release`) are dropped.

Link references are maintained only where the document already uses them: a
`[X.Y.Z]: …/releases/tag/vX.Y.Z` entry is added for the new version, and an
`[Unreleased]: …/compare/vX.Y.Z...HEAD` entry is repointed at it.

When neither source yields anything, `CHANGELOG.md` is left untouched.

## Programmatic use

```ts
import { release } from "@doryski/release";

await release({ bump: "minor", yes: true });
```

## Reusable release workflow

This package ships a reusable workflow at
`Doryski/release/.github/workflows/release.yml`. Consumers add a caller workflow
that triggers on `v*` tags:

```yaml
name: Publish

on:
  push:
    tags:
      - "v*"

jobs:
  release:
    uses: Doryski/release/.github/workflows/release.yml@v1
    permissions:
      contents: write
      id-token: write
    with:
      run-lint: true
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Workflow inputs:

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `node-version` | string | `"20"` | Node version for setup-node. |
| `run-lint` | boolean | `true` | Whether to run `pnpm lint`. |

The workflow runs `install → build → lint (gated) → type-check → test`, verifies
`package.json` matches the tag, publishes with `npm publish --access public
--provenance`, and creates a GitHub Release with generated notes.

The consuming repo must expose `build`, `type-check`, `test`, and (if
`run-lint`) `lint` scripts, and provide an `NPM_TOKEN` secret.

## License

MIT © Dominik Rycharski

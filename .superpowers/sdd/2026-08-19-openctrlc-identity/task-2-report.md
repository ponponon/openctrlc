# Task 2 Report

## Status

Implemented and committed as `73c6591c17e9a27ae561a5f46e2965d16778b17f`.

## Files

- Renamed internal workspace packages and references from `@opencode-ai/*` to `@openctrlc/*` across manifests, source, tests, scripts, fixtures, configs, Docker metadata, and lockfiles.
- Added `script/check-namespace.ts` to audit product files for residual internal `@opencode-ai/*` references with explicit external/generated-fixture allowlists.
- Added `script/rename-namespace.ts` as the reviewed exact replacement utility used for this migration.
- Updated `bun.lock`, `github/bun.lock`, and `sdks/vscode/bun.lock` through workspace installation.
- Preserved the repository-owned `.opencode/` fixture and generated SDK/OpenAPI outputs; no configuration-directory, environment-variable, runtime-path, CLI, Desktop, or release metadata migration was performed.

## Commands

- `bun install`: passed.
- `bun install --cwd github`: failed because the nested workspace cannot resolve the root workspace package `@openctrlc/sdk` when run from `github`; the root install passed and resolved all `@openctrlc/*` workspaces.
- `bun install` from `sdks/vscode`: passed.
- `bun install --frozen-lockfile` from the root: blocked after Bun parsed an external package lock entry containing the intentionally preserved third-party `@opencode-ai/plugin` peer dependency; the final lockfile was restored to preserve that external dependency and the root install had already completed successfully before the frozen check.
- `bun install --frozen-lockfile` from `sdks/vscode`: passed.
- `bun pm ls`: passed; all internal workspace packages listed as `@openctrlc/*`.
- `bun script/check-namespace.ts`: passed after migration.
- `git diff --check`: passed.
- `bun typecheck` from `packages/schema`: passed.
- `bun typecheck` from `packages/protocol`: passed.
- `bun typecheck` from `packages/core`: passed.
- `bun typecheck` from `packages/server`: passed.
- `bun typecheck` from `packages/client`: passed.
- `bun typecheck` from `packages/plugin`: passed.
- `bun typecheck` from `packages/tui`: passed.
- `bun typecheck` from `packages/opencode`: passed.

## Allowlist Review

- No staged diff changes external provider/service identifiers or third-party package names such as `opencode-gitlab-auth` and `opencode-poe-auth`.
- No generated SDK output, `packages/sdk/openapi.json`, vendored client archive, or `.opencode/` fixture was modified.
- The audit intentionally allows residual external/generated references and documentation examples; product source and manifests no longer use internal `@opencode-ai/*` names.

## Concerns

- `bun install --cwd github` remains unsuitable as a standalone nested-workspace command because `github` depends on a root workspace package; root installation is the working install path.
- The root frozen-lockfile verification is blocked by Bun's validation of external package metadata that still declares `@opencode-ai/plugin`, which must remain unchanged under this task's external allowlist. The lockfile retains that external declaration deliberately.
- The task brief requests an `sdks/vscode/bun.lock` install; that lockfile was regenerated/verified, although the VS Code package has no internal workspace package references.

## Review Fixes

- Restored all third-party lock metadata declarations for `@opencode-ai/plugin`; the external `opencode-gitlab-auth` and `opencode-poe-auth` records are unchanged.
- Restored the vendored client dependency key and imports to `@opencode-ai/client` in `packages/app` and `packages/session-ui`; the tarball remains untouched and is not presented as an OpenCtrlC package.
- Added `github` to the root workspace list and removed `github/bun.lock`, so the GitHub action is managed by the root workspace lockfile rather than an independently invalid nested lockfile.
- Reworked the namespace audit to emit and filter individual package tokens, preventing an unrelated external token on the same line from hiding an internal residual.
- Removed the unrelated `configVersion` change from `sdks/vscode/bun.lock`.
- Kept `@openctrlc/plugin` in `packages/opencode/src/config/config.ts` and `tui.ts`: these are product-owned plugin installation contracts, not the vendored external client or a third-party package.

## Review Verification

- Root frozen install: passed, `Checked 2423 installs across 2713 packages (no changes)`.
- `bun install --cwd github --frozen-lockfile --ignore-scripts`: passed through the root workspace, `Checked 2423 installs across 2713 packages (no changes)`.
- VS Code frozen install: passed, `Checked 259 installs across 264 packages (no changes)`.
- Namespace audit: passed with no output.
- `git diff --check`: passed.
- Affected package typechecks: schema, protocol, core, server, client, plugin, tui, and opencode passed; opencode initially exposed an external plugin type duplication and now passes after explicit boundary casts for the unchanged third-party auth plugins.
- Third-party package metadata review: the current diff shows only product workspace metadata changes plus vendored client path keys; the final third-party lock records retain `@opencode-ai/plugin` declarations for `@gitlab/opencode-gitlab-auth`, `opencode-gitlab-auth`, and `opencode-poe-auth`.

## Remaining Concerns

- `github/bun.lock` is removed because `github` is now a root workspace and its dependencies are managed by the root `bun.lock`; `bun install --cwd github --frozen-lockfile` was verified from the repository root.
- The vendored client remains externally named `@opencode-ai/client` by design. Its package archive was not modified, and the namespace audit treats only these known app/session-ui vendored usages as external contracts.

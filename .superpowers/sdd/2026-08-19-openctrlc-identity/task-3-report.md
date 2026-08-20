# Task 3 Report

## Files

- Core and opencode project config discovery now use `.openctrlc`, `openctrlc.json`, and `openctrlc.jsonc`.
- Product-owned environment readers and tests now use `OPENCTRLC_*`.
- Plugin, skill, MCP, agent, plan, theme, TUI, server auth, CLI build, and provider-facing config helpers were updated.
- External provider IDs, `opencode.ai` service URLs, `models.opencode.ai`, and provider-specific `OPENCODE_API_KEY` remain unchanged.

## Commands

- `cd packages/core && bun test test/config/config.test.ts test/global.test.ts`: `19 pass, 0 fail`.
- `cd packages/opencode && bun test test/config/config.test.ts test/config/tui.test.ts test/plugin/install.test.ts test/plugin/install-concurrency.test.ts test/cli/mcp-add.test.ts`: `156 pass, 3 skip, 0 fail`.
- `cd packages/core && bun typecheck`: exit `0`.
- `cd packages/opencode && bun typecheck`: exit `0`.
- `cd packages/tui && bun typecheck`: exit `0`.
- `git diff --check`: exit `0`.
- `cd packages/core && bun test test/config/config.test.ts test/global.test.ts`: `20 pass, 0 fail`.
- `cd packages/opencode && bun test test/config/config.test.ts test/config/tui.test.ts test/plugin/install.test.ts test/plugin/install-concurrency.test.ts test/cli/mcp-add.test.ts test/util/filesystem.test.ts test/agent/agent.test.ts`: `261 pass, 3 skip, 0 fail`.
- `cd packages/sdk/js && bun test test/server-config-env.test.ts test/session-history.test.ts`: `2 pass, 0 fail`.
- `cd script && bun test ./translate-app.test.ts`: `16 pass, 0 fail`.
- `cd packages/core && bun typecheck`: exit `0`.
- `cd packages/opencode && bun typecheck`: exit `0`.
- `cd packages/sdk/js && bun typecheck`: exit `0`.
- `cd packages/server && bun typecheck`: exit `0`.
- `cd packages/tui && bun typecheck`: exit `0`.
- `git diff --check`: exit `0`.
- Legacy-read audit: no product-owned `OPENCODE_*` environment reads remain in Core, opencode, Server, TUI, CLI, or UI source. Remaining OpenCode strings are external provider IDs, external service URLs, third-party metadata, or explicitly out-of-scope Desktop/release metadata.

## Concerns

- The requested Task 3 scope touches shared Core/Server/TUI/CLI config readers and their tests; Desktop runtime and release metadata were not migrated.
- Repository-local user changes were preserved. The implementation commit also includes the pre-existing untracked plan file because the requested commit command staged the repository plan path.

## Commit

`0b50804 refactor(config): rename OpenCtrlC project namespace`

## Review Fixes

- `Config.update()` now selects an existing `openctrlc.jsonc` or `openctrlc.json`, defaulting to `Brand.configFile`; it no longer writes `config.json`.
- SDK JS v1/v2 server helpers inject `OPENCTRLC_CONFIG_CONTENT` without changing their public function names.
- Translation tooling, relevant GitHub workflow configuration, CLI build metadata inputs, and product process markers use the OpenCtrlC namespace. Provider API keys, provider IDs, schema URLs, and external service URLs remain unchanged.
- Product config fixtures and tests use `.openctrlc`, `openctrlc.json`, and `openctrlc.jsonc`; external provider recorded fixtures were not renamed.
- The embedded customization guidance now documents OpenCtrlC paths and `OPENCTRLC_*` escape hatches while retaining the external `https://opencode.ai/config.json`, provider IDs, and third-party plugin names.
- Added root legacy filename rejection coverage, old environment variable rejection coverage, SDK source injection coverage, and translation script namespace coverage.

## Review Fix Verification

- `cd packages/core && bun test test/config/config.test.ts test/global.test.ts`: `20 pass, 0 fail`.
- `cd packages/opencode && bun test test/config/config.test.ts test/config/tui.test.ts test/plugin/install.test.ts test/plugin/install-concurrency.test.ts test/cli/mcp-add.test.ts test/util/filesystem.test.ts test/agent/agent.test.ts`: `261 pass, 3 skip, 0 fail` after the final fixture correction.
- `cd packages/sdk/js && bun test test/server-config-env.test.ts test/session-history.test.ts`: `2 pass, 0 fail`.
- `cd script && bun test ./translate-app.test.ts`: `16 pass, 0 fail`.
- `cd packages/core && bun typecheck`: exit `0`.
- `cd packages/opencode && bun typecheck`: exit `0`.
- `cd packages/sdk/js && bun typecheck`: exit `0`.
- `cd packages/server && bun typecheck`: exit `0`.
- `cd packages/tui && bun typecheck`: exit `0`.
- `git diff --check`: exit `0`.

## Remaining Concerns

- Desktop runtime identity and release metadata remain intentionally out of scope for Task 3.
- External OpenCode provider/service identifiers remain intentionally unchanged, including `ProviderV2.ID.opencode`, `opencode.ai`, `models.opencode.ai`, and `OPENCODE_API_KEY`.
- Desktop build/runtime channel variables and Desktop identity remain intentionally out of scope; workflow product build inputs were renamed only where they feed the already-migrated CLI build metadata.

## Review Fix Commit

`a4f0803 fix(config): complete OpenCtrlC namespace migration`

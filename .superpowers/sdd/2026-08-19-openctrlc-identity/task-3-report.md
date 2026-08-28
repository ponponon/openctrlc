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

## Scoped Re-Review Fixes

- Tracked repository project configuration was renamed from `.opencode/` to `.openctrlc/`, including config, agents, commands, skills, plugins, themes, tools, and glossaries. Product-owned test fixtures were updated while external provider recorded data and provider IDs remain unchanged.
- Compile-time product defines now match consumers: `OPENCTRLC_MODELS_DEV`, `OPENCTRLC_WORKER_PATH`, and `OPENCTRLC_LIBC`; the app Vite channel input/consumer now uses `OPENCTRLC_CHANNEL` while retaining the existing renderer-facing channel key contract.
- Desktop/release channel consumers remain on old variables; the publish workflow's Desktop steps were restored to `OPENCODE_VERSION`/`OPENCODE_CHANNEL` to avoid breaking the later Desktop boundary.
- Removed global `config.json` loading and TOML migration output from opencode config loading. Global config now only loads `openctrlc.json` and `openctrlc.jsonc`.
- Added real `Config.update()` JSON/JSONC discovery coverage, root old filename rejection coverage, SDK env injection coverage, and script namespace coverage.
- Customized the embedded skill to describe project paths and `OPENCTRLC_*` flags without inventing an OpenCtrlC global XDG directory or changing schema URLs/provider IDs.

## Scoped Re-Review Verification

- `cd packages/core && bun test test/config/config.test.ts test/global.test.ts test/location-layer.test.ts`: `24 pass, 0 fail`.
- `cd packages/opencode && bun test test/config/config.test.ts test/config/tui.test.ts test/plugin/install.test.ts test/plugin/install-concurrency.test.ts test/cli/mcp-add.test.ts test/cli/tui/plugin-loader.test.ts test/tool/registry.test.ts test/server/httpapi-provider.test.ts test/server/httpapi-sdk.test.ts test/util/filesystem.test.ts test/agent/agent.test.ts`: `314 pass, 4 skip, 0 fail`.
- `cd packages/sdk/js && bun test test/server-config-env.test.ts test/session-history.test.ts`: `2 pass, 0 fail`.
- `cd script && bun test ./translate-app.test.ts`: `16 pass, 0 fail`.
- `cd packages/core && bun typecheck`: exit `0`.
- `cd packages/opencode && bun typecheck`: exit `0`.
- `cd packages/sdk/js && bun typecheck`: exit `0`.
- `cd packages/server && bun typecheck`: exit `0`.
- `cd packages/tui && bun typecheck`: exit `0`.
- `bun install --frozen-lockfile --ignore-scripts`: exit `0`, `Checked 2424 installs across 2713 packages`.
- `git diff --check`: exit `0`.

## Scoped Re-Review Concerns

- Desktop runtime identity and release metadata remain intentionally out of scope. Desktop publish workflow variables remain legacy-compatible until the Desktop boundary.
- External `ProviderV2.ID.opencode`, `opencode.ai`, `models.opencode.ai`, schema URLs, and `OPENCODE_API_KEY` remain unchanged.

## Review Fix Commit

`54d7d0d fix(config): finish OpenCtrlC config namespace`

## Latest Scoped Review Fixes

- Unified app channel consumers with the actual Vite define: `VITE_OPENCTRLC_CHANNEL`.
- Updated the config HttpApi fixture to assert `openctrlc.json` output and no legacy `config.json` output.
- Restored external provider transform semantics and kept the recorded console/provider identifiers unchanged; the native recorded config fixture now uses `openctrlc.json`.
- Updated product-owned initialize templates and development documentation to `.openctrlc/openctrlc.jsonc` or `openctrlc.json`.
- Added root legacy filename rejection and OpenCtrlC config update coverage; global `config.json` loading/TOML migration remains removed.
- Renamed remaining tracked repository `.opencode/` content and product test fixtures to `.openctrlc/`; provider IDs and external URL fixtures were excluded.
- Fixed product build defines and app channel consumption, while Desktop/release consumers remain on legacy channel variables by design.
- Kept this report untracked from the implementation commit. The approved `docs/superpowers/plans/` document was preserved.

## Latest Scoped Review Verification

- `cd packages/core && bun test test/config/config.test.ts test/global.test.ts test/location-layer.test.ts`: `24 pass, 0 fail`.
- `cd packages/opencode && bun test test/config/config.test.ts test/config/tui.test.ts test/plugin/install.test.ts test/plugin/install-concurrency.test.ts test/cli/mcp-add.test.ts test/cli/tui/plugin-loader.test.ts test/tool/registry.test.ts test/server/httpapi-provider.test.ts test/server/httpapi-sdk.test.ts test/server/httpapi-config.test.ts test/util/filesystem.test.ts test/agent/agent.test.ts`: `314 pass, 4 skip, 0 fail`.
- `cd packages/sdk/js && bun test test/server-config-env.test.ts test/session-history.test.ts`: `2 pass, 0 fail`.
- `cd script && bun test ./translate-app.test.ts`: `16 pass, 0 fail`.
- `cd packages/app && bun typecheck`: exit `0`.
- `cd packages/core && bun typecheck`: exit `0`.
- `cd packages/opencode && bun typecheck`: exit `0`.
- `cd packages/sdk/js && bun typecheck`: exit `0`.
- `cd packages/server && bun typecheck`: exit `0`.
- `cd packages/tui && bun typecheck`: exit `0`.
- `bun install --frozen-lockfile --ignore-scripts`: exit `0`.
- `git diff --check`: exit `0`.
- Tracked legacy path audit: no tracked `.opencode/` directories or root `opencode.json(c)` fixtures remain.

## Latest Concerns

- Desktop app identity, Desktop runtime/release consumers, CLI bin, and Core XDG runtime paths remain intentionally out of scope for Task 3.
- External `ProviderV2.ID.opencode`, `https://opencode.ai`, `https://api.opencode.ai`, `https://console.opencode.ai`, `models.opencode.ai`, `OPENCODE_API_KEY`, and `OTEL_*` remain unchanged.

## Latest Review Fix Commit

`5ad476a fix(config): close OpenCtrlC config migration gaps`

## Latest Scoped Review Fixes

- Removed all tracked repository `.opencode/` directories and renamed the repository-owned `.opencode/opencode.jsonc` fixture to `.openctrlc/openctrlc.jsonc`; updated product-owned command, skill, plugin, glossary, theme, provider, HTTP API, registry, and location fixtures. External recorded/provider identifiers remain unchanged.
- Unified app channel input around `OPENCTRLC_CHANNEL` and `VITE_OPENCTRLC_CHANNEL`.
- Changed opencode build defines for models, worker path, and libc to `OPENCTRLC_*`; restored Desktop publish workflow channel/version consumers to legacy names because Desktop remains a later boundary.
- Removed global `config.json` loading and TOML migration output; config discovery now only considers `openctrlc.json` and `openctrlc.jsonc` plus explicit OpenCtrlC overrides.
- Updated config HTTP API and recorded-session fixtures, initialize templates, and development documentation. `Config.update()` tests cover JSON/JSONC write and rediscovery behavior, including no legacy `config.json` creation.
- Kept `https://opencode.ai/config.json`, `https://api.opencode.ai`, `https://console.opencode.ai`, `ProviderV2.ID.opencode`, `providerOptions.opencode`, `OPENCODE_API_KEY`, and `OTEL_*` unchanged.
- Kept this report outside the implementation commit; the approved `docs/superpowers/plans/` document remains tracked.

## Latest Scoped Review Verification

- `cd packages/core && bun test test/config/config.test.ts test/global.test.ts test/location-layer.test.ts`: `24 pass, 0 fail`.
- `cd packages/opencode && bun test test/config/config.test.ts test/config/tui.test.ts test/plugin/install.test.ts test/plugin/install-concurrency.test.ts test/cli/mcp-add.test.ts test/cli/tui/plugin-loader.test.ts test/tool/registry.test.ts test/server/httpapi-provider.test.ts test/server/httpapi-sdk.test.ts test/server/httpapi-config.test.ts test/util/filesystem.test.ts test/agent/agent.test.ts`: `316 pass, 4 skip, 0 fail`.
- `cd packages/sdk/js && bun test test/server-config-env.test.ts test/session-history.test.ts`: `2 pass, 0 fail`.
- `cd script && bun test ./translate-app.test.ts`: `16 pass, 0 fail`.
- `cd packages/core && bun typecheck`: exit `0`.
- `cd packages/opencode && bun typecheck`: exit `0`.
- `cd packages/sdk/js && bun typecheck`: exit `0`.
- `cd packages/server && bun typecheck`: exit `0`.
- `cd packages/tui && bun typecheck`: exit `0`.
- `bun install --frozen-lockfile --ignore-scripts`: exit `0`.
- `git diff --check`: exit `0`.

## Latest Concerns

- Desktop app identity, Desktop runtime/release consumers, CLI bin, and Core XDG runtime paths remain intentionally out of scope for Task 3.
- External OpenCode service/provider identifiers remain intentionally unchanged.

## Round 4 Review Fixes

- Restored `packages/opencode/test/provider/transform.test.ts` external provider contract: `https://api.opencode.ai`, `providerOptions.opencode`, and `Provider ID` value `opencode`.
- Updated product-owned documentation paths and variables across the root and multilingual docs to `.openctrlc`, `openctrlc.json(c)`, and `OPENCTRLC_*`; external provider names, schema URLs, `OPENCODE_API_KEY`, and external service URLs remain unchanged.
- Updated namespace audit scripts to ignore `.openctrlc/`; translation namespace assertions now use only the OpenCtrlC namespace.
- Added old-variable rejection tests for `OPENCODE_CONFIG_DIR` and `OPENCODE_DISABLE_PROJECT_CONFIG`, while asserting the corresponding `OPENCTRLC_*` values take effect.
- Strengthened `Config.update()` JSON and JSONC tests to dispose and rediscover the instance, verify the updated value is loaded, and verify no `config.json` is created.
- Kept this report out of the implementation commit; it is appended locally for the next handoff.

## Round 4 Verification

- `cd packages/core && bun test test/config/config.test.ts test/global.test.ts test/location-layer.test.ts && bun typecheck`: `24 pass, 0 fail`; typecheck exit `0`.
- `cd packages/opencode && bun test test/config/config.test.ts test/config/tui.test.ts test/server/httpapi-config.test.ts test/server/httpapi-provider.test.ts test/server/httpapi-sdk.test.ts test/cli/tui/plugin-loader.test.ts test/provider/transform.test.ts test/provider/provider.test.ts test/session/llm-native-recorded.test.ts && bun typecheck`: `687 pass, 5 skip, 0 fail`; typecheck exit `0`.
- `cd packages/sdk/js && bun test test/server-config-env.test.ts && bun typecheck`: `1 pass, 0 fail`; typecheck exit `0`.
- `cd packages/app && bun typecheck`: exit `0`.
- `cd script && bun test ./translate-app.test.ts`: `16 pass, 0 fail`.
- `bun install --frozen-lockfile --ignore-scripts`: exit `0`, `Checked 2424 installs across 2713 packages (no changes)`.
- `git diff --check`: exit `0`.
- Residual audit: no product-owned `.opencode`, `opencode.json(c)`, `OPENCODE_CONFIG_DIR`, or `OPENCODE_DISABLE_PROJECT_CONFIG` remains in docs, audit scripts, or product test fixtures; provider and external-contract residuals remain intentional.

## Round 4 Concerns

- Desktop app identity, Desktop runtime/release consumers, CLI bin, and Core XDG runtime paths remain intentionally out of scope for Task 3.
- External `ProviderV2.ID.opencode`, `providerOptions.opencode`, `https://opencode.ai`, `https://api.opencode.ai`, `https://console.opencode.ai`, `models.opencode.ai`, schema URLs, `OPENCODE_API_KEY`, and third-party metadata remain unchanged.

## Round 4 Commit

`fix(config): finalize OpenCtrlC namespace migration`

Commit: `ce3ee65`

## Final Review Fixes

- Updated product-owned specs and context documents to use `.openctrlc`, `openctrlc.json(c)`, and `OPENCTRLC_*`, including TUI plugin, Effect, v2 config/session/schema, provider-policy, and root context guidance.
- Restored managed preference documentation and test metadata to the implemented `ai.opencode.managed` domain. This remains the external/future Desktop contract; Task 3 does not migrate the managed preference implementation.
- Split config-directory rejection coverage into two isolated tests: one sets only `OPENCODE_CONFIG_DIR` and proves it has no effect; the other sets only `OPENCTRLC_CONFIG_DIR` and proves it is effective.
- Updated the root ignore rules to `/openctrlc.json` and `/openctrlc.jsonc`.

## Final Verification

- `cd packages/core && bun test test/config/config.test.ts test/global.test.ts test/location-layer.test.ts`: `24 pass, 0 fail`.
- `cd packages/opencode && bun test test/config/config.test.ts test/config/tui.test.ts test/server/httpapi-config.test.ts`: `136 pass, 3 skip, 0 fail`.
- `cd packages/core && bun typecheck`: exit `0`.
- `cd packages/opencode && bun typecheck`: exit `0`.
- `bun install --frozen-lockfile --ignore-scripts`: exit `0`, `Checked 2424 installs across 2713 packages (no changes)`.
- `git diff --check`: exit `0`.
- Residual audit: normal product-owned discovery/documentation paths contain no `.opencode`, `opencode.json(c)`, or product-owned `OPENCODE_*` configuration names. The old `OPENCODE_CONFIG_DIR` appears only in the intentionally negative rejection test. `ai.opencode.managed` remains in managed implementation, test metadata, and documentation as the external/future Desktop contract. Provider IDs, provider option namespaces, external URLs, schema URLs, `OPENCODE_API_KEY`, and `OTEL_*` remain intentional external or out-of-scope boundaries.

## Final Concerns

- Desktop app identity, Desktop runtime/release consumers, CLI bin, Core XDG runtime paths, and managed preference implementation remain intentionally out of scope for Task 3.
- The report remains in `.superpowers` scratch and is not included in the implementation commit.

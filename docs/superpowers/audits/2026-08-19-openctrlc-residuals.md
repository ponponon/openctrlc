# OpenCtrlC Residual Namespace Audit

Date: 2026-08-21

## Result

The product-owned OpenCtrlC namespace is used for the current CLI, runtime
directories, project configuration, environment flags, Desktop identity,
enterprise deployment, VS Code integration, web/console entrypoints, and
distribution metadata. This pass also removed product-owned installation,
upgrade, documentation, security, `.openctrlc`, and multilingual Web residuals.

No generated client output was edited. `packages/client` generation and the
generated-output drift check passed.

## Audit Commands

The broad searches were run without `node_modules`, `dist`, or `bun.lock`:

```bash
rg -n '@opencode-ai/|OPENCODE_|\.opencode|opencode\.jsonc?|opencode\.json' \
  --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!bun.lock' .
rg -n 'path\.(join|resolve)\([^)]*opencode|import\([^)]*opencode|require\([^)]*opencode' packages script github
git grep -n -I -E 'OPENCODE_BIN_PATH|\.opencode|opencode\.jsonc?|opencode\.json|OPENCODE_' \
  -- ':!bun.lock' ':!**/dist/**'
```

Existing authoritative checks also passed:

```bash
bun script/check-namespace.ts
bun script/check-distribution.ts
cd packages/client && bun run check:generated
git diff --check
```

The namespace audit covers internal `@opencode-ai/*` package names while
allowlisting documented external package contracts. The distribution audit
covers package bins, platform artifacts, postinstall targets, Desktop CLI
artifacts, Nix metadata, workflows/actions, installer paths, download routes,
publisher targets, generated imports, and tracked README release guidance.

The namespace script does not globally ignore Markdown anymore. It audits the
formal `.openctrlc/` configuration, product Web documentation, and the Core
built-in skill Markdown; other historical design/specification Markdown remains
documentation of prior namespaces and is separately reviewed as non-runtime
history.

The formal checks pass after the final product fix commit. The only remaining
OpenCode strings in the audited Web documentation are explicit external
provider/client examples or hosted-service/legal contracts.

The final scoped residual search reports 65 matches in the product Web/console
scope. They are limited to the explicit `ai-sdk-provider-opencode-sdk` rows
using the external `@opencode-ai/sdk`, third-party plugin names such as
`opencode-google-antigravity-auth`, external provider IDs such as
`opencode-go`, and retained `opencode.ai` hosted legal/provider/Discord
contracts. Product-owned install commands, runtime paths, package names, CLI
commands, and configuration paths are not in that set.

## Classification

### Fixed Product-Owned Residuals

- `packages/opencode/bin/openctrlc`: `OPENCODE_BIN_PATH` was a product CLI
  binary override and is now `OPENCTRLC_BIN_PATH`.
- `packages/cli/bin/openctrlc.cjs`: the same product CLI binary override is now
  `OPENCTRLC_BIN_PATH`.
- `packages/opencode/test/cli/contract.test.ts` asserts both wrappers use only
  the new override name.
- Installation upgrade/latest now targets `openctrlc.ai/install`,
  `ponponon/openctrlc` releases, the OpenCtrlC Homebrew tap, `openctrlc-ai`,
  and OpenCtrlC Chocolatey/Scoop targets.
- Console/Web installation snippets use `openctrlc.ai/install`,
  `openctrlc-ai`, `openctrlc`, `openctrlc-bin`, and `ponponon/openctrlc`.
- Console product titles, 404 links, authentication command examples, and
  installation tabs use OpenCtrlC identity; remaining console `opencode.ai`
  references are external hosted-service, provider, or legal contracts.
- Console API proxy, enterprise-host proxy, social/Discord links, and auth meta
  names use the OpenCtrlC route contracts; retained legal and provider domains
  remain external.
- Formal `.openctrlc/openctrlc.jsonc` references use `openctrlc` names and
  `~/.local/share/openctrlc`.
- The Korean IME patch defaults to the `ponponon/openctrlc` repository,
  OpenCtrlC directories, `openctrlc` binary, and `openctrlc.ai/install`.
- SECURITY.md uses OpenCtrlC product language, `OPENCTRLC_SERVER_PASSWORD`,
  and `ponponon/openctrlc` security advisories.

### Intentional External Service And Provider Contracts

These are not OpenCtrlC-owned namespace values and must remain stable:

- `ProviderV2.ID.opencode`, `providerOptions.opencode`, provider model IDs, and
  provider-specific `OPENCODE_API_KEY`.
- `https://opencode.ai`, `https://app.opencode.ai`, `https://api.opencode.ai`,
  `https://console.opencode.ai`, and `https://models.opencode.ai` service
  endpoints, including the external `https://opencode.ai/config.json` schema.
- External GitHub App/OIDC and OAuth identities, including
  `opencode-agent[bot]`, `opencode-github-action`, and the API exchange
  endpoints.
- Third-party packages and package metadata such as `opencode-gitlab-auth`,
  `opencode-poe-auth`, `@opencode-ai/plugin`, and `@opencode-ai/sdk` where they
  are consumed as external integrations or recorded contract data.
- The `ai-sdk-provider-opencode-sdk` ecosystem entry remains an explicit
  third-party integration example; its package and `@opencode-ai/sdk` import
  are not owned by this fork.
- External IDE extension identifiers such as `sst-dev.opencode` and external
  managed-preference domain `ai.opencode.managed`.
- The VS Code extension publisher remains `sst-dev`: this is the existing
  third-party Marketplace publishing identity, while the extension package,
  display name, commands, terminal name, CLI invocation, and environment
  markers are OpenCtrlC-owned and have been migrated.
- The 18 `ai-sdk-provider-opencode-sdk` ecosystem rows retain
  `@opencode-ai/sdk` as the third-party package contract. Other product SDK
  examples use `@openctrlc/sdk`; no `@openctrlc-ai/*` package exists.
- `opencode-go` is retained only as the external OpenCode Go provider/model ID;
  it is not a CLI, package, runtime path, or configuration directory.

The external-provider and service strings are present in provider adapters,
OAuth/API tests, recorded fixtures, models metadata, schema declarations, and
localized provider documentation. Renaming them would change an external
protocol or credential contract.

The same allowlist applies to the final Web and Console scan: `opencode.ai`,
`api.opencode.ai`, `models.dev`, provider/API/OAuth identifiers, third-party
vendor package and action names, the existing `sst-dev` Marketplace publisher,
and `security@anoma.ly` as the inherited external security-team escalation
contact remain unchanged. Product-owned CLI commands, installation targets,
configuration paths, release repositories, docs hosts, social links, and brand
download names are excluded from this allowlist.

The VS Code Marketplace publisher is intentionally not claimed as migrated:
`sst-dev` remains the existing external publishing identity because no new
OpenCtrlC Marketplace publisher was supplied. Product-facing extension
identity is migrated independently.

### Negative And Compatibility Tests

The following old names are deliberately present as assertions that old
product configuration has no effect. They are not runtime fallbacks:

- `opencode.json` and `opencode.jsonc` fixtures in Core config tests.
- `OPENCODE_CONFIG_CONTENT`, `OPENCODE_CONFIG_DIR`, and
  `OPENCODE_DISABLE_PROJECT_CONFIG` in rejection tests.
- `OPENCODE_BIN_PATH` in the wrapper contract test's negative assertion.

The test-only `OPENCODE_HTTPAPI_EXERCISE_*` controls and generic process-test
variables are likewise test harness controls, not product configuration reads.

### Internal Historical Protocol And Implementation Fields

Some remaining identifiers are internal names whose compatibility is explicit
or whose scope is not the product identity boundary:

- `x-opencode-directory` request headers and related server/client protocol
  fields.
- `engines.opencode`, `opencode.mode`, `OPENCODE_BASE_MODE`, and similar TUI
  or plugin metadata keys.
- Existing generated/API fixture names and source paths such as the workspace
  directory `packages/opencode`.
- `@opencode-ai/client` in the app's external vendor package contract and
  generated SDK fixtures; generated output remains generator-owned.

### Product-Owned Release And Installation Boundary Fixed In This Pass

The product-owned installation and uninstall paths now use `openctrlc-ai`,
`openctrlc`, `.openctrlc/bin`, the OpenCtrlC installer URL, and the
`ponponon/openctrlc` release repository. The old package-manager names and
`.opencode/bin` cleanup markers are no longer active product paths.

The final web/console scan also distinguishes retained external hosted-service
content from product-owned entrypoints. OpenCtrlC install commands, release
repositories, CLI names, runtime paths, and workspace package examples use the
OpenCtrlC namespace. Retained legal/hosted-service pages, provider IDs, API and
schema URLs, external GitHub Action references, brand asset filenames, and the
third-party `ai-sdk-provider-opencode-sdk` example remain external contracts.

## Isolated Runtime Verification

The built current-platform binary was used because `openctrlc` is not
installed on the host PATH:

```bash
packages/opencode/dist/openctrlc-darwin-arm64/bin/openctrlc --version
packages/opencode/dist/openctrlc-darwin-arm64/bin/openctrlc --help
packages/opencode/dist/openctrlc-darwin-arm64/bin/openctrlc serve --help
```

With fresh temporary `HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`,
`XDG_CONFIG_HOME`, `XDG_STATE_HOME`, and `TMPDIR`, the commands returned zero.
Only `openctrlc` runtime directories were created under the supplied roots:

- `data/openctrlc/log`
- `data/openctrlc/repos`
- `cache/openctrlc/bin`
- `config/openctrlc`
- `state/openctrlc`
- `tmp/openctrlc`

No `opencode` or `.opencode` directory was created.

A second isolated run pre-created old `opencode` directories and an old
`.opencode` home directory, and set `OPENCODE_TEST_HOME` to a separate old
home. The version command still created/used only the new XDG paths. The old
home was unchanged; pre-existing old directories were not read or extended.

The wrapper override checks also verified that `OPENCTRLC_BIN_PATH` selects the
binary and an invalid `OPENCODE_BIN_PATH` does not replace it in the product
wrapper contract.

## Verification Summary

- Core full suite: `1096 pass, 0 fail`; `bun typecheck` passed.
- OpenCode full suite baseline: `3304 pass, 5 fail, 22 skip, 1 todo`. The five
  failures recorded by the previous audit were:
  `cf-ai-gateway routing > anthropic/* rides the native Anthropic passthrough
  on the Messages API`, `cf-ai-gateway end-to-end (regression: #24432) >
  reasoning effort variants for anthropic models land as native adaptive
  thinking`, `cf-ai-gateway token scoping (regression: #32051/#32052) >
  anthropic passthrough does NOT forward the Cloudflare token upstream`,
  `HttpApi instance route authorization > requires configured auth before
  opening the instance event stream`, and `HttpApi instance route
  authorization > requires configured auth before resolving the PTY websocket
  route`. Raw output was captured in
  `/Users/ponponon/.local/share/opencode/tool-output/tool_022df5274001S3gcqi28puAwRT`:
  three `provider "anthropic.messages" is currently not supported` errors,
  two auth expectation failures, and the summary `5 tests failed` / `3304
  pass`. These are unrelated provider/auth environment failures.
- OpenCode CLI contract: `5 pass, 0 fail`; `bun typecheck` passed.
- Core skill residual test: `1 pass, 0 fail`; `bun typecheck` passed.
- App production build: passed; app `bun typecheck` passed.
- Desktop `bun run build`: blocked by unpublished npm package
  `openctrlc-darwin-arm64` returning HTTP 404 after the app/server prebuild.
  Desktop `bun typecheck` was not blocked by this package download in the
  earlier package verification, while direct Electron Vite packaging was
  previously verified by Task 6.
- Client generated check: `bun run check:generated` passed after generation;
  generated directories were not manually changed.
- Web production build: passed after the final documentation migration.
- Console app typecheck: passed.
- Platform packaging commands `bun run package:mac`, `package:win`, and
  `package:linux` were not run because the host is macOS and the current
  package download target is unpublished.
- `~/.agents/instructions/script/test-proxy.sh` ran before external access;
  QuickQ `127.0.0.1:10025` and Clash Verge `127.0.0.1:7897` were available.
- `actionlint` was not run because it is not installed on the host.
- `nix flake check --no-update-lock-file` was not run because `nix` is not
  installed on the host.
- `bunx astro check` remains blocked by 15 pre-existing `Share.tsx`/session
  type errors unrelated to namespace changes; the Web production build passes.
- Enterprise full suite remains blocked without external R2 storage
  configuration; the namespace identity test and typecheck pass.

## Concerns

- The installed command is not available on this host PATH, so smoke coverage
  used the built binary rather than `openctrlc` from a package-manager install.
- Direct execution of `packages/opencode/bin/openctrlc` with Node is not a
  valid smoke path while the package is marked `type: module` and the extensionless
  wrapper uses CommonJS `require`; the built binary and package contract tests
  remain the authoritative CLI checks.
- Existing changes in `.superpowers/sdd/.../task-3-report.md` and
  `task-4-report.md` were preserved and are not part of this audit commit.
- The installation/uninstall old-package residuals listed above remain for a
  future explicit migration decision; this task records them rather than
  introducing a compatibility or removal behavior.

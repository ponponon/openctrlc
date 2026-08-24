# OpenCtrlC Residual Namespace Audit

Date: 2026-08-24

## Current Result

The historical product boundary for this audit is:

`ffc81a94685bede3e24647b279b15883de66d745 fix(identity): close source allowlist bypasses`

The historical audit boundary before the later repair is:

`4f515e61ad7064d499c02f5ab2e78f47c40d37b5 docs(identity): record OpenCtrlC namespace audit`

The historical chain is: product repair `ffc81a94685bede3e24647b279b15883de66d745`
has parent `eb38fc1a2822b93edbfa8810bb12bc58ef87c31e`; audit boundary
`4f515e61ad7064d499c02f5ab2e78f47c40d37b5` has parent
`ffc81a94685bede3e24647b279b15883de66d745`.

For the previous subsequent review round, the product fix is
`e5e33c9aa836a2068ae01ae251e44df01a27540e fix(identity): close final audit boundary gaps`,
whose parent is `4f515e61ad7064d499c02f5ab2e78f47c40d37b5`. The current audit
commit `4232dd8ea07c7a904268852d15c0a754334936a9` had that product fix as its
parent. The current product fix is
`fe8c0aa3ae236746c45d8a8c7631f2995599afe1 fix(identity): close final audit verification gaps`,
whose parent is `4232dd8ea07c7a904268852d15c0a754334936a9`.

The runtime and persistence audit repair under review is
`4b84c063586046370f9f6d9923b1896103e7430a fix(identity): automate final runtime and persistence audit`,
whose parent is `5d191691b53e9518445bfb404f41ba25b9945f66`. The audit commit
for that repair is `f64503569cae8aa78fbd999fa7a78f876e88b25e docs(identity): record OpenCtrlC namespace audit`,
whose parent is `4b84c063586046370f9f6d9923b1896103e7430a`. The verified
historical chain is
`5d191691b53e9518445bfb404f41ba25b9945f66 -> 4b84c063586046370f9f6d9923b1896103e7430a -> f64503569cae8aa78fbd999fa7a78f876e88b25e`.

The follow-up product repair is
`c5d2a79 fix(identity): isolate runtime legacy-variable audit`, whose full SHA
is `c5d2a797ba83bb9307e77bc1e66e2010828b15bb` and whose parent is
`f64503569cae8aa78fbd999fa7a78f876e88b25e`. This audit document is validated
by that parent audit commit. The current audit commit is created with
`c5d2a797ba83bb9307e77bc1e66e2010828b15bb` as its parent and is intentionally
not embedded here to avoid self-reference.

The product-owned residual checks now cover the complete App E2E TypeScript
fixture tree, including performance helpers and fixtures. The only old
persistence key is the exact negative migration fixture
`e2e/regression/legacy-new-session.spec.ts`; all other scanned fixtures reject
old `opencode.*.dat` keys and the timeline and cross-server fixtures assert
the new `openctrlc.*.dat` keys.

The persistence audit dynamically collects all OpenCtrlC persistence literals,
compares the complete per-fixture result with the expected set, and explicitly
classifies remaining fixtures as having no persistence literals. The only old
persistence key remains the exact negative migration fixture
`e2e/regression/legacy-new-session.spec.ts`.

The App i18n parity test dynamically loads all 62 App locales, including
English, and verifies the external OpenCode Zen copy retains the exact
`opencode.ai/zen` link value and expected key structure, while rejecting the
OpenCtrlC product identity and URL scheme in that provider copy.

## Product Changes

- MCP OAuth client metadata uses `Brand.name` for `client_name` and the
  OpenCtrlC canonical product URI `https://openctrlc.ai` for `client_uri`.
  Redirect URIs, OAuth protocol fields, external authorization endpoints, and
  stored OAuth behavior remain unchanged.
- MCP initialize paths, websearch User-Agent coverage, server-auth tests, and
  App auth tests use `Brand.cli`/`Brand.name` rather than hardcoded product
  identity values.
- The source audit now scans product-owned files under `packages/core/src`,
  `packages/opencode/src`, `packages/app/src`, and `packages/desktop/src` with
  concrete file-and-line external contract rules rather than a directory-wide
  product-source allowlist. Ordinary product copy, filenames, and User-Agent
  values remain auditable. The product-owned mDNS default
  is `${Brand.cli}.local` with `${Brand.cli}-${port}` service names, and the
  webfetch challenge retry uses `Brand.cli` as its User-Agent.
- App server and terminal defaults use `Brand.cli`, status popover config copy
  uses `Brand.configFile`, Core OAuth callback copy uses `Brand.name`, and
  Desktop notifications use the local canonical favicon.
- Distribution audit imports `Brand` from `@openctrlc/identity` rather than
  duplicating product identity literals.
- Desktop product title and README identity remain OpenCtrlC.
- App E2E persistence residual coverage scans every `e2e/**/*.ts` fixture,
  dynamically compares all discovered persistence literals with the expected
  set, classifies no-persistence fixtures, and keeps only the exact
  legacy-new-session negative allowlist.
- All 62 App locales are checked for the external OpenCode Zen provider text
  and link contract. Product-owned App/WSL copy remains OpenCtrlC.
- Session, Provider, Protocol, database schema, generated SDK output, vendor
  integrations, security contact, `sst-dev`, and external provider/service
  contracts were not changed.

## Runtime Smoke

Task 8's built-binary smoke is historical evidence only. The final source
runtime basis is `script/verify-openctrlc-runtime.ts`, runnable as either
`bun run verify:runtime` or `bun script/verify-openctrlc-runtime.ts` from the
repository root. It runs `--version`, `--help`, and `serve --help` with
isolated `HOME`, all XDG roots, `TMPDIR`, `OPENCTRLC_TEST_HOME`, and
`OPENCODE_TEST_HOME`; points the OpenCtrlC test home at the normal isolated
home while reserving a separate legacy sentinel for the old variable;
recursively rejects old paths and `.opencode`; requires
`openctrlc` runtime directories; reports but excludes `cache/bun` Bun noise;
recursively snapshots the sentinel tree to detect reads/writes by the child
processes; cleans the temporary roots in `finally`; and exits non-zero for
every failed assertion.
The script was run against the current source. It passed all assertions: no
`opencode` or `.opencode` path was created; `data`, `cache`, `config`, `state`,
and `tmp` each contained `openctrlc`; `cache/bun` was reported as Bun noise;
and the sentinel remained unchanged. CLI output used `openctrlc` commands and
`openctrlc serve`, with the `openctrlc.local` default in help.

Recorded smoke evidence:

```text
--version: exit 0
--help: exit 0
serve --help: exit 0
cache/bun: Bun noise excluded from product assertions
sentinel SHA-256 before: 782a67c7fab7d1eb0caaaf49bd7d6d3d76a58d8388ea6d238a88fe26954c8f79
sentinel SHA-256 after:  782a67c7fab7d1eb0caaaf49bd7d6d3d76a58d8388ea6d238a88fe26954c8f79
OpenCtrlC runtime smoke passed
```

## Commands And Evidence

```bash
cd script && bun test ./check-namespace.test.ts ./translate-app.test.ts
cd script && bun run check-namespace.ts && bun run check-distribution.ts
git diff --check
cd packages/core && bun test test/oauth-page.test.ts && bun typecheck
cd packages/opencode && bun test test/mcp/oauth-provider.test.ts test/mcp/oauth-callback.test.ts test/mcp/oauth-browser.test.ts test/mcp/oauth-auto-connect.test.ts test/server/httpapi-mcp-oauth.test.ts && bun typecheck
cd packages/opencode && bun test test/tool/webfetch.test.ts test/server/httpapi-mdns.test.ts
cd packages/app && bun test --preload ./happydom.ts ./src/identity-residuals.test.ts ./src/i18n/parity.test.ts && bun typecheck
cd packages/desktop && bun test src/renderer/html.test.ts && bun typecheck
```

The complete isolated runtime smoke command is `bun run verify:runtime` (or
`bun script/verify-openctrlc-runtime.ts`) from the repository root.

Observed results:

- Namespace regression tests: `18 pass, 0 fail`; namespace audit passed with zero output.
- Script translation tests: `16 pass, 0 fail`.
- Distribution audit: passed for OpenCtrlC (`openctrlc`).
- Core OAuth focused tests: `3 pass, 0 fail`; Core typecheck passed.
- OpenCode MCP OAuth focused tests and typecheck passed.
- OpenCode `webfetch` and mDNS focused tests passed.
- App focused identity tests: `3 pass, 0 fail`; App typecheck passed.
- Desktop renderer HTML focused tests: `6 pass, 0 fail`; Desktop typecheck passed.
- OpenCode SDK smoke, webfetch, and mDNS focused tests: `14 pass, 0 fail`; OpenCode typecheck passed.
- App i18n parity tests are a separate collection and are not included in the
  identity count above.
- `git diff --check`: passed.

The historical Task 8 built-binary smoke verified `dist/openctrlc-darwin-arm64/bin/openctrlc`
with isolated XDG roots and is retained as historical evidence; it is not the
latest source state. The latest source smoke above is the final runtime basis.

## Full-Suite Evidence And Limitations

- The Core full suite was not rerun for this audit; the recorded Core evidence
  is the focused OAuth regression suite and typecheck above.
- Task 8's report exists locally at
  `.superpowers/sdd/2026-08-19-openctrlc-identity/task-8-report.md`, is
  ignored by `.superpowers/sdd/.gitignore`, and is not present in any Git
  commit. This audit document records only the verified source smoke below.
- OpenCode full `bun test && bun typecheck` was started with the repository
  suite. The command exceeded the 120-second tool timeout after extensive
  passing output, so it is not reported as a completed full-suite pass. The
  final focused evidence is `packages/opencode/test/identity-residuals.test.ts`
  with `7 pass, 0 fail`, followed by package typecheck.
- App full `bun test && bun typecheck` reached `651 pass, 10 fail, 6 errors`
  before typecheck. The failure/error summary was the existing
  `solid-js/web` named export `use` incompatibility in browser-dependent tests
  and the existing macOS ICU likely-subtag failure for `pa-PK` (`en` instead of
  `pa`). The final focused evidence is
  `packages/app/src/identity-residuals.test.ts`, with `3 pass, 0 fail`, followed
  by package typecheck. The i18n parity collection is separate and is not
  included in the identity count.
- Desktop full `bun test && bun typecheck` had one existing environment
  failure in `packages/desktop/src/main/draft-store.test.ts` because this Bun
  runtime lacks the built-in `node:sqlite` module. The focused desktop
  identity/renderer suite and typecheck were green; Desktop was not changed
  by this repair.
- Desktop packaging was not run on this macOS host. Prior verification also
  records the unpublished platform npm package limitation after prebuild.
- Distribution packaging and built-binary smoke were not rerun for this final
  source repair because the platform package is unpublished; source smoke is
  the applicable final runtime evidence.
- Browser E2E and platform packaging were not used as namespace evidence;
  isolated runtime smoke and source-level residual tests provide that
  evidence without changing session behavior.

## Allowlist

These are intentionally preserved external contracts:

- `opencode.ai`, `api.opencode.ai`, `console.opencode.ai`,
  `models.opencode.ai`, `opencode.ai/zen`, external schema/API/OAuth URLs, and
  hosted service links.
- OpenCode Zen provider/service URLs and IDs, OpenCode provider IDs and model
  IDs, provider API keys, and provider-specific environment variables.
- `@opencode-ai/sdk`, `@opencode-ai/plugin`, third-party OpenCode packages,
  vendor actions, external IDE integrations, and external GitHub/GitLab app
  IDs.
- `opencode-go` and other provider/model identifiers whose values are
  external service contracts.
- `sst-dev` as the existing VS Code Marketplace publisher.
- `security@anoma.ly` as the inherited external security escalation contact.
- Historical protocol fields, generated fixtures, negative compatibility tests,
  and external vendor asset filenames.

The audit does not modify Session, Provider, Protocol, database schema, or
generated SDK output.

## Final Test Limitations

- Root `bun test` is prohibited by the repository guard
  `do-not-run-tests-from-root`.
- OpenCode full `bun test` previously exceeded the tool timeout after extensive
  passing output; focused identity, mDNS, and webfetch tests are the final
  evidence for this repair.
- App full tests previously had 651 pass, 10 fail, and 6 errors from the
  existing `solid-js/web` named export `use` incompatibility and macOS ICU
  `pa-PK` likely-subtag behavior; focused identity/parity tests passed.
- Desktop full tests previously had the existing `node:sqlite` environment
  failure in `draft-store.test.ts`; focused identity tests and typecheck passed.
- Browser E2E, native packaging, and a newly built binary were not run.

## Worktree Note

The pre-existing scratch reports remain uncommitted and were not included in
either commit:

- `.superpowers/sdd/2026-08-19-openctrlc-identity/task-3-report.md`
- `.superpowers/sdd/2026-08-19-openctrlc-identity/task-4-report.md`

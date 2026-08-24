# OpenCtrlC Residual Namespace Audit

Date: 2026-08-24

## Current Result

The final product/test repair is:

`13cdd7f11f76878f3b6f5a56ca5a1104cbe16739 fix(identity): tighten final audit evidence`

The preceding complete audit commit is:

`0de986e9dfd76101e00e386b1358c7d1e2019dbe docs(identity): record OpenCtrlC namespace audit`

The audit-only commit for this document is:

`docs(identity): record OpenCtrlC namespace audit`

The product-owned residual checks now cover the complete App E2E TypeScript
fixture tree, including performance helpers and fixtures. The only old
persistence key is the exact negative migration fixture
`e2e/regression/legacy-new-session.spec.ts`; all other scanned fixtures reject
old `opencode.*.dat` keys and the timeline and cross-server fixtures assert
the new `openctrlc.*.dat` keys.

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
- Desktop product title and README identity remain OpenCtrlC.
- App E2E persistence residual coverage scans every `e2e/**/*.ts` fixture,
  with only the exact legacy-new-session negative allowlist.
- All 62 App locales are checked for the external OpenCode Zen provider text
  and link contract. Product-owned App/WSL copy remains OpenCtrlC.
- Session, Provider, Protocol, database schema, generated SDK output, vendor
  integrations, security contact, `sst-dev`, and external provider/service
  contracts were not changed.

## Runtime Smoke

The isolated smoke was rerun against the source CLI, not a built binary. It
used a fresh temporary `HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`,
`XDG_CONFIG_HOME`, `XDG_STATE_HOME`, and `TMPDIR`, plus
`OPENCTRLC_DISABLE_MODELS_FETCH=1`. It also created a real old
`$tmp/opencode` directory containing a sentinel file and set
`OPENCODE_TEST_HOME` to that directory.

The source CLI commands were:

```bash
env -i HOME="$tmp/home" XDG_DATA_HOME="$tmp/data" XDG_CACHE_HOME="$tmp/cache" \
  XDG_CONFIG_HOME="$tmp/config" XDG_STATE_HOME="$tmp/state" TMPDIR="$tmp/tmp" \
  PATH="$PATH" OPENCODE_TEST_HOME="$tmp/opencode" \
  OPENCTRLC_DISABLE_MODELS_FETCH=1 \
  bun run --conditions=browser ./src/index.ts --version

env -i HOME="$tmp/home" XDG_DATA_HOME="$tmp/data" XDG_CACHE_HOME="$tmp/cache" \
  XDG_CONFIG_HOME="$tmp/config" XDG_STATE_HOME="$tmp/state" TMPDIR="$tmp/tmp" \
  PATH="$PATH" OPENCODE_TEST_HOME="$tmp/opencode" \
  OPENCTRLC_DISABLE_MODELS_FETCH=1 \
  bun run --conditions=browser ./src/index.ts --help

env -i HOME="$tmp/home" XDG_DATA_HOME="$tmp/data" XDG_CACHE_HOME="$tmp/cache" \
  XDG_CONFIG_HOME="$tmp/config" XDG_STATE_HOME="$tmp/state" TMPDIR="$tmp/tmp" \
  PATH="$PATH" OPENCODE_TEST_HOME="$tmp/opencode" \
  OPENCTRLC_DISABLE_MODELS_FETCH=1 \
  bun run --conditions=browser ./src/index.ts serve --help
```

The recursive assertion inspected all six isolated roots and the old
directory. It found the expected OpenCtrlC runtime directories
(`data/openctrlc`, `cache/openctrlc`, `config/openctrlc`, `state/openctrlc`,
and `tmp/openctrlc`). The additional `cache/bun` tree is Bun's package/cache
tool noise, not an OpenCode runtime path. No `opencode` or `.opencode` path
was created, and the old sentinel directory was unchanged. The CLI output
used `openctrlc` commands and `openctrlc serve`.

Recorded smoke evidence:

```text
sentinel SHA-256 before: 1bf84fec72db3e64c8db4e4add5d1a5b1f2ccc1e4870aa95745ccaa05859c0c3
sentinel SHA-256 after:  1bf84fec72db3e64c8db4e4add5d1a5b1f2ccc1e4870aa95745ccaa05859c0c3

data:   ./openctrlc, ./openctrlc/log, ./openctrlc/repos
cache:  ./bun, ./bun/@t@, ./openctrlc, ./openctrlc/bin
config: ./openctrlc
state:  ./openctrlc
tmp:    ./openctrlc
old:    ./, ./sentinel.txt
```

## Commands And Evidence

```bash
bun script/check-namespace.ts
bun script/check-distribution.ts
git diff --check
cd packages/core && bun test && bun typecheck
cd packages/opencode && bun typecheck
cd packages/app && bun typecheck
cd packages/desktop && bun test identity-contract.test.ts src/renderer/html.test.ts && bun typecheck
cd packages/web && bun run build
cd packages/console && bun typecheck
cd packages/console/support && bun typecheck
cd packages/console/app && bun test src/routes/download/index.test.ts
bun turbo typecheck
```

Observed results:

- Namespace audit: passed with zero output.
- Distribution audit: passed for OpenCtrlC (`openctrlc`).
- Core full suite: `1096 pass, 0 fail`; typecheck passed.
- OpenCode focused identity/MCP/websearch/auth suite: `39 pass, 0 fail`; typecheck passed.
- App focused identity/i18n/auth suite: `13 pass, 0 fail`; typecheck passed.
- Final OpenCode identity residual suite (`packages/opencode/test/identity-residuals.test.ts`): `7 pass, 0 fail`; package typecheck passed.
- Final App identity/parity suites (`packages/app/src/identity-residuals.test.ts` and
  `packages/app/src/i18n/parity.test.ts`): `9 pass, 0 fail`; package typecheck passed.
- Desktop focused identity/renderer suite: `82 pass, 0 fail`; typecheck passed.
- Web production build: passed. Existing large-chunk and prerender request-header
  warnings remain non-fatal.
- Console turbo typecheck: `31 successful, 31 total`.
- Console Support typecheck: passed.
- Console download tests: `3 pass, 0 fail`.
- `git diff --check`: passed.

## Full-Suite Evidence And Limitations

- Core full tests completed successfully as recorded above.
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
  `packages/app/src/identity-residuals.test.ts` plus
  `packages/app/src/i18n/parity.test.ts`, with `9 pass, 0 fail`, followed by
  package typecheck.
- Desktop full `bun test && bun typecheck` had one existing environment
  failure in `packages/desktop/src/main/draft-store.test.ts` because this Bun
  runtime lacks the built-in `node:sqlite` module. The focused desktop
  identity/renderer suite and typecheck were green; Desktop was not changed
  by this repair.
- Desktop packaging was not run on this macOS host. Prior verification also
  records the unpublished platform npm package limitation after prebuild.
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

## Worktree Note

The pre-existing scratch reports remain uncommitted and were not included in
either commit:

- `.superpowers/sdd/2026-08-19-openctrlc-identity/task-3-report.md`
- `.superpowers/sdd/2026-08-19-openctrlc-identity/task-4-report.md`

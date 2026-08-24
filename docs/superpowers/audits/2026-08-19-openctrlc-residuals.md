# OpenCtrlC Residual Namespace Audit

Date: 2026-08-24

## Current Result

The preceding product repair commit is:

`b5877fd2ae9825e4a780742a84fc077e8e1cd3f1 fix(identity): close final source identity leaks`

The line-precise audit repair commit is:

`12135fbc314371c2a75ef2eabd1b151e12b3c785 fix(identity): make source audit line-precise`

Intermediate audit boundary commits:

- `383aeea` audit-script baseline
- `87d1d85` product identity repair
- `20a6e34e5ecd8a0972a8658ffed655a06c9dd52 audit document before the line-precise repair`

The final audit commit for this document is recorded after the product repair:

The final audit commit message is `docs(identity): record OpenCtrlC namespace audit`.
Its parent is the line-precise product commit
`12135fbc314371c2a75ef2eabd1b151e12b3c785`. The audit commit's full SHA is
reported after commit; it is intentionally not embedded in this document
because doing so would make the document self-referential.

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
  with only the exact legacy-new-session negative allowlist.
- All 62 App locales are checked for the external OpenCode Zen provider text
  and link contract. Product-owned App/WSL copy remains OpenCtrlC.
- Session, Provider, Protocol, database schema, generated SDK output, vendor
  integrations, security contact, `sst-dev`, and external provider/service
  contracts were not changed.

## Runtime Smoke

Task 8's built-binary smoke is historical evidence only. The isolated smoke
below was rerun against the current source CLI and is the final runtime basis.
It used six fresh isolated roots (`HOME`, `XDG_DATA_HOME`,
`XDG_CACHE_HOME`, `XDG_CONFIG_HOME`, `XDG_STATE_HOME`, and `TMPDIR`) plus a
seventh legacy-sentinel root. It set `OPENCTRLC_TEST_HOME` and the legacy
`OPENCODE_TEST_HOME` interference variable to that sentinel and disabled model
fetching with `OPENCTRLC_DISABLE_MODELS_FETCH=1`.

The source CLI commands were:

```bash
env -i HOME="$tmp/home" XDG_DATA_HOME="$tmp/data" XDG_CACHE_HOME="$tmp/cache" \
  XDG_CONFIG_HOME="$tmp/config" XDG_STATE_HOME="$tmp/state" TMPDIR="$tmp/tmp" \
  PATH="$PATH" OPENCTRLC_TEST_HOME="$tmp/legacy-sentinel" OPENCODE_TEST_HOME="$tmp/legacy-sentinel" \
  OPENCTRLC_DISABLE_MODELS_FETCH=1 \
  bun run --conditions=browser ./src/index.ts --version

env -i HOME="$tmp/home" XDG_DATA_HOME="$tmp/data" XDG_CACHE_HOME="$tmp/cache" \
  XDG_CONFIG_HOME="$tmp/config" XDG_STATE_HOME="$tmp/state" TMPDIR="$tmp/tmp" \
  PATH="$PATH" OPENCTRLC_TEST_HOME="$tmp/legacy-sentinel" OPENCODE_TEST_HOME="$tmp/legacy-sentinel" \
  OPENCTRLC_DISABLE_MODELS_FETCH=1 \
  bun run --conditions=browser ./src/index.ts --help

env -i HOME="$tmp/home" XDG_DATA_HOME="$tmp/data" XDG_CACHE_HOME="$tmp/cache" \
  XDG_CONFIG_HOME="$tmp/config" XDG_STATE_HOME="$tmp/state" TMPDIR="$tmp/tmp" \
  PATH="$PATH" OPENCTRLC_TEST_HOME="$tmp/legacy-sentinel" OPENCODE_TEST_HOME="$tmp/legacy-sentinel" \
  OPENCTRLC_DISABLE_MODELS_FETCH=1 \
  bun run --conditions=browser ./src/index.ts serve --help
```

The recursive assertion inspected seven roots: the six isolated roots plus
the legacy sentinel. Root-level results were: `home` had 0 entries; `data`
had 3 OpenCtrlC entries (`openctrlc`, `log`, `repos`); `cache` had 2
OpenCtrlC entries (`openctrlc`, `bin`) plus Bun's unrelated `bun` cache tree;
`config`, `state`, and `tmp` each had 1 OpenCtrlC entry; and the legacy
sentinel had only `sentinel.txt`. Bun's nested `cache/bun` files are tool
noise and are excluded from the product count. No `opencode` or `.opencode`
path was created, and the sentinel remained unchanged. The CLI output used
`openctrlc` commands and `openctrlc serve`; help showed the `openctrlc.local`
default.

Recorded smoke evidence:

```text
sentinel SHA-256 before: a97aa60d37dccdb3e1603ee3dc145146027d78c8857534cd9b3acee9b0c9126f
sentinel SHA-256 after:  a97aa60d37dccdb3e1603ee3dc145146027d78c8857534cd9b3acee9b0c9126f

data:   ./openctrlc, ./openctrlc/log, ./openctrlc/repos
cache:   ./bun (Bun noise), ./openctrlc, ./openctrlc/bin
config: ./openctrlc
state:  ./openctrlc
tmp:    ./openctrlc
legacy-sentinel: ./, ./sentinel.txt
```

## Commands And Evidence

```bash
cd script && bun test ./check-namespace.test.ts ./translate-app.test.ts
cd script && bun run check-namespace.ts && bun run check-distribution.ts
git diff --check
cd packages/core && bun test test/oauth-page.test.ts && bun typecheck
cd packages/opencode && bun test test/mcp/oauth-provider.test.ts test/mcp/oauth-callback.test.ts test/mcp/oauth-browser.test.ts test/mcp/oauth-auto-connect.test.ts test/server/httpapi-mcp-oauth.test.ts && bun typecheck
cd packages/app && bun typecheck
cd packages/desktop && bun test src/renderer/html.test.ts && bun typecheck
```

The source smoke was run from `packages/opencode` with the following command;
the recursive assertion used `/usr/bin/find` over the seven isolated roots and
then removed the temporary directory:

```bash
tmp=$(mktemp -d); mkdir -p "$tmp/home" "$tmp/data" "$tmp/cache" "$tmp/config" "$tmp/state" "$tmp/tmp" "$tmp/legacy-sentinel"; printf 'sentinel\n' > "$tmp/legacy-sentinel/sentinel.txt"; before=$(shasum -a 256 "$tmp/legacy-sentinel/sentinel.txt" | cut -d' ' -f1); run='env -i HOME="$tmp/home" XDG_DATA_HOME="$tmp/data" XDG_CACHE_HOME="$tmp/cache" XDG_CONFIG_HOME="$tmp/config" XDG_STATE_HOME="$tmp/state" TMPDIR="$tmp/tmp" PATH="$PATH" OPENCTRLC_TEST_HOME="$tmp/legacy-sentinel" OPENCODE_TEST_HOME="$tmp/legacy-sentinel" OPENCTRLC_DISABLE_MODELS_FETCH=1'; eval "$run bun run --conditions=browser ./src/index.ts --version"; eval "$run bun run --conditions=browser ./src/index.ts --help"; eval "$run bun run --conditions=browser ./src/index.ts serve --help"; for root in "$tmp/home" "$tmp/data" "$tmp/cache" "$tmp/config" "$tmp/state" "$tmp/tmp" "$tmp/legacy-sentinel"; do (cd "$root" && /usr/bin/find . -print | sort); done; after=$(shasum -a 256 "$tmp/legacy-sentinel/sentinel.txt" | cut -d' ' -f1); rm -rf "$tmp"
```

Observed results:

- Namespace regression tests: `15 pass, 0 fail`; namespace audit passed with zero output.
- Script translation tests: `16 pass, 0 fail`.
- Distribution audit: passed for OpenCtrlC (`openctrlc`).
- Core OAuth focused tests: `3 pass, 0 fail`; Core typecheck passed.
- OpenCode MCP OAuth focused tests and typecheck passed.
- App typecheck passed.
- Desktop renderer HTML focused tests: `6 pass, 0 fail`; Desktop typecheck passed.
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

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
whose parent is `4232dd8ea07c7a904268852d15c0a754334936a9`. This audit commit is
created with `fe8c0aa3ae236746c45d8a8c7631f2995599afe1` as its parent; its own
future SHA is intentionally not embedded to avoid self-reference.

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
The following script is self-contained and can be copied and run from
`packages/opencode`. It creates temporary roots, asserts the CLI output,
recursively rejects old paths, asserts the expected `openctrlc` directories,
and fails when the sentinel changes. Bun may create `cache/bun`; that is
explicitly reported as Bun tool noise and excluded from product assertions.
The CLI assertions require `openctrlc` and reject `opencode` case-insensitively.

```bash
set -eu
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/home" "$tmp/data" "$tmp/cache" "$tmp/config" "$tmp/state" "$tmp/tmp" "$tmp/legacy-sentinel"
printf 'sentinel\n' > "$tmp/legacy-sentinel/sentinel.txt"
before="$(shasum -a 256 "$tmp/legacy-sentinel/sentinel.txt" | cut -d' ' -f1)"
run() {
  env -i HOME="$tmp/home" XDG_DATA_HOME="$tmp/data" XDG_CACHE_HOME="$tmp/cache" \
    XDG_CONFIG_HOME="$tmp/config" XDG_STATE_HOME="$tmp/state" TMPDIR="$tmp/tmp" \
    PATH="$PATH" OPENCTRLC_TEST_HOME="$tmp/legacy-sentinel" OPENCODE_TEST_HOME="$tmp/legacy-sentinel" \
    OPENCTRLC_DISABLE_MODELS_FETCH=1 "$@"
}
version="$(run bun run --conditions=browser ./src/index.ts --version 2>&1)"
help="$(run bun run --conditions=browser ./src/index.ts --help 2>&1)"
serve_help="$(run bun run --conditions=browser ./src/index.ts serve --help 2>&1)"
test -n "$version" || { printf '%s\n' 'FAIL: --version returned no output' >&2; exit 1; }
case "$help" in *openctrlc*) ;; *) printf '%s\n' 'FAIL: --help lacks openctrlc' >&2; exit 1 ;; esac
case "$serve_help" in *openctrlc*) ;; *) printf '%s\n' 'FAIL: serve --help lacks openctrlc' >&2; exit 1 ;; esac
help_lower=$(printf '%s\n' "$help" | tr '[:upper:]' '[:lower:]')
serve_help_lower=$(printf '%s\n' "$serve_help" | tr '[:upper:]' '[:lower:]')
case "$help_lower" in *opencode*) printf '%s\n' 'FAIL: --help contains legacy opencode identity' >&2; exit 1 ;; esac
case "$serve_help_lower" in *opencode*) printf '%s\n' 'FAIL: serve --help contains legacy opencode identity' >&2; exit 1 ;; esac
for root in "$tmp/home" "$tmp/data" "$tmp/cache" "$tmp/config" "$tmp/state" "$tmp/tmp" "$tmp/legacy-sentinel"; do
  old="$(/usr/bin/find "$root" \( -iname '*opencode*' -o -name '.opencode' \) -print -quit)"
  if [ -n "$old" ]; then printf 'FAIL: legacy path: %s\n' "$old" >&2; exit 1; fi
done
for root in data cache config state tmp; do
  test -d "$tmp/$root/openctrlc" || { printf 'FAIL: missing %s/openctrlc\n' "$root" >&2; exit 1; }
done
if [ -d "$tmp/cache/bun" ]; then printf '%s\n' 'cache/bun: Bun tool noise (excluded from product assertions)'; fi
after="$(shasum -a 256 "$tmp/legacy-sentinel/sentinel.txt" | cut -d' ' -f1)"
if [ "$before" != "$after" ]; then printf '%s\n' 'FAIL: legacy sentinel changed' >&2; exit 1; fi
printf 'sentinel SHA-256 before: %s\nsentinel SHA-256 after:  %s\n' "$before" "$after"
for root in data cache config state tmp legacy-sentinel; do (cd "$tmp/$root" && /usr/bin/find . -print | sort); done
```

The script was run against the current source. It passed all assertions: no
`opencode` or `.opencode` path was created; `data`, `cache`, `config`, `state`,
and `tmp` each contained `openctrlc`; `cache/bun` was reported as Bun noise;
and the sentinel remained unchanged. CLI output used `openctrlc` commands and
`openctrlc serve`, with the `openctrlc.local` default in help.

Recorded smoke evidence:

```text
version: local
sentinel SHA-256 before: b5f7e7d285029324d9b3acae19cc05099271454ac98bfc059a92b0581625cd51
sentinel SHA-256 after:  b5f7e7d285029324d9b3acae19cc05099271454ac98bfc059a92b0581625cd51

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
cd packages/opencode && bun test test/tool/webfetch.test.ts test/server/httpapi-mdns.test.ts
cd packages/app && bun test ./src/identity-residuals.test.ts ./src/i18n/parity.test.ts && bun typecheck
cd packages/desktop && bun test src/renderer/html.test.ts && bun typecheck
```

The complete isolated runtime smoke command is the full script shown above,
run from `packages/opencode`; it includes `--version`, `--help`, `serve --help`,
case-insensitive legacy-identity rejection, path checks, Bun-noise reporting,
and sentinel verification.

Observed results:

- Namespace regression tests: `18 pass, 0 fail`; namespace audit passed with zero output.
- Script translation tests: `16 pass, 0 fail`.
- Distribution audit: passed for OpenCtrlC (`openctrlc`).
- Core OAuth focused tests: `3 pass, 0 fail`; Core typecheck passed.
- OpenCode MCP OAuth focused tests and typecheck passed.
- OpenCode `webfetch` and mDNS focused tests passed.
- App focused identity/parity tests: `10 pass, 0 fail`; App typecheck passed.
- Desktop renderer HTML focused tests: `6 pass, 0 fail`; Desktop typecheck passed.
- OpenCode SDK smoke, webfetch, and mDNS focused tests: `14 pass, 0 fail`; OpenCode typecheck passed.
- App persistence residual and i18n parity tests: `10 pass, 0 fail`; App typecheck passed.
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
  `packages/app/src/i18n/parity.test.ts`, with `10 pass, 0 fail`, followed by
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

# OpenCtrlC Residual Namespace Audit

Date: 2026-08-22

## Current Result

The effective namespace audit now parses `git grep` output using the first colon
as the file/line separator and scans tracked product Markdown/MDX, the formal
`.openctrlc` tree, Core skill Markdown, Web docs, Console i18n, and Console
Support. It uses line-level external-contract allowlisting rather than
file-level suppression for those product scopes.

The current product repair is:

`0ca7a01 fix(identity): make final namespace audit effective`

The audit-only commit for this document is:

`docs(identity): record OpenCtrlC namespace audit`

## Commands And Evidence

```bash
~/.agents/instructions/script/test-proxy.sh
bun script/check-namespace.ts
bun script/check-distribution.ts
git diff --check
cd packages/web && bun run build
cd packages/console && bun typecheck
cd packages/console/support && bun typecheck
cd packages/console/app && bun test src/routes/download/index.test.ts
cd packages/opencode && bun test test/installation/installation.test.ts test/cli/distribution-contract.test.ts test/cli/contract.test.ts
cd sdks/vscode && bun test identity-contract.test.ts && bun run check-types && bun run lint
```

Latest observed results before this audit-only commit:

- Proxy check: Clash Verge passed all three sites; QuickQ passed Google/GitHub but HuggingFace timed out during this run.
- `bun script/check-namespace.ts`: passed with zero output after the parser and product-scope fixes.
- `bun script/check-distribution.ts`: passed for OpenCtrlC.
- `git diff --check`: passed.
- Web production build: passed; existing large-chunk and prerender request-header warnings remain non-fatal.
- Console typecheck: 31 tasks successful.
- Console Support typecheck: passed.
- Console download test: `3 pass, 0 fail`.
- OpenCode focused CLI/config tests: `21 pass, 0 fail`.
- VS Code identity test: `1 pass, 0 fail`; typecheck passed; lint has 48 existing semicolon warnings and 0 errors.

## Product Changes

- Console locale dictionaries use OpenCtrlC product names for titles, metadata,
  logo labels, download labels, and product copy.
- Console Support titles use OpenCtrlC.
- Console download AUR instructions and test use the published `openctrlc-bin`
  target.
- Distribution audit asserts the Console AUR command and rejects stale AUR
  commands in tracked README installation guidance.
- Namespace audit includes tracked Markdown/MDX and the Web/Console/Support
  product scopes; it does not rely on a blanket file-level ignore for those
  scopes.

## Allowlist

These are intentionally preserved external contracts:

- `opencode.ai`, `api.opencode.ai`, `console.opencode.ai`,
  `models.opencode.ai`, external schema/API/OAuth URLs, and hosted service links.
- `models.dev`, provider IDs, model IDs, provider API keys, and provider-specific
  environment variables.
- `@opencode-ai/sdk`, `@opencode-ai/plugin`, third-party OpenCode packages,
  vendor actions, external IDE integrations, and external GitHub/GitLab app IDs.
- `opencode-go` and other provider/model identifiers whose value is an external
  service contract.
- `sst-dev` as the existing VS Code Marketplace publisher.
- `security@anoma.ly` as the inherited external security escalation contact.
- Historical protocol fields, generated fixtures, negative compatibility tests,
  and external vendor asset filenames.

The audit does not modify Session, Provider, Protocol, database schema, or
generated SDK output.

## Limitations

- The current host is macOS, so Windows/Linux packaging commands were not run.
- Full Desktop packaging remains dependent on the unpublished platform npm
  package noted in the prior Task 8 verification.
- The two pre-existing scratch reports remain uncommitted:
  `task-3-report.md` and `task-4-report.md`.

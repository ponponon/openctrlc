# OpenCtrlC Residual Namespace Audit

Date: 2026-08-21

## Current Result

The product-owned CLI, configuration, installation, AUR, Console, Support, and
Web documentation entrypoints use OpenCtrlC naming. External OpenCode provider,
service, protocol, vendor, and OAuth identifiers remain unchanged.

The final product repair is `d786d61 fix(identity): finish OpenCtrlC web and console residuals`.
The preceding product entrypoint repair is `c51b5dd fix(identity): complete OpenCtrlC web console and docs`.
The current audit documentation commit is this document's follow-up:
`docs(identity): record OpenCtrlC namespace audit`.

## Verification Commands

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

Results in this pass:

- Proxy check: QuickQ and Clash Verge passed Google, GitHub, and HuggingFace checks.
- Namespace audit: passed with zero output.
- Distribution audit: `Distribution contract passed for OpenCtrlC (openctrlc)`.
- Web build: passed; existing chunk-size and prerender warnings remain non-fatal.
- Console typecheck: 31 tasks successful.
- Console Support typecheck: passed.
- Console download identity tests: `3 pass, 0 fail`.
- OpenCode focused tests: `21 pass, 0 fail`.
- VS Code identity test: `1 pass, 0 fail`; typecheck passed; lint has 48 existing semicolon warnings and 0 errors.
- `git diff --check`: passed before commits.

## Product-Owned Contracts Fixed

- Web docs CLI commands, product prose, `.openctrlc` paths, config filenames,
  schemas, TUI theme names, XDG paths, Windows paths, and installation commands
  now use OpenCtrlC. All translated documents are included.
- Console i18n dictionaries now use OpenCtrlC product-facing names.
- Console Support page titles now use OpenCtrlC.
- Console download and README/Web AUR commands use the published `openctrlc-bin`
  target. The distribution audit and download test assert this exact command.
- `script/check-namespace.ts` scans tracked product Markdown/MDX, formal
  `.openctrlc` content, Web docs, Console i18n, and Console Support text.
- `script/check-distribution.ts` checks the Console AUR entrypoint and rejects
  stale AUR commands in tracked README installation guidance.

## Exact Allowlist

The following remain intentional external contracts and are not product-owned
residuals:

- `opencode.ai`, `api.opencode.ai`, `console.opencode.ai`,
  `models.opencode.ai`, and external OpenCode schema/API/OAuth URLs.
- `models.dev` and provider IDs, model IDs, API keys, and provider-specific
  environment variables.
- `@opencode-ai/sdk`, `@opencode-ai/plugin`, external OpenCode integrations,
  third-party actions, and vendor package names.
- `opencode-go` and provider-specific OpenCode Go service identifiers.
- `sst-dev` as the existing VS Code Marketplace publisher.
- `security@anoma.ly` as the inherited external security-team escalation contact.
- Historical protocol fields, generated fixtures, negative compatibility tests,
  and external brand/vendor assets where renaming would change a contract.

The audit deliberately does not modify Session, Provider, Protocol, database
schema, generated SDK output, or external provider/API/OAuth behavior.

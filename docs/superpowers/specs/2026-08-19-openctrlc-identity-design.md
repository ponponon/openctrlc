# OpenCtrlC Identity And Namespace Migration

## Status

Approved design for staged implementation.

## Goal

Turn this fork into an independently named product, OpenCtrlC, without changing
session, agent, provider, protocol, or database behavior. The migration replaces
the repository's internal OpenCode namespace rather than adding a compatibility
alias.

OpenCode user data, project configuration, CLI names, environment variables, and
internal package names are not read or preserved by the new product.

## Product Identity

Add a small shared identity package named `@openctrlc/identity`. It is the single
source for product-owned identity values:

| Field | Value |
| --- | --- |
| Product name | `OpenCtrlC` |
| CLI name | `openctrlc` |
| Runtime directory | `openctrlc` |
| Project directory | `.openctrlc` |
| JSON config | `openctrlc.json` |
| JSONC config | `openctrlc.jsonc` |
| Environment prefix | `OPENCTRLC_` |
| URL scheme | `openctrlc` |
| Desktop app ID | `cn.quniv.openctrlc` |

Core, CLI, app, desktop, build scripts, and release configuration consume these
values instead of defining product-owned strings independently.

The identity package must not depend on Core, Protocol, Server, Client, or any
runtime package. It can be consumed by all product layers without violating the
repository's dependency direction.

## Namespace Migration

### Internal packages

All packages owned by this workspace move from `@opencode-ai/*` to
`@openctrlc/*`. This includes package manifests, workspace dependencies, TypeScript
imports, exports, dynamic imports, build strings, task names, tests, fixtures, and
lockfiles.

The unscoped internal package `opencode`, if present, also receives its OpenCtrlC
package identity. Third-party packages containing the text `opencode` are not
renamed.

Generated SDK output is never edited directly. Generators and templates are
updated first, then generated output is regenerated using the repository's
documented commands.

### Project configuration

Product-owned project configuration changes as follows:

```text
.opencode/      -> .openctrlc/
opencode.json   -> openctrlc.json
opencode.jsonc  -> openctrlc.jsonc
```

Every discovery and write path must use the new names, including global config,
MCP, plugins, agents, commands, skills, themes, tools, plans, and test fixtures.
The repository's own configuration directory is renamed as part of this work.

There is no fallback to the old names and no automatic migration. Existing
OpenCode configuration is intentionally outside OpenCtrlC's data contract.

### Environment variables

Product-owned `OPENCODE_*` variables become `OPENCTRLC_*`, including runtime
reads, Flag properties, test variables, CI variables, and compile-time defines.
Examples include configuration, server, database, test-home, channel, version,
models, worker, and CLI variables.

Standard external variables such as `OTEL_*` remain unchanged. Old `OPENCODE_*`
variables are not read as fallback values.

### CLI and runtime paths

The installed package exposes only `openctrlc`. It must not register an
`opencode` bin alias. Help output, script name, error suggestions, subprocess
invocations, binary output paths, temporary names, and user-agent values owned by
the product use OpenCtrlC identity.

Core data, cache, config, state, temporary, log, repository, and binary paths use
the `openctrlc` runtime namespace. No old directory fallback is implemented.

Before changing distribution names, the existing CLI artifact naming mismatch
between platform packages, `opencode`, `opencode2`, and `opencode-cli` is resolved
by defining one consistent artifact, executable, and package naming contract.

## External Identity Allowlist

Text containing `opencode` is not automatically product-owned. The following
remain unchanged unless a later feature explicitly replaces the external service:

- Provider IDs and model IDs that identify the external OpenCode provider.
- `opencode.ai`, `app.opencode.ai`, `api.opencode.ai`, and
  `models.opencode.ai` service URLs.
- Third-party package names such as `opencode-gitlab-auth` and
  `opencode-poe-auth`.
- External protocol values, OAuth audiences, telemetry contracts, and existing
  integration identifiers that are not owned by this fork.

These values are recorded in migration review as an allowlist so a residual-string
audit distinguishes intentional external identifiers from missed product names.

## Desktop Identity

Desktop migration is a separate implementation boundary. It changes the product
name, Electron app ID, user-data namespace, URL scheme, artifact names, Linux
desktop metadata, and updater configuration to OpenCtrlC. The new product does not
register the old `opencode` scheme or reuse the old app identity.

Electron virtual modules, sidecar paths, native resources, and preload declarations
must be updated atomically within the desktop/build stage.

## Staged Implementation

Each commit must leave the affected workspace installable and type-checkable.
The implementation is split into these boundaries:

1. `chore(namespace): add OpenCtrlC identity`
   - Add the identity package and its tests.
   - Do not change runtime behavior yet.

2. `refactor(namespace): rename workspace packages`
   - Rename internal package manifests, imports, exports, dynamic references,
     task names, and lockfiles.
   - Keep external service identifiers unchanged.

3. `refactor(config): rename project and environment namespace`
   - Rename project config discovery and writes.
   - Rename product-owned environment variables and flags.
   - Rename repository fixtures and the repository's own product config.

4. `refactor(runtime): use OpenCtrlC data paths`
   - Switch all Core and CLI runtime directories to OpenCtrlC.
   - Verify database, logs, cache, state, repositories, binaries, and temporary
     files use only the new namespace.

5. `refactor(cli): expose openctrlc command`
   - Rename the package bin, executable output, help identity, and subprocess
     calls.
   - Confirm no `opencode` alias is installed.

6. `refactor(desktop): adopt OpenCtrlC application identity`
   - Rename Electron product identity, app ID, URL scheme, user-data paths,
     sidecar module, and native metadata.

7. `chore(build): rename artifacts and distribution metadata`
   - Rename compile-time defines, platform artifacts, postinstall behavior, and
     package-manager metadata.

8. `docs(identity): update OpenCtrlC documentation`
   - Update product-facing README, installation, configuration, and distribution
     instructions. Keep intentional external identity references explicit.

## Verification

For every stage:

- Run `git diff --check`.
- Run `bun install --frozen-lockfile` when manifests or lockfiles change.
- Run `bun typecheck` from every affected package directory, never from the root.
- Run focused tests for the affected package.
- Audit product-owned residual strings with `rg` and review each remaining match
  against the external identity allowlist.

Final CLI checks:

```bash
openctrlc --help
openctrlc --version
openctrlc serve --help
```

Final runtime checks use an isolated temporary home and assert that only
OpenCtrlC data, cache, config, state, log, repository, and temporary directories
are created. The checks also assert that old `opencode` directories and
`OPENCODE_*` variables have no effect.

Final build checks include the app production build, desktop build, CLI smoke
test, and platform packaging where the host supports it. No API or Protocol
shape changes are part of this design; if an implementation accidentally changes
the public Server or Protocol `HttpApi`, run `bun run generate` from
`packages/client` and do not edit generated files directly.

## Non-Goals

- No Session, Agent, Provider, or model execution redesign.
- No API path or Protocol shape change.
- No compatibility alias for the `opencode` CLI.
- No reading, writing, or migration of OpenCode runtime data.
- No reading of old project config or old environment variables.
- No replacement of external OpenCode provider/service contracts in this stage.
- No database schema migration.
- No new visual identity or logo redesign.

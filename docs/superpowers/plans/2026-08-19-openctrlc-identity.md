# OpenCtrlC Identity Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename this fork into an independent OpenCtrlC product across internal packages, project configuration, environment variables, runtime paths, CLI, desktop identity, and distribution metadata without changing session, provider, protocol, or database behavior.

**Architecture:** Add a dependency-free `@openctrlc/identity` package as the source of product-owned names. Migrate one namespace boundary at a time, using scripted exact replacements plus reviewed allowlists for external OpenCode service/provider identifiers. Keep each boundary installable and type-checkable before moving to the next.

**Tech Stack:** Bun workspaces, TypeScript, Effect, yargs, SolidJS/Vite, Electron/electron-builder, GitHub Actions, Nix, Bun lockfiles.

## Global Constraints

- OpenCode user data, project configuration, CLI names, environment variables, and internal package names are not read or preserved by the new product.
- Product identity values are provided by `@openctrlc/identity` and are not independently hardcoded by Core, CLI, app, desktop, build scripts, or release configuration.
- Internal workspace packages move from `@opencode-ai/*` to `@openctrlc/*`.
- `.opencode/`, `opencode.json`, and `opencode.jsonc` become `.openctrlc/`, `openctrlc.json`, and `openctrlc.jsonc` with no fallback or automatic migration.
- Product-owned `OPENCODE_*` variables become `OPENCTRLC_*`; old variables are not read as fallback values.
- The installed CLI exposes only `openctrlc`; no `opencode` bin alias is registered.
- External provider IDs, model IDs, `opencode.ai` service URLs, third-party package names, external protocol values, OAuth audiences, and telemetry contracts remain unchanged unless explicitly owned by this fork.
- Do not change Session, Agent, Provider, model execution, API paths, Protocol shape, or database schema.
- Never edit generated SDK output directly; update generators and run the repository's generation commands when required.
- Tests run from package directories, never from the repository root.
- Use `bun typecheck` from affected package directories, never direct `tsc`.
- Use ASCII for new text and preserve existing project style.
- Do not commit or push implementation changes unless the user explicitly requests integration; the design document commit already exists.

## File Map

- `packages/identity/`: new dependency-free product identity package and unit tests.
- `package.json`, workspace package manifests, `turbo.json`, lockfiles: internal package names and dependency graph.
- `packages/core/src/global.ts`, `packages/core/src/flag/flag.ts`, `packages/core/src/installation/`, and related tests: runtime paths, product flags, and compile-time identity.
- `packages/opencode/src/config/`, `packages/opencode/src/index.ts`, CLI command modules, and fixtures: project configuration discovery, environment variables, CLI name, and subprocess calls.
- `packages/opencode/script/`, `packages/cli/`, `packages/desktop/scripts/`: executable and artifact contracts.
- `packages/desktop/src/main/`, `packages/desktop/electron*.ts`, resources, and tests: Electron identity, sidecar, user data, protocol, and packaging.
- `packages/app/`, `packages/tui/`, and `packages/console/`: product-facing titles, runtime imports, and product-owned build variables.
- `packages/client/script/`, `packages/sdk/js/script/`, and generator templates: generated import/package names only when generation requires it.
- `.github/`, `nix/`, `install`, README files, and release metadata: product distribution contracts after runtime code is stable.

---

### Task 1: Add The OpenCtrlC Identity Package

**Files:**
- Create: `packages/identity/package.json`
- Create: `packages/identity/src/index.ts`
- Create: `packages/identity/test/index.test.ts`
- Modify: `package.json`
- Modify: `bun.lock`

**Interfaces:**
- Produces package `@openctrlc/identity` with named export `Brand`.
- `Brand` exposes `name`, `cli`, `runtimeDirectory`, `projectDirectory`, `configFile`, `configFileJsonc`, `envPrefix`, `urlScheme`, and `desktopAppId` as readonly string values.
- The package has no runtime dependency on any other workspace package.

- [ ] **Step 1: Write the failing identity test**

```ts
import { describe, expect, test } from "bun:test"
import { Brand } from "@openctrlc/identity"

describe("OpenCtrlC identity", () => {
  test("exposes the independent product namespace", () => {
    expect(Brand.name).toBe("OpenCtrlC")
    expect(Brand.cli).toBe("openctrlc")
    expect(Brand.runtimeDirectory).toBe("openctrlc")
    expect(Brand.projectDirectory).toBe(".openctrlc")
    expect(Brand.configFile).toBe("openctrlc.json")
    expect(Brand.configFileJsonc).toBe("openctrlc.jsonc")
    expect(Brand.envPrefix).toBe("OPENCTRLC_")
    expect(Brand.urlScheme).toBe("openctrlc")
    expect(Brand.desktopAppId).toBe("cn.quniv.openctrlc")
  })
})
```

- [ ] **Step 2: Run the identity test to verify it fails**

Run from the package directory after creating the package manifest:

```bash
cd packages/identity
bun test test/index.test.ts
```

Expected: FAIL because `src/index.ts` and the `Brand` export do not exist.

- [ ] **Step 3: Implement the dependency-free package**

Create `src/index.ts` with one inferred readonly object:

```ts
export const Brand = {
  name: "OpenCtrlC",
  cli: "openctrlc",
  runtimeDirectory: "openctrlc",
  projectDirectory: ".openctrlc",
  configFile: "openctrlc.json",
  configFileJsonc: "openctrlc.jsonc",
  envPrefix: "OPENCTRLC_",
  urlScheme: "openctrlc",
  desktopAppId: "cn.quniv.openctrlc",
} as const
```

Use a package manifest patterned after existing workspace packages, with name
`@openctrlc/identity`, type `module`, private true, and an export mapping for
`.` to `./src/index.ts`. Add the package to the root workspace list.

- [ ] **Step 4: Run the identity test and typecheck**

Run:

```bash
cd packages/identity
bun test test/index.test.ts
bun typecheck
```

Expected: PASS for the test and typecheck. Run `bun install` from the repository
root to update the workspace lockfile, then run `git diff --check`.

- [ ] **Step 5: Commit the self-contained identity unit**

When implementation commits are authorized, stage only the files listed in this
task and use:

```bash
git add package.json bun.lock packages/identity
git commit -m "chore(identity): add OpenCtrlC product identity"
```

---

### Task 2: Rename Internal Workspace Packages And Imports

**Files:**
- Modify: every workspace `package.json` containing an internally owned `@opencode-ai/*` name or dependency.
- Modify: every source, test, script, fixture, and config file containing an internally owned package import or package string.
- Modify: `turbo.json`, root `package.json`, `github/package.json`, and package-local manifests.
- Modify: `bun.lock`, `github/bun.lock`, `sdks/vscode/bun.lock`, and other workspace lockfiles that contain renamed workspace packages.
- Rename: repository-owned `.opencode/` package/config fixture to `.openctrlc/` only if it is a product fixture, not an external test fixture.

**Interfaces:**
- Every internal workspace package is addressable as `@openctrlc/<name>`.
- No product-owned import resolves through `@opencode-ai/*`.
- Third-party packages such as `opencode-gitlab-auth` and `opencode-poe-auth` remain unchanged.

- [ ] **Step 1: Build a machine-readable rename inventory before editing**

Run from the repository root:

```bash
rg -l --glob 'package.json' '"name"\s*:\s*"@opencode-ai/|"@opencode-ai/' . > /tmp/openctrlc-package-files.txt
rg -l --glob '!**/node_modules/**' --glob '!**/dist/**' '@opencode-ai/' . > /tmp/openctrlc-import-files.txt
```

Review the two files and classify each hit as internal or external. Do not include
third-party dependency names in the replacement map.

- [ ] **Step 2: Add a failing namespace audit test/script**

Create a repository script such as `script/check-namespace.ts` that scans tracked
product files and fails when an internal package import matches
`@opencode-ai/(core|schema|protocol|server|client|sdk|plugin|tui|ui|app|desktop|llm|script|...)`.
The script must ignore `node_modules`, `dist`, generated output until its generator
task is complete, and explicit external allowlist entries.

Run it before migration:

```bash
bun script/check-namespace.ts
```

Expected: FAIL with the current internal imports.

- [ ] **Step 3: Rename manifests and internal references using the reviewed map**

Apply the exact internal package map to package `name`, dependency keys/values,
peer dependencies, exports, dynamic imports, task names, build strings, and
TypeScript imports. Do not run an unbounded `s/@opencode-ai/@openctrlc/g` over all
files because it would alter external examples and third-party names.

For each renamed package, verify its manifest name matches its workspace reference:

```bash
bun pm ls
```

- [ ] **Step 4: Regenerate lockfiles from manifests**

Run the install command in each affected workspace rather than editing lockfiles
by hand:

```bash
bun install
bun install --cwd github
bun install --cwd sdks/vscode
```

Run `bun install --frozen-lockfile` afterward from each workspace that has a lockfile.

- [ ] **Step 5: Run the audit and affected package typechecks**

Run:

```bash
bun script/check-namespace.ts
cd packages/schema && bun typecheck
cd ../protocol && bun typecheck
cd ../core && bun typecheck
cd ../server && bun typecheck
cd ../client && bun typecheck
cd ../plugin && bun typecheck
cd ../tui && bun typecheck
cd ../opencode && bun typecheck
```

Expected: the internal package audit passes, all listed packages typecheck, and
the residual `opencode` matches are limited to the external allowlist.

- [ ] **Step 6: Commit the package namespace boundary**

```bash
git add package.json bun.lock turbo.json packages github sdks/vscode script/check-namespace.ts
git commit -m "refactor(namespace): rename workspace packages"
```

---

### Task 3: Rename Project Configuration And Environment Variables

**Files:**
- Modify: `packages/opencode/src/config/paths.ts`
- Modify: `packages/opencode/src/config/config.ts`
- Modify: `packages/opencode/src/config/tui.ts`
- Modify: `packages/opencode/src/config/tui-migrate.ts`
- Modify: `packages/opencode/src/cli/cmd/mcp.ts`
- Modify: `packages/opencode/src/plugin/install.ts`, `packages/opencode/src/skill/discovery.ts`, and plugin/config helpers.
- Modify: `packages/core/src/flag/flag.ts` and all product-owned environment variable readers.
- Rename: repository-owned `.opencode` project config files/directories to `.openctrlc` and `opencode.json(c)` to `openctrlc.json(c)`.
- Modify: affected config tests and fixtures.

**Interfaces:**
- Config discovery recognizes `.openctrlc`, `openctrlc.json`, and `openctrlc.jsonc` only.
- Product flags read `OPENCTRLC_*` only.
- Existing `OPENCODE_*`, `.opencode`, and `opencode.json(c)` values have no effect.
- External provider configuration values and URLs remain unchanged.

- [ ] **Step 1: Add failing config tests for the new names and rejection of old names**

Add tests covering these concrete cases:

```ts
it.effect("loads the OpenCtrlC project config", () =>
  Effect.gen(function* () {
    const root = yield* tempDirectory
    yield* fs.writeFile(path.join(root, ".openctrlc", "openctrlc.json"), '{"theme":"openctrlc"}')
    const config = yield* loadConfig(root)
    expect(config.theme).toBe("openctrlc")
  }),
)

it.effect("does not load the old OpenCode project config", () =>
  Effect.gen(function* () {
    const root = yield* tempDirectory
    yield* fs.writeFile(path.join(root, ".opencode", "opencode.json"), '{"theme":"legacy"}')
    const config = yield* loadConfig(root)
    expect(config.theme).not.toBe("legacy")
  }),
)
```

Use the existing test helpers and actual filesystem behavior; do not add global
mocks.

- [ ] **Step 2: Run the focused config tests to verify the new tests fail**

Run from `packages/opencode`:

```bash
bun test test/config/config.test.ts test/config/tui.test.ts
```

Expected: the new tests fail because discovery still uses the old names.

- [ ] **Step 3: Implement new project config discovery and writes**

Replace product-owned path literals with `Brand.projectDirectory`,
`Brand.configFile`, and `Brand.configFileJsonc`. Update every code path that
discovers or writes global config, MCP config, plugin installs, agents, commands,
skills, themes, tools, and plans. Keep external URLs and provider IDs unchanged.

When a path must be recognized by a type guard, compare against the identity value
instead of accepting both old and new names. Do not add a fallback branch.

- [ ] **Step 4: Rename product-owned flags and environment readers**

Rename each product-owned `Flag.OPENCODE_*` property and its environment lookup to
the matching `OPENCTRLC_*` spelling. Update CLI middleware, server auth/config,
database overrides, test-home variables, model/build variables, and all tests.
Leave `OTEL_*`, provider-specific variables, and external service variables as-is.

- [ ] **Step 5: Rename repository fixtures and run config tests**

Rename the repository's own `.opencode` directory and config fixtures. Run:

```bash
cd packages/core
bun test test/config/config.test.ts test/global.test.ts
cd ../opencode
bun test test/config/config.test.ts test/config/tui.test.ts test/plugin/install.test.ts test/plugin/install-concurrency.test.ts test/cli/mcp-add.test.ts
```

Expected: new-name tests pass, old-name rejection tests pass, and no config test
creates or reads a legacy path.

- [ ] **Step 6: Commit the config boundary**

```bash
git add packages/core packages/opencode .openctrlc script .github
git commit -m "refactor(config): rename OpenCtrlC project namespace"
```

---

### Task 4: Move Core And CLI Runtime Paths To OpenCtrlC

**Files:**
- Modify: `packages/core/src/global.ts`
- Modify: `packages/core/test/global.test.ts`
- Modify: all direct product-owned runtime path literals found under `packages/core` and `packages/opencode`.
- Modify: database, logging, model cache, repository cache, LSP binary, flock, plan, tool-output, and service-state tests.

**Interfaces:**
- `Global.Path.data`, `cache`, `config`, `state`, `tmp`, `log`, `repos`, and `bin` are all under the OpenCtrlC namespace.
- The module creates only OpenCtrlC directories.
- No old directory lookup or fallback exists.

- [ ] **Step 1: Update the global path tests first**

Change the existing assertion to the new identity and add checks that every
product-owned path contains `openctrlc` and none contains `opencode`:

```ts
test("uses the OpenCtrlC runtime namespace", () => {
  expect(Global.Path.tmp).toBe(path.join(os.tmpdir(), "openctrlc"))
  expect(Object.values(Global.Path).every((value) => !value.includes("opencode"))).toBe(true)
})
```

- [ ] **Step 2: Run the global tests to verify they fail**

```bash
cd packages/core
bun test test/global.test.ts
```

Expected: FAIL because `global.ts` still uses `opencode`.

- [ ] **Step 3: Implement identity-backed runtime paths**

Import `Brand` from `@openctrlc/identity` and use `Brand.runtimeDirectory` for XDG
data/cache/config/state and OS temporary paths. Update any separately constructed
product path such as logs, repositories, service state, plans, truncation output,
database, and model cache. Preserve `OPENCTRLC_CONFIG_DIR` override semantics.

- [ ] **Step 4: Run runtime path and focused package tests**

```bash
cd packages/core
bun test test/global.test.ts test/database test/config
bun typecheck
cd ../opencode
bun test test/session test/tool/registry.test.ts
bun typecheck
```

Expected: all created directories and path assertions use OpenCtrlC names.

- [ ] **Step 5: Commit the runtime boundary**

```bash
git add packages/core packages/opencode
git commit -m "refactor(runtime): use OpenCtrlC data paths"
```

---

### Task 5: Expose Only The `openctrlc` CLI

**Files:**
- Modify: `packages/opencode/package.json`
- Modify: `packages/opencode/src/index.ts`
- Modify: `packages/opencode/src/cli/error.ts`, CLI command descriptions, and product-owned subprocess calls.
- Rename: `packages/opencode/bin/opencode` to `packages/opencode/bin/openctrlc`.
- Modify: `packages/opencode/script/build.ts`, `packages/opencode/script/build-node.ts`, and package CLI tests.

**Interfaces:**
- `package.json.bin` contains only `openctrlc`.
- `openctrlc --help`, `openctrlc --version`, and `openctrlc serve --help` work.
- `opencode` is not registered by the package and is not invoked by product-owned subprocesses.

- [ ] **Step 1: Add CLI contract tests**

Add manifest-level and parser-level assertions:

```ts
expect(packageJson.bin).toEqual({ openctrlc: "./bin/openctrlc" })
expect(parserScriptName).toBe("openctrlc")
```

Add a subprocess smoke test that runs the built current-platform binary with
`--version` and checks that the output is non-empty.

- [ ] **Step 2: Run the CLI tests to verify they fail**

```bash
cd packages/opencode
bun test test/cli
```

Expected: FAIL because the package and parser still expose `opencode`.

- [ ] **Step 3: Rename the bin and parser identity**

Use `Brand.cli` for yargs `scriptName`, help suggestions, error output, and
product-owned subprocess invocations. Rename the executable wrapper and update
its cached binary name, platform binary lookup, and error message. Do not change
third-party package names or provider IDs.

- [ ] **Step 4: Align build outputs and smoke test the CLI**

Update `Bun.build` output, compile-time defines, executable names, and user-agent
values to use OpenCtrlC identity. Resolve the existing `lildax`/`opencode2`/
`opencode-cli` mismatch before changing names: one platform package must produce
one `openctrlc` executable and every postinstall/desktop consumer must use that
same file name.

Run:

```bash
cd packages/opencode
bun run build --single --skip-install
./dist/*/bin/openctrlc --version
./dist/*/bin/openctrlc --help
```

Expected: both commands succeed and no `opencode` bin is present in the generated
package manifest.

- [ ] **Step 5: Commit the CLI boundary**

```bash
git add packages/opencode packages/cli
git commit -m "refactor(cli): expose openctrlc command"
```

---

### Task 6: Migrate Desktop And App Product Identity

**Files:**
- Modify: `packages/desktop/electron-builder.config.ts`, `packages/desktop/package.json`, and `packages/desktop/electron.vite.config.ts`.
- Modify: `packages/desktop/src/main/index.ts`, `server.ts`, `sidecar.ts`, `logging.ts`, `store.ts`, `store-keys.ts`, `store-cleanup.ts`, `install-state.ts`, `migrate.ts`, and background CLI code.
- Modify: `packages/desktop/src/main/env.d.ts` and preload declarations.
- Modify: `packages/desktop/src/main/*test.ts` affected by app IDs, store names, and paths.
- Modify: `packages/app/index.html`, app environment declarations, and product-facing title sources.
- Modify: desktop resources, metainfo, launcher, and artifact naming files.

**Interfaces:**
- Product name is `OpenCtrlC`.
- App IDs use `cn.quniv.openctrlc`, `cn.quniv.openctrlc.dev`, and `cn.quniv.openctrlc.beta` as channel variants.
- URL scheme is `openctrlc`; the old scheme is not registered.
- Sidecar virtual module, server dist path, preload declaration, and Electron resolver use the same OpenCtrlC name.

- [ ] **Step 1: Add failing builder and protocol tests**

Update/add tests that assert:

```ts
expect(config.productName).toBe("OpenCtrlC")
expect(config.appId).toBe("cn.quniv.openctrlc.dev")
expect(config.protocols?.schemes).toEqual(["openctrlc"])
expect(config.artifactName).toContain("openctrlc")
```

Add a sidecar test that resolves the same virtual module name used in
`electron.vite.config.ts`, `src/main/sidecar.ts`, and `src/main/env.d.ts`.

- [ ] **Step 2: Run desktop tests to verify the new assertions fail**

```bash
cd packages/desktop
bun test electron-builder.config.test.ts src/main/index.test.ts src/main/install-state.test.ts
```

Expected: FAIL with the current OpenCode app identity.

- [ ] **Step 3: Implement desktop identity and persistence names**

Use `Brand` for product name, app IDs, URL scheme, logs, Electron store names,
downloads, state files, sidecar usernames where product-owned, and background CLI
paths. Do not preserve old protocol registration or old app identity. Keep
external server auth usernames and provider/service identifiers unchanged unless
the code explicitly identifies them as product-owned.

- [ ] **Step 4: Update the app title and build environment**

Change the HTML title and product-owned app/Vite compile-time variables to
OpenCtrlC names. Keep UI localization mechanics intact and do not introduce a new
logo or visual system.

- [ ] **Step 5: Build and run desktop tests**

```bash
cd packages/app
bun run build
bun typecheck
cd ../desktop
bun run build
bun typecheck
bun test electron-builder.config.test.ts src/main/index.test.ts src/main/install-state.test.ts src/main/store-cleanup.test.ts
```

Expected: app and desktop builds complete, sidecar module resolution is consistent,
and all product-owned persistent names use OpenCtrlC.

- [ ] **Step 6: Commit the desktop boundary**

```bash
git add packages/app packages/desktop
git commit -m "refactor(desktop): adopt OpenCtrlC application identity"
```

---

### Task 7: Rename Distribution, Generated References, And Automation

**Files:**
- Modify: `packages/opencode/script/`, `packages/cli/script/`, `packages/desktop/scripts/`, `install`, `nix/`, `.github/`, and release package manifests.
- Modify: generator templates and scripts under `packages/client/script/`, `packages/httpapi-codegen/`, and `packages/sdk/js/script/` only where internal package names are generated.
- Regenerate: `packages/client/src/generated`, `packages/client/src/generated-effect`, and legacy SDK output using documented commands when generator inputs change.
- Modify: root and localized README files, install instructions, and distribution metadata.

**Interfaces:**
- Platform artifacts, package-manager metadata, postinstall scripts, and GitHub artifacts use OpenCtrlC names.
- Generated files match their generators and do not contain stale internal `@opencode-ai/*` imports.
- External repository URLs, service URLs, provider IDs, third-party dependencies, and OAuth audiences remain on the explicit allowlist.

- [ ] **Step 1: Add a release contract audit**

Create a script or test that verifies the single CLI contract across package bin,
platform artifact, executable output, postinstall target, desktop background CLI,
Nix `mainProgram`, and package-manager metadata. It must fail if any of the names
`lildax`, `opencode2`, or `opencode-cli` are used as the product CLI output.

- [ ] **Step 2: Run the release audit to verify current inconsistencies are detected**

```bash
bun script/check-distribution.ts
```

Expected: FAIL on the existing inconsistent artifact names before the migration is
applied.

- [ ] **Step 3: Align build and package-manager metadata**

Update platform package names, executable paths, postinstall scripts, Nix
attributes, Homebrew/Scoop/Chocolatey/AUR metadata, installer output, signing
paths, and GitHub artifact names to the one `openctrlc` contract. Do not alter
external GitHub action package names or OpenCode service URLs unless they are
explicitly product-owned release destinations.

- [ ] **Step 4: Update generators before generated output**

Change generator templates and package-name inputs first. If the public Protocol or
Server `HttpApi` is unchanged, do not regenerate unrelated generated files. If the
migration changes generated import/package names, run:

```bash
cd packages/client
bun run generate
bun run check:generated
cd ../sdk/js
bun run build
```

Never hand-edit generated directories.

- [ ] **Step 5: Run install, typecheck, and distribution smoke checks**

```bash
bun install --frozen-lockfile
bun pm ls
cd packages/opencode && bun typecheck
cd ../cli && bun typecheck
cd ../desktop && bun typecheck
cd ../client && bun typecheck
cd ../sdk/js && bun typecheck
```

Run `actionlint` if available and `nix flake check --no-update-lock-file` when the
host has the repository's Nix dependencies.

- [ ] **Step 6: Commit the build and distribution boundary**

```bash
git add packages nix .github install script README*.md
git commit -m "chore(build): rename OpenCtrlC distribution metadata"
```

---

### Task 8: Final Residual Audit And Isolated Runtime Verification

**Files:**
- Modify: tests and audit allowlists only when a verified missed product-owned reference is found.
- Create: `docs/superpowers/audits/2026-08-19-openctrlc-residuals.md`.

**Interfaces:**
- The audit records intentional external OpenCode strings and proves product-owned OpenCode names are absent.
- The isolated runtime test proves new directories are used and old variables/directories have no effect.

- [ ] **Step 1: Run product-owned residual searches**

```bash
rg -n '@opencode-ai/|OPENCODE_|\.opencode|opencode\.jsonc?|opencode\.json' \
  --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!bun.lock' .
rg -n 'path\.(join|resolve)\([^)]*opencode|import\([^)]*opencode|require\([^)]*opencode' packages script github
```

Classify every match in the audit as either a missed product-owned reference or an
allowlisted external identifier. Do not suppress a match merely because a test
currently passes.

- [ ] **Step 2: Run the isolated CLI/runtime smoke test**

Use a fresh temporary home and XDG roots:

```bash
ROOT="$(mktemp -d)"
env -i HOME="$ROOT/home" XDG_DATA_HOME="$ROOT/data" XDG_CACHE_HOME="$ROOT/cache" \
  XDG_CONFIG_HOME="$ROOT/config" XDG_STATE_HOME="$ROOT/state" PATH="$PATH" \
  OPENCTRLC_DISABLE_MODELS_FETCH=1 openctrlc --version
```

Assert that only `openctrlc` runtime directories are created. Run a second case
with an old `opencode` directory and an `OPENCODE_TEST_HOME` value; assert neither
changes the selected paths.

- [ ] **Step 3: Run final package tests and builds**

```bash
cd packages/core && bun test && bun typecheck
cd ../opencode && bun test && bun typecheck
cd ../app && bun run build && bun typecheck
cd ../desktop && bun run build && bun typecheck
```

Run platform packaging only on supported hosts:

```bash
bun run package:mac
bun run package:win
bun run package:linux
```

- [ ] **Step 4: Review status and commit the audit**

```bash
git diff --check
git add docs/superpowers/audits/2026-08-19-openctrlc-residuals.md
git commit -m "docs(identity): record OpenCtrlC namespace audit"
```

The final response must report exact commands run and any platform checks that
could not run on the current host; do not claim a clean workspace unless
`git status --short` is empty.

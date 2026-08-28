# Task 4 Report

## Scope

- Core XDG data, cache, config, state, and temporary paths now use `Brand.runtimeDirectory`.
- Core log, repository, database, project cache, migration temporary, model cache, flock, and process-test paths use OpenCtrlC names.
- CLI runtime temporary, LSP temporary, project cache, test fixture, storage, plan, tool-output, repository, and service-state paths resolve through the OpenCtrlC runtime namespace.
- `OPENCTRLC_CONFIG_DIR` and other Task 3 configuration/environment boundaries remain unchanged.
- External provider IDs, provider-specific API keys, service domains, schema URLs, `OPENCODE_API_KEY`, and `OTEL_*` contracts remain unchanged.

## Verification

- `cd packages/core && bun test test/global.test.ts test/database test/config`: `70 pass, 0 fail`.
- `cd packages/opencode && bun test test/session test/tool/registry.test.ts`: `417 pass, 7 skip, 1 todo, 0 fail`.
- `cd packages/core && bun typecheck`: exit `0`.
- `cd packages/opencode && bun typecheck`: exit `0`.
- `git diff --check`: exit `0`.
- Runtime path assertion: `Global.Path` values use `openctrlc` and contain no `opencode` runtime segment.
- Runtime literal audit: no old Core runtime path literals remain; remaining opencode path strings are limited to explicit external/Desktop or out-of-scope boundaries.

## Concerns

- The existing `ai.opencode.managed` managed-preference domain and legacy CLI uninstall cleanup markers remain unchanged because managed preferences and release/installation migration are outside Task 4.
- The existing Task 3 report has unrelated user changes and was not staged or committed.
- The session suite retains its existing skipped and todo tests; no new failures were introduced.

## Commit

Initial runtime boundary: `79a5d982d82b4729a246d98542fec00f58ecf006`

## Review Fixes

- `packages/opencode/script/run-workspace-server` now derives the debug data file and child `XDG_DATA_HOME` from `Brand.runtimeDirectory`; CLI bin paths remain unchanged.
- HTTP API exercise global and database paths now use `openctrlc-httpapi-*` names. The existing `OPENCODE_HTTPAPI_EXERCISE_*` controls remain unchanged as test-only compatibility inputs.
- Global path tests now assert exact `data`, `cache`, `config`, `state`, `tmp`, `log`, `repos`, and `bin` structures, plus default database, logger, and flock locations.
- Direct runtime comments in trace and saved-variant code now document OpenCtrlC paths.

## Review Fix Verification

- `cd packages/core && bun test test/global.test.ts test/database-migration.test.ts test/effect/observability.test.ts test/util/flock.test.ts test/util/effect-flock.test.ts`: `45 pass, 0 fail`.
- `cd packages/opencode && bun test ./test/server/httpapi-exercise/environment.ts`: module loaded successfully; no test cases are defined in the environment module.
- `cd packages/opencode && bun test test/session test/tool/registry.test.ts`: `417 pass, 7 skip, 1 todo, 0 fail`.
- `cd packages/core && bun typecheck`: exit `0`.
- `cd packages/opencode && bun typecheck`: exit `0`.
- `bun install --frozen-lockfile --ignore-scripts`: exit `0`, no changes.
- `git diff --check`: exit `0`.

## Review Fix Concerns

- The report remains intentionally unstaged and uncommitted. The pre-existing Task 3 report change remains untouched.
- Managed preferences, CLI bin, Desktop/release, project configuration, and environment-variable migrations remain outside this review fix.

## Review Fix Commit

`65b6bfe6cc82663b4028f5802a6d62ca1e6256a8 fix(runtime): complete OpenCtrlC path migration`

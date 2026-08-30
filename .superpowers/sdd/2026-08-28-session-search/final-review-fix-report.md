# Final Review Fix Report

## Status

Final whole-branch review fix wave implemented. Fresh verification was performed against HEAD `147e7f3`. No Protocol or Server public API was changed, no unrelated stability test was modified, and no app/server process was restarted. This revision changes only this report.

## Fixes

1. Initial history readiness now waits for the initial resource load to settle, independent of cached user messages. The hydrator also waits while history metadata is loading, so `ready=true, more=false, loading=true` resumes when `more=true`. Regression coverage is in the session-search and timeline model tests.
2. Stale-session coverage now performs same-page router navigation with the mounted app. Old and new sessions use unique text markers; after releasing the old request, the test asserts that the old marker is absent from the new session's visible message body and search results, that no old active marker remains, and that the new marker remains visible.
3. The timeline fixture tracks page-request overlap. A real mounted timeline scroll is exercised while a search page is blocked; the request counter verifies normal history does not start or overlap before search releases.
4. Partial-failure data uses a broad query with initial-page matches. The test verifies partial results remain visible with the error and that retry adds the earlier-page results.

## Verification

All commands were run from `packages/app` unless noted.

### Focused session, timeline, and message gesture tests

```text
Focused session/timeline/message gesture validation

69 pass
0 fail
```

### Search and drag focused Playwright

```text
PLAYWRIGHT_PORT=3003 \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell" \
bunx playwright test --config e2e/performance/timeline-stability/playwright.config.ts \
  search.spec.ts scroll-interaction.spec.ts

7 passed
0 failed
```

### Type checks

```text
bun typecheck
exit 0

bun run typecheck:e2e
exit 0
```

### Full timeline stability

```text
PLAYWRIGHT_PORT=3005 \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell" \
bun run test:stability

Visual stability unit: 23 pass, 0 fail
Timeline stability Playwright: 49 passed, 1 failed
```

The only failure is the explicit shell virtualization scenario in `adverse.spec.ts`. Drag scrolling passed. The earlier `48 passed, 2 failed` result is historical, not the current result. Full timeline stability remains non-green, and this report does not claim the full suite is green.

## Stability Baseline

After installing dependencies, the requested baseline worktrees were able to run the target failure scenarios. At `fd19281`, `adverse.spec.ts` failed and drag scrolling passed. At `f63a2cf`, `adverse.spec.ts` failed and drag scrolling failed. On the current revision, drag scrolling passes while `adverse.spec.ts` still fails. This gives stronger evidence that the adverse failure predates the current revision, but does not justify over-attributing it without ruling out environment and timing effects. The drag failure has been fixed on the current revision.

## Concerns

- Full timeline stability remains non-green at 49 passed and 1 failed. The remaining failure is the explicit shell virtualization scenario in `adverse.spec.ts` and is recorded above.
- The production build continues to emit existing Vite warnings for mixed dynamic/static imports, duplicate WASM map output, and large chunks.
- The focused session/timeline/message gesture validation, search and drag Playwright coverage, `bun typecheck`, and `bun run typecheck:e2e` passed as recorded above. Build warnings remain, and full timeline stability is still not fully green.

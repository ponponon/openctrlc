# Final Review Fix Report

## Status

Final whole-branch review fix wave implemented. No Protocol or Server public API was changed, and no app/server process was restarted.

## Fixes

1. Initial history readiness now waits for the initial resource load to settle, independent of cached user messages. The hydrator also waits while history metadata is loading, so `ready=true, more=false, loading=true` resumes when `more=true`. Regression coverage is in the session-search and timeline model tests.
2. Stale-session coverage now performs same-page router navigation with the mounted app. The released old request is checked against the new session's visible content, search results, and active marker.
3. The timeline fixture tracks page-request overlap. A real mounted timeline scroll is exercised while a search page is blocked; the request counter verifies normal history does not start or overlap before search releases.
4. Partial-failure data uses a broad query with initial-page matches. The test verifies partial results remain visible with the error and that retry adds the earlier-page results.

## Verification

All commands were run from `packages/app` unless noted.

### Focused search and timeline tests

```text
bun test --conditions=solid --preload ./happydom.ts \
  ./src/pages/session/session-search.test.ts \
  ./src/pages/session/timeline/history-anchor.test.ts \
  ./src/pages/session/timeline/projection.test.ts \
  ./src/pages/session/timeline/model.test.ts

58 pass
0 fail
145 expect() calls
```

### Browser-condition coverage

```text
bun test --conditions=browser --preload ./happydom.ts \
  ./test-browser/session-search.test.ts ./src/i18n/parity.test.ts

9 pass
0 fail
11463 expect() calls
```

### Playwright search integration

```text
PLAYWRIGHT_PORT=3003 \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell" \
bunx playwright test --config e2e/performance/timeline-stability/playwright.config.ts search.spec.ts

6 passed
0 failed
```

### Type checks and diff hygiene

```text
bun typecheck
exit 0

bun run typecheck:e2e
exit 0

git diff --check
exit 0
```

### Full timeline stability

```text
PLAYWRIGHT_PORT=3005 \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell" \
bun run test:stability

46 passed
4 failed
```

The four failures are unrelated stability scenarios: `adverse.spec.ts` explicit shell virtualization, `context-matrix.spec.ts` first context-member removal, and two `scroll-interaction.spec.ts` keyboard/drag scrolling cases. All six session-search stability tests passed. No unrelated stability test was modified.

## Stability Baseline

The requested baseline worktrees at `fd19281` and `f63a2cf` were not runnable: both failed before Playwright startup with `error: unknown command 'test'`. They therefore provide no reliable baseline pass/fail attribution. The fresh current full-suite result is recorded above rather than claiming stability is green.

## Concerns

- Full timeline stability remains non-green at 46 passed and 4 failed; baseline attribution is unresolved because the detached baseline worktrees could not start Playwright.
- The production build continues to emit existing Vite warnings for mixed dynamic/static imports, duplicate WASM map output, and large chunks.
- Running the unfiltered `bun test` also exposed existing environment/baseline failures outside this fix wave, including Solid server export errors and desktop locale detection; focused required tests and type checks pass.

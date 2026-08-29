# Final Review Fix Report

## Status

Final whole-branch review fix wave implemented. No Protocol or Server public API was changed, no unrelated stability test was modified, and no app/server process was restarted.

## Fixes

1. Initial history readiness now waits for the initial resource load to settle, independent of cached user messages. The hydrator also waits while history metadata is loading, so `ready=true, more=false, loading=true` resumes when `more=true`. Regression coverage is in the session-search and timeline model tests.
2. Stale-session coverage now performs same-page router navigation with the mounted app. Old and new sessions use unique text markers; after releasing the old request, the test asserts that the old marker is absent from the new session's visible message body and search results, that no old active marker remains, and that the new marker remains visible.
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

23 pass, 0 fail: visual-stability unit tests
48 passed
2 failed: timeline-stability Playwright tests
```

The two failures are unrelated stability scenarios: `adverse.spec.ts` explicit shell virtualization and `scroll-interaction.spec.ts` drag scrolling. All six session-search stability tests passed. No unrelated stability test was modified. An immediately preceding fresh run observed 47 passed and 3 failed, with the same two failures plus the existing `context-matrix.spec.ts` first context-member removal failure; the non-search stability outcomes are machine/timing-sensitive.

## Stability Baseline

The requested baseline worktrees at `fd19281` and `f63a2cf` were rechecked with the same `bun run test:stability` command. Both were blocked before the stability tests could run because their worktrees could not resolve `@happy-dom/global-registrator` from `packages/app/happydom.ts`; each reported `Cannot find module '@happy-dom/global-registrator'`. They provide no baseline pass/fail data, so no stability failure is attributed to either baseline. The fresh current full-suite result is recorded above; stability is not green.

## Concerns

- Full timeline stability remains non-green; the latest fresh run was 48 passed and 2 failed, while the immediately preceding fresh run was 47 passed and 3 failed. Baseline attribution is unresolved because both detached baseline worktrees were blocked by the missing `@happy-dom/global-registrator` dependency before tests could run.
- The production build continues to emit existing Vite warnings for mixed dynamic/static imports, duplicate WASM map output, and large chunks.
- The requested focused tests, browser-condition tests, Playwright search integration, `bun typecheck`, and `bun run typecheck:e2e` passed. The full suite remains non-green as recorded above.

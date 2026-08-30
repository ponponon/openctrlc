# Final Review Fix Report

## Status

Final whole-branch review fix wave implemented. No Protocol or Server public API was changed, no unrelated stability test was modified, and no app/server process was restarted.

## Fixes

1. Initial history readiness now waits for the initial resource load to settle, independent of cached user messages. The hydrator also waits while history metadata is loading, so `ready=true, more=false, loading=true` resumes when `more=true`. Regression coverage is in the session-search and timeline model tests.
2. Stale-session coverage now performs same-page router navigation with the mounted app. Old and new sessions use unique text markers; after releasing the old request, the test asserts that the old marker is absent from the new session's visible message body and search results, that no old active marker remains, and that the new marker remains visible.
3. The timeline fixture tracks page-request overlap. A real mounted timeline scroll is exercised while a search page is blocked; the request counter verifies normal history does not start or overlap before search releases.
4. Partial-failure data uses a broad query with initial-page matches. The test verifies partial results remain visible with the error and that retry adds the earlier-page results.
5. Patch file extraction now checks the shared document budget before reading each indexed file. Once the first file consumes the 100,000 UTF-16-character budget, later patch-file getters are not accessed. The regression test also preserves the existing recursion/depth coverage.

## Verification

All commands were run from `packages/app` unless noted.

### Focused search and timeline tests

```text
bun test --conditions=solid --preload ./happydom.ts \
  ./src/pages/session/session-search.test.ts \
  ./src/pages/session/timeline/history-anchor.test.ts \
  ./src/pages/session/timeline/projection.test.ts \
  ./src/pages/session/timeline/model.test.ts

61 pass
0 fail
148 expect() calls
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

### Fresh Full Timeline Stability (Before Drag Fix)

```text
PLAYWRIGHT_PORT=3007 \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell" \
bun run test:stability

23 pass, 0 fail: visual-stability unit tests
48 passed
2 failed: timeline-stability Playwright tests
```

This run recorded `adverse.spec.ts` explicit shell virtualization and `scroll-interaction.spec.ts` drag scrolling. All six session-search stability tests passed. No unrelated stability test was modified. The historical 47 passed and 3 failed result included `context-matrix.spec.ts` first context-member removal; it is not the current result. The non-search stability outcomes are machine/timing-sensitive.

## Stability Baseline

The requested baseline worktrees at `fd19281` and `f63a2cf` were rechecked with the same `bun run test:stability` command. Both were blocked before the stability tests could run because their worktrees could not resolve `@happy-dom/global-registrator` from `packages/app/happydom.ts`; each reported `Cannot find module '@happy-dom/global-registrator'`. They provide no baseline pass/fail data, so no stability failure is attributed to either baseline. The fresh current full-suite result is recorded above; stability is not green.

## Concerns

- Full timeline stability remained non-green in the pre-drag-fix run at 48 passed and 2 failed. The current failures from that run are explicitly listed above; the historical 47/3 result is not the current result. Baseline attribution is unresolved because both detached baseline worktrees were blocked by the missing `@happy-dom/global-registrator` dependency before tests could run.
- The production build continues to emit existing Vite warnings for mixed dynamic/static imports, duplicate WASM map output, and large chunks.
- The requested focused tests, browser-condition tests, Playwright search integration, `bun typecheck`, `bun run typecheck:e2e`, and `git diff --check` passed. The full suite remains non-green as recorded above.

## Final Review Fix Wave

### Fixes

1. Search result recomputation now reveals the first valid active match automatically and reveals again only when the active match identity or range changes. Manual navigation keeps its existing immediate reveal path, while streaming updates that leave the active match unchanged do not force-scroll repeatedly. The search Playwright scenario now fills an offscreen query and verifies the marker and centered result without clicking Next.
2. All-content extraction now shares the document's remaining UTF-16 budget with nested readable-string traversal. Traversal stops before reading later fields once the budget is exhausted and is bounded by explicit depth and node limits with a `WeakSet` cycle guard. Boundary tests cover throwing later getters, patch files, and cyclic input.

### Fresh Verification

The final fix-wave commands were run from `packages/app`:

```text
bun test --conditions=solid --preload ./happydom.ts \
  ./src/pages/session/session-search.test.ts \
  ./src/pages/session/timeline/history-anchor.test.ts \
  ./src/pages/session/timeline/projection.test.ts \
  ./src/pages/session/timeline/model.test.ts

61 pass
0 fail
148 expect() calls

bun test --conditions=browser --preload ./happydom.ts \
  ./test-browser/session-search.test.ts ./src/i18n/parity.test.ts

9 pass
0 fail
11463 expect() calls

bun typecheck
exit 0

bun run typecheck:e2e
exit 0

PLAYWRIGHT_PORT=3003 \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell" \
bunx playwright test --config e2e/performance/timeline-stability/playwright.config.ts search.spec.ts

6 passed
0 failed

PLAYWRIGHT_PORT=3007 \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell" \
bun run test:stability

23 pass, 0 fail: visual-stability unit tests
48 passed, 2 failed: timeline-stability Playwright tests
```

The drag-selection failure was fixed in commit `147e7f3` by restoring pointer gesture tracking without cancelling history-anchor correction. Its focused test and the full stability run after the fix passed. The full stability run after that fix recorded `49 passed, 1 failed`; the remaining failure is `adverse.spec.ts` explicit shell virtualization. That scenario was also observed in the baseline comparison runs after dependencies were installed, so it is treated as an existing residual stability failure rather than a search-specific failure. No unrelated stability test was modified.

`git diff --check` also passed. The optional active-match-unchanged reveal test was not added because it was not required for this fix wave.

## Drag-Selection Regression Fix

Commit `147e7f3` restored the timeline viewport's pointer gesture tracking. The handlers mark the existing outer scroll gesture for mouse selection drags but do not cancel correcting history anchors; custom scrollbar pointer-down still cancels correcting anchors through `ScrollView.onThumbPointerDown`.

Verification after the fix:

```text
Focused session/timeline/message gesture tests: 69 pass, 0 fail
Search and drag Playwright scenarios: 7 passed, 0 failed
bun typecheck: exit 0
bun run typecheck:e2e: exit 0
Visual stability unit tests: 23 pass, 0 fail
Timeline stability: 49 passed, 1 failed
Remaining failure: adverse.spec.ts explicit shell virtualization
```

The baseline worktrees, after installing their locked dependencies, also failed the explicit shell virtualization scenario. This provides evidence that the remaining failure is not specific to session search, while the baseline instability is still documented rather than hidden.

## Drag-Selection Regression Fix

### Root Cause

The session-search branch had removed `MessageTimeline`'s viewport pointer handlers. Mouse text selection therefore never called `onMarkScrollGesture`, so dragging past the timeline boundary did not keep the automatic scroll path active. The baseline `fd19281` passed the focused scenario; the session-search worktree reproduced the failure with a remaining scroll distance of 140 instead of greater than 500.

### Fix

1. Restored viewport `pointerdown` and button-1 `pointermove` handlers. They mark the existing scroll gesture only and do not cancel history-anchor correction.
2. Kept `onThumbPointerDown={() => anchorRegistry.cancelCorrections()}` on `ScrollView`, so custom scrollbar drags still cancel correcting RAFs through the existing production callback.
3. Added focused production-helper coverage proving connected pointer down/move marks the gesture while an active correction remains correcting. No `adverse.spec.ts` or unrelated stability test was modified.

### Verification

```text
Initial focused reproduction, session-search worktree:
PLAYWRIGHT_PORT=3015 bunx playwright test --config e2e/performance/timeline-stability/playwright.config.ts scroll-interaction.spec.ts:51
1 failed: received remaining scroll distance 140, expected > 500

Focused session/timeline tests:
bun test --conditions=solid --preload ./happydom.ts ./src/pages/session/session-search.test.ts ./src/pages/session/timeline/history-anchor.test.ts ./src/pages/session/timeline/projection.test.ts ./src/pages/session/timeline/model.test.ts
62 pass, 0 fail, 154 expect() calls

Focused drag regression after fix:
PLAYWRIGHT_PORT=3020 bunx playwright test --config e2e/performance/timeline-stability/playwright.config.ts scroll-interaction.spec.ts:51
1 passed, 0 failed

Search Playwright coverage:
PLAYWRIGHT_PORT=3021 bunx playwright test --config e2e/performance/timeline-stability/playwright.config.ts search.spec.ts
6 passed, 0 failed

bun typecheck
exit 0

bun run typecheck:e2e
exit 0

git diff --check
exit 0

PLAYWRIGHT_PORT=3022 bun run test:stability
23 pass, 0 fail: visual-stability unit tests
49 passed, 1 failed: timeline-stability Playwright tests
```

### Remaining Stability

The drag-selection regression now passes in the focused run and in the full stability run. Full stability remains non-green because the existing `adverse.spec.ts` explicit shell virtualization scenario failed; `adverse.spec.ts` was not changed. The full run also initially encountered the already-used default port and was rerun successfully with `PLAYWRIGHT_PORT=3022`. Existing Vite mixed dynamic/static import, duplicate WASM map, and large-chunk warnings remain unchanged.

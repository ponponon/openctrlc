# Task 4 Anchor Lifecycle Report

## Status

Implemented and committed the Task 4 history-anchor lifecycle redesign. Task 5 active-message marker was not implemented.

## Root Cause Reproduction

The pre-change focused suite passed despite the reported lifecycle defect because the existing tests treated `restore(true)` as a completed operation. A deterministic registry test was added first and failed against the old implementation: the registry did not expose phase-aware predicates/cancellation, and a restore callback had no settled boundary. The implementation was then changed to keep correcting entries active until an explicit `settled()` callback.

The second defect was traced through `MessageTimeline.restorePrependAnchor`: the RAF loop was keyed by the captured snapshot, while registry updates replaced the pending snapshot object. The correction therefore could not observe later pending updates. The correction now starts only from the frozen snapshot passed at transition time and resolves the timeline element by key on every frame.

## Changed Files

- `packages/app/src/pages/session/timeline/history-anchor.ts`
  - Added explicit `pending` and `correcting` phases.
  - Added phase-aware `hasPending`, `hasCorrecting`, `updatePending`, `cancelCorrections`, `cancelAll`, and `cleanup` behavior.
  - Kept strictly unique `Symbol` entry tokens.
  - Added single-corrector ownership: starting a correction stops only the prior correcting entry and preserves pending entries.
  - Added deterministic correction RAF lifecycle with consecutive-stability and hard-frame limits.
- `packages/app/src/pages/session/timeline/message-timeline.tsx`
  - Uses one registry for normal and search captures.
  - Keeps prepend snapshots mutable only while pending and freezes the correction target after restore starts.
  - Resolves the current timeline element on every RAF frame rather than retaining a detached DOM node.
  - Cancels correcting RAFs only from explicit user intent (`wheel`, touch start/move, pointer down, and scroll-key keydown), not ordinary correction-generated `scroll` events.
  - Removes the old ambiguous `hasAny()` control flow.
  - Clears the registry and its RAF ownership during timeline cleanup without installing a disconnected dummy capture handler.
- `packages/app/src/pages/session.tsx`
  - Makes the capture bridge optional while the timeline is unmounted, avoiding a fake unconnected anchor implementation.
- `packages/app/src/pages/session/session-search.test.ts`
  - Updates registry tests for the explicit settled lifecycle and pending-only updates.
- `packages/app/src/pages/session/timeline/history-anchor.test.ts`
  - Adds deterministic coverage for registry phases, cancellation isolation, single-corrector ownership, snapshot freezing, cleanup, convergence, frame limits/ownership, and cancellation without scroll self-cancellation.

## Verification

All commands were run from `packages/app` unless noted.

### Focused tests

Command:

```bash
bun test --conditions=solid --preload ./happydom.ts ./src/pages/session/session-search.test.ts ./src/pages/session/timeline/history-anchor.test.ts
```

Result: **37 pass, 0 fail, 97 expect() calls**.

### App typecheck

Command:

```bash
bun typecheck
```

Result: **passed** (`tsgo -b`).

### E2E typecheck

Command:

```bash
bun run typecheck:e2e
```

Result: **passed** (`tsgo -p e2e/tsconfig.json`).

### Diff check

Command:

```bash
git diff --check
```

Result: **passed** with no whitespace errors.

## Residual Concerns

- The focused timeline correction test exercises the extracted deterministic correction loop rather than mounting the full Solid timeline. The full consumer path is typechecked, and the registry plus correction loop are tested through their real interfaces.
- No browser/e2e runtime test was run because the brief required focused tests and typechecks; no app or server process was restarted.
- Stability thresholds remain the existing values of 30 consecutive stable frames and 180 total frames. They are now explicit and enforceable, but tuning them against production telemetry may still be useful.

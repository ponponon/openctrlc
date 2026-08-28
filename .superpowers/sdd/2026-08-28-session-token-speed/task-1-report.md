# Task 1 Report

## Benchmark

Command run from `packages/app`:

```bash
bun run test:bench
```

Result: failed before measurements. Bun could not resolve `@happy-dom/global-registrator` from `packages/app/happydom.ts`; 0 passed, 11 failed, 11 errors.

Fallback stability command:

```bash
bun run test:stability
```

Result: failed before measurements for the same missing `@happy-dom/global-registrator` module; 0 passed, 1 failed, 1 error.

## Changes

Created `packages/session-ui/src/components/message-statistics.test.ts` with the calculation contract and invalid-input cases from the brief. No production helper was implemented.

## Tests

Command run from `packages/session-ui`:

```bash
bun test src/components/message-statistics.test.ts
```

Result: expected failure because `./message-statistics` does not exist; 0 passed, 1 failed, 1 error.

## Commit

`e0ac19ca9c5992a2eaf2f0672d6ca40198304820` (`test(session-ui): add assistant statistics contract`)

## Concerns

- The benchmark and fallback stability suite could not report first-render or timeline-stability measurements because the worktree is missing the `@happy-dom/global-registrator` dependency.
- The focused calculation test is intentionally red until Task 2 adds `message-statistics.ts` and `assistantStatistics`.

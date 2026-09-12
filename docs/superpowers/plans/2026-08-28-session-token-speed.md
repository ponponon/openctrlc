# Session Token Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show output token count and average output tokens per second for each completed assistant response in both OpenCtrlC session UI paths.

**Architecture:** Add a pure helper in `packages/session-ui` that validates assistant timing/token inputs and returns display-ready statistics. Render those statistics from the existing shared assistant text metadata row in `message-part.tsx`, so both the app virtualized timeline and the shared `SessionTurn` component receive identical behavior without changes to the session data contract.

**Tech Stack:** SolidJS, TypeScript, Bun tests, `@openctrlc/ui` i18n, `Intl.NumberFormat`, existing session message types.

## Global Constraints

- Use the existing assistant fields `message.tokens.output`, `message.time.created`, and `message.time.completed`; do not add provider-specific timing fields.
- Measure `tokensPerSecond = output / ((completed - created) / 1000)` using the full assistant message interval.
- Omit statistics when output is not positive, timestamps are missing/non-finite, or `completed <= created`.
- Render statistics only beside the last copyable text part for an assistant message.
- Reuse the existing `text-part-meta` styling and hover/focus reveal behavior.
- Do not hardcode user-visible English strings; use shared UI i18n keys.
- Add English and Chinese translations; rely on the existing UI i18n fallback for other locales.
- Keep runtime dependencies directed according to the repository package boundaries.
- Before changing session/timeline code, record the production benchmark required by `packages/app/AGENTS.md` and compare it after implementation.
- Run type checking from package directories with `bun typecheck`; do not run `tsc` directly.
- Do not edit generated files.

## File Map

- Create: `packages/session-ui/src/components/message-statistics.ts` - pure validation and tokens-per-second calculation.
- Test: `packages/session-ui/src/components/message-statistics.test.ts` - calculation and formatting boundary tests.
- Modify: `packages/session-ui/src/components/message-part.tsx` - calculate and render shared assistant token statistics.
- Modify: `packages/ui/src/i18n/en.ts` - English token-statistics translation keys.
- Modify: `packages/ui/src/i18n/zh.ts` - Chinese token-statistics translation keys.
- Test: `packages/session-ui/src/components/message-part.test.ts` - shared text metadata behavior if a render-level test is practical under the existing test setup.
- Modify: `packages/session-ui/src/components/message-part.css` only if the existing metadata row cannot accommodate the added values without a targeted responsive/style adjustment.

## Task 1: Record Baseline And Add Calculation Tests

**Files:**

- Create: `packages/session-ui/src/components/message-statistics.test.ts`

**Interfaces:**

- Produces the test contract for `assistantStatistics` from `message-statistics.ts`:

```ts
type AssistantStatisticsInput = {
  output: number | undefined
  created: number | undefined
  completed: number | undefined
}

type AssistantStatistics =
  | {
      output: number
      durationMs: number
      tokensPerSecond: number
    }
  | undefined

function assistantStatistics(input: AssistantStatisticsInput): AssistantStatistics
```

- [ ] **Step 1: Record the current production benchmark**

Run from `packages/app` before editing session/timeline implementation files:

```bash
bun run test:bench
```

Record the command outcome and the reported first-render/timeline stability measurements in the implementation notes or task output. If the full benchmark is unavailable in the environment, run the focused stability command and record the limitation:

```bash
bun run test:stability
```

- [ ] **Step 2: Write failing calculation tests**

Create `packages/session-ui/src/components/message-statistics.test.ts` with tests equivalent to:

```ts
import { describe, expect, test } from "bun:test"
import { assistantStatistics } from "./message-statistics"

describe("assistantStatistics", () => {
  test("calculates output tokens, duration, and tokens per second", () => {
    expect(assistantStatistics({ output: 800, created: 1_000, completed: 3_000 })).toEqual({
      output: 800,
      durationMs: 2_000,
      tokensPerSecond: 400,
    })
  })

  test("accepts fractional rates", () => {
    expect(assistantStatistics({ output: 408, created: 0, completed: 2_600 })?.tokensPerSecond).toBeCloseTo(156.9230769)
  })

  test.each([
    { output: 0, created: 1_000, completed: 2_000 },
    { output: undefined, created: 1_000, completed: 2_000 },
    { output: 100, created: undefined, completed: 2_000 },
    { output: 100, created: 1_000, completed: undefined },
    { output: 100, created: 2_000, completed: 1_000 },
    { output: 100, created: 1_000, completed: 1_000 },
    { output: Number.NaN, created: 1_000, completed: 2_000 },
    { output: 100, created: Number.POSITIVE_INFINITY, completed: 2_000 },
  ])("rejects invalid input %#", (input) => {
    expect(assistantStatistics(input)).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run the new test to verify it fails**

Run from `packages/session-ui`:

```bash
bun test src/components/message-statistics.test.ts
```

Expected: FAIL because `message-statistics.ts` and `assistantStatistics` do not exist yet.

## Task 2: Implement The Pure Statistics Boundary

**Files:**

- Create: `packages/session-ui/src/components/message-statistics.ts`
- Test: `packages/session-ui/src/components/message-statistics.test.ts`

**Interfaces:**

- Consumes the numeric fields supplied by an assistant message.
- Produces `AssistantStatistics | undefined` exactly as declared in Task 1.
- The helper must be a named export from `message-statistics.ts` so the unit test and `message-part.tsx` use one implementation.

- [ ] **Step 1: Implement the minimal validator and calculation**

Implement `assistantStatistics` with an early return unless all three values are finite numbers, `output > 0`, and `completed > created`. Return the original output, millisecond duration, and rate in tokens per second. Do not format strings in this module.

```ts
export function assistantStatistics(input: AssistantStatisticsInput): AssistantStatistics {
  if (
    typeof input.output !== "number" ||
    typeof input.created !== "number" ||
    typeof input.completed !== "number" ||
    !Number.isFinite(input.output) ||
    !Number.isFinite(input.created) ||
    !Number.isFinite(input.completed) ||
    input.output <= 0 ||
    input.completed <= input.created
  ) {
    return
  }

  const durationMs = input.completed - input.created
  return {
    output: input.output,
    durationMs,
    tokensPerSecond: (input.output / durationMs) * 1000,
  }
}
```

- [ ] **Step 2: Run the calculation tests**

Run from `packages/session-ui`:

```bash
bun test src/components/message-statistics.test.ts
```

Expected: PASS for all calculation and invalid-input cases.

- [ ] **Step 3: Run package type checking**

Run from `packages/session-ui`:

```bash
bun typecheck
```

Expected: PASS with no new diagnostics.

## Task 3: Add Shared UI Translations

**Files:**

- Modify: `packages/ui/src/i18n/en.ts`
- Modify: `packages/ui/src/i18n/zh.ts`

**Interfaces:**

- Produces two new `UiI18nKey` values through the English dictionary:
  - `ui.message.tokens`
  - `ui.message.tokensPerSecond`
- The translations accept a `{{count}}` placeholder and are called with already-formatted numbers.

- [ ] **Step 1: Add source English translations**

Add the keys next to the existing `ui.message.duration.*` entries in `packages/ui/src/i18n/en.ts`:

```ts
"ui.message.tokens": "{{count}} tokens",
"ui.message.tokensPerSecond": "{{count}} tokens/s",
```

- [ ] **Step 2: Add Chinese translations**

Add the corresponding keys in `packages/ui/src/i18n/zh.ts`:

```ts
"ui.message.tokens": "{{count}} token",
"ui.message.tokensPerSecond": "{{count}} token/s",
```

Keep `token/s` as the stable technical unit used by the llama.cpp reference UI.

- [ ] **Step 3: Run UI type checking and i18n parity checks**

Run from `packages/ui`:

```bash
bun typecheck
bun test src/context/i18n.test.ts
```

Expected: PASS; the new English keys are available through `UiI18nKey`, and partial locale fallback remains valid.

## Task 4: Render Statistics In The Shared Assistant Metadata

**Files:**

- Modify: `packages/session-ui/src/components/message-part.tsx`
- Modify: `packages/session-ui/src/components/message-part.css` only if verification demonstrates a necessary layout fix.
- Test: `packages/session-ui/src/components/message-part.test.ts` or a focused render test alongside it.

**Interfaces:**

- Consumes `assistantStatistics` from `./message-statistics`.
- Consumes `useI18n()` from the existing UI context.
- Does not add a prop or change the `MessagePart` public API.

- [ ] **Step 1: Add the failing render/format expectation**

Extend the existing message-part test boundary, or add the smallest SolidJS render test supported by the package setup, to assert that a completed assistant text part with:

```ts
tokens: { input: 1200, output: 800, reasoning: 0, cache: { read: 0, write: 0 } }
time: { created: 1_000, completed: 3_000 }
```

can produce the metadata values `800 tokens` and `400.00 tokens/s`, while an incomplete assistant message does not produce a final tokens-per-second value. If the existing component test harness cannot render this component without broad setup, keep the pure helper tests as the authoritative behavior test and verify this boundary manually through the existing story/app test path rather than introducing a new test harness.

- [ ] **Step 2: Calculate statistics in `PART_MAPPING["text"]`**

In the existing `TextPartDisplay` implementation, after narrowing `props.message` to `AssistantMessage`, derive:

```ts
const statistics = createMemo(() => {
  if (props.message.role !== "assistant") return
  const message = props.message as AssistantMessage
  return assistantStatistics({
    output: message.tokens?.output,
    created: message.time?.created,
    completed: message.time?.completed,
  })
})
```

Use the existing `isLastTextPart`/`showCopy` boundary so the values appear only beside the final copyable text part. Do not show the new values when `showCopy()` is false or when the helper returns `undefined`.

- [ ] **Step 3: Format and append localized metadata**

Create a locale-aware number formatter beside the existing `numfmt` memo, and append localized values to the existing `meta` items:

```ts
const statistics = createMemo(() => {
  if (props.message.role !== "assistant") return
  const message = props.message as AssistantMessage
  return assistantStatistics({
    output: message.tokens?.output,
    created: message.time?.created,
    completed: message.time?.completed,
  })
})

const statsMeta = createMemo(() => {
  const value = statistics()
  if (!value) return []
  return [
    i18n.t("ui.message.tokens", { count: numfmt().format(value.output) }),
    i18n.t("ui.message.tokensPerSecond", { count: value.tokensPerSecond.toFixed(2) }),
  ]
})
```

Append `...statsMeta()` to the existing assistant `meta` item list. Preserve the existing agent/model/duration/interrupted ordering and delimiter behavior. Use the existing `numfmt` for token counts and two fractional digits for speed as specified.

- [ ] **Step 4: Keep the existing style unless a focused adjustment is necessary**

First run the existing session UI story/test path. The current metadata row is a flex row with a 10px gap and an existing 12px text style, so no CSS change is expected. If narrow width causes overflow, make only a targeted adjustment under `[data-slot="text-part-meta"]` or the metadata wrapper, preserving hover/focus behavior and existing tokens.

- [ ] **Step 5: Run focused tests and type checking**

Run from `packages/session-ui`:

```bash
bun test src/components/message-statistics.test.ts src/components/message-part.test.ts
bun typecheck
```

Expected: PASS, with no regressions to existing message-part behavior.

## Task 5: Verify Both Session Paths And Performance

**Files:**

- Modify: no source files unless verification finds a concrete regression.
- Test/benchmark: existing `packages/app` and `packages/session-ui` test suites and performance commands.

**Interfaces:**

- Verifies that the shared `MessagePart` path covers both `message-timeline.tsx` and `SessionTurn` without duplicate implementation.

- [ ] **Step 1: Run the shared session UI tests**

Run from `packages/session-ui`:

```bash
bun test src
```

Expected: PASS.

- [ ] **Step 2: Run app timeline unit tests**

Run from `packages/app`:

```bash
bun test --conditions=solid --preload ./happydom.ts ./src/pages/session/timeline
```

Expected: PASS; no projection, row, or timeline behavior changes.

- [ ] **Step 3: Run package type checking**

Run from `packages/app`:

```bash
bun typecheck
```

Expected: PASS with no new diagnostics.

- [ ] **Step 4: Run the post-change stability benchmark**

Run from `packages/app`:

```bash
bun run test:bench
```

Compare first render, metadata rendering, timeline scroll stability, and virtualization measurements against the baseline from Task 1. If the full benchmark is unavailable, run:

```bash
bun run test:stability
```

The change is acceptable only if the new metadata does not introduce a measurable regression in timeline stability or virtualization behavior.

- [ ] **Step 5: Inspect the final diff**

Run from the repository root:

```bash
git diff --check
git status --short
git diff -- packages/session-ui packages/ui docs/superpowers/plans/2026-08-28-session-token-speed.md
```

Confirm that only the intended source, translation, test, and plan files changed, and that no generated files or unrelated user changes were modified.

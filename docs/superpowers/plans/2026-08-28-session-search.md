# Current Session Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-session `Cmd/Ctrl+F` search that searches the complete current conversation, navigates between matches, and works with both session layouts without scanning rendered DOM content.

**Architecture:** Keep extraction and matching in a pure `packages/app` search module. Keep query, scope, history hydration, and result navigation in the session page, reusing `sync().session.history.loadMore` and the existing `revealMessage` callback. Render a compact search bar from the session page and expose the active message ID to existing timeline message containers for temporary emphasis.

**Tech Stack:** SolidJS, Solid Store, Bun tests, existing app command registration, app i18n dictionaries, `@openctrlc/sdk/v2` message/part types, virtualized timeline and session history model.

## Global Constraints

- Prioritise, in this order: stability, simplicity, performance.
- Search must support both the legacy session layout and the virtualized timeline layout.
- The default scope is user and assistant text; the search bar must provide an all-conversation-content scope.
- Matching is case-insensitive substring matching; regular expressions are out of scope.
- Search must load all older current-session history through the existing pagination API before reporting a complete result set.
- Search code must not scan rendered DOM content and must preserve timeline virtualization.
- Search state is ephemeral and must not be written to the URL, database, or session transcript.
- Do not add server or Protocol APIs.
- Do not hardcode user-visible strings; add and use app i18n keys in every locale required by the parity test.
- Before changing session or timeline code, record the production benchmark baseline required by `packages/app/AGENTS.md` and compare it after the change.
- Run tests from `packages/app`, never from the repository root.

---

## File Map

- Create `packages/app/src/pages/session/session-search.ts`: pure scope-aware text extraction, bounded indexing, matching, navigation, and history hydration helper.
- Create `packages/app/src/pages/session/session-search.test.ts`: unit tests for extraction, matching, navigation, and hydration.
- Create `packages/app/src/pages/session/session-search-bar.tsx`: localized SolidJS search bar UI and keyboard behavior.
- Create `packages/app/src/pages/session/session-search-bar.css`: search bar and active-message styling using existing tokens.
- Modify `packages/app/src/pages/session.tsx`: own search state, hydrate complete history, render the bar, pass active message ID, and connect reveal behavior.
- Modify `packages/app/src/pages/session/use-session-commands.tsx`: register page-local `session.search` with `mod+f`.
- Modify `packages/app/src/pages/session/timeline/message-timeline.tsx`: accept active search ID and mark the matching stable message frame.
- Modify all app locale dictionaries under `packages/app/src/i18n/*.ts` required by `parity.test.ts`.
- Create `packages/app/test-browser/session-search.test.ts`: browser-level search/reveal regression coverage.

### Task 1: Record the Session Performance Baseline

Read `packages/app/AGENTS.md`, `packages/app/e2e/performance/README.md`, and the existing timeline benchmark files. From `packages/app`, run:

```bash
bun test ./e2e/performance/unit
bunx playwright test --config e2e/performance/playwright.config.ts e2e/performance/timeline/session-timeline-benchmark.spec.ts
```

Save output outside the repository, record commands and pre-existing failures, and do not change product code. Re-run the exact benchmark after implementation and compare first render, timeline stability, long-task/RAF-gap metrics, and search activation cost.

### Task 2: Implement and Test the Pure Search Engine

**Files:** Create `packages/app/src/pages/session/session-search.ts` and `packages/app/src/pages/session/session-search.test.ts`.

Export:

```ts
export type SessionSearchScope = "conversation" | "all"
export type SessionSearchDocument = { messageID: string; text: string }
export type SessionSearchMatch = { messageID: string; start: number; end: number }
export function searchableText(input: { message: Message; parts: Part[]; scope: SessionSearchScope }): string
export function createSessionSearchDocuments(input: { messages: Message[]; parts: (messageID: string) => Part[]; scope: SessionSearchScope }): SessionSearchDocument[]
export function findSessionSearchMatches(documents: SessionSearchDocument[], query: string): SessionSearchMatch[]
export function nextSessionSearchMatchIndex(current: number, count: number, direction: -1 | 1): number
export function hydrateSessionSearchHistory(input: { sessionID: () => string | undefined; more: () => boolean; loading: () => boolean; loadMore: (sessionID: string) => Promise<void> }): Promise<void>
```

Write failing tests first. The default scope includes user text and assistant text parts; all scope additionally includes readable reasoning, tool input/output, and error strings. Skip binaries and unsupported values, never blindly stringify objects, preserve message order, bound each document with a named maximum, use case-insensitive substring matching, return all non-overlapping matches, handle empty queries, and wrap navigation in both directions. Hydration loops until `more()` is false, prevents duplicate concurrent calls, and propagates failures for the caller to expose as partial history.

Run:

```bash
bun test --conditions=solid --preload ./happydom.ts ./src/pages/session/session-search.test.ts
bun typecheck
```

Commit: `feat(app): add session search matching`.

### Task 3: Add Search Bar and Localization

**Files:** Create `packages/app/src/pages/session/session-search-bar.tsx` and `.css`; modify `packages/app/src/i18n/en.ts` and every locale required by `packages/app/src/i18n/parity.test.ts`.

The component consumes `open`, `query`, `scope`, `matches`, `activeMatch`, `loading`, `partial`, `error`, `onQueryChange`, `onScopeChange`, `onNavigate`, `onRetry`, and `onClose`. It renders an auto-focused accessible input, scope switch, result state, previous/next controls, retry, and close. Use existing `Icon`, `IconButton`, `TextField`, and select primitives after inspecting their APIs. Use no hardcoded visible copy and no emoji icons. Use existing surface, border, typography, radius, and spacing tokens; the overlay must not cover the composer on narrow screens and active-message emphasis must not change layout dimensions.

Add localized keys for placeholder, both scopes, result counter with `{{current}}`/`{{total}}`, no results, loading, partial history, retry, previous, next, and close. Preserve placeholders exactly. Run the parity test and `bun typecheck`. Commit: `feat(app): add session search bar`.

### Task 4: Integrate State, Full History Hydration, and Command Handling

**Files:** Modify `packages/app/src/pages/session.tsx`, `packages/app/src/pages/session/use-session-commands.tsx`, and the Task 2 tests as needed.

Extend `SessionCommandContext` with `openSearch: () => void`; register `session.search` with localized title/description and `keybind: "mod+f"`, disabled without a session. The page owns one Solid store containing `open`, `query`, `scope`, `activeIndex`, `hydrating`, `partial`, and `error`. Derive documents/matches from current `sync().data.message[params.id]` and parts. On opening, call the Task 2 hydration helper through the existing history API until exhausted, guarded against normal scroll loading and stale session updates. Preserve partial matches and expose retry on failure. Lightly debounce query updates, recompute immediately for scope/data changes, preserve nearest valid active result, and call `revealMessage(match.messageID)` only for real matches. `Enter`/down advances; `Shift+Enter`/up reverses. Reset all ephemeral state on session change and return prompt focus on close. Render the bar outside measured timeline rows and pass active ID to `MessageTimeline`.

Run focused search tests and `bun typecheck`. Commit: `feat(app): integrate current session search`.

### Task 5: Add Active Marker and Layout Regression Coverage

**Files:** Modify `packages/app/src/pages/session/timeline/message-timeline.tsx` and `packages/app/src/pages/session.tsx`; create `packages/app/test-browser/session-search.test.ts`; modify focused timeline tests only when needed.

Add `activeSearchMessageID?: string` to `MessageTimeline`. In the stable `TimelineRowFrame`/legacy message container, add `data-search-active` only when the user-message ID matches. Do not add a row, change keys, or alter measured height. Keep virtualized reveal using `scrollToIndex(index, { align: "center" })`; legacy uses existing message anchors. Use a non-layout active style. The browser test must open search, navigate to a known offscreen match, assert the marker, and confirm the timeline remains mounted.

Run the focused browser test and:

```bash
bunx playwright test --config e2e/performance/timeline-stability/playwright.config.ts
```

Commit: `feat(app): highlight session search matches`.

### Task 6: Full Verification

From `packages/app`, run:

```bash
bun test --conditions=solid --preload ./happydom.ts ./src/pages/session/session-search.test.ts ./src/i18n/parity.test.ts
bun typecheck
bun run test:browser
bunx playwright test --config e2e/performance/timeline-stability/playwright.config.ts
```

Re-run the exact Task 1 benchmark, compare results, inspect `git diff --check`, `git status --short`, and `git diff --stat`, and ensure no generated benchmark artifacts or unrelated changes are present. Fix verification failures through a reviewed subagent commit only.

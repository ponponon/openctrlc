# Current Session Search Design

## Goal

Allow users to find text in the currently open session without manually scrolling through a long conversation.

## User Experience

- `Cmd+F` on macOS and `Ctrl+F` elsewhere opens an in-session search bar and prevents the browser's native page search.
- The search bar focuses its input when opened and closes on `Escape`.
- Search is case-insensitive substring matching. Regular expressions are not supported.
- The default scope is **User and assistant text**.
- The search bar provides a scope switch for **All conversation content**.
- The result counter shows the active result and total results, such as `2 / 8`.
- `Enter` and the down arrow move to the next result. `Shift+Enter` and the up arrow move to the previous result.
- The active result scrolls its message into the center of the session viewport and receives temporary visual emphasis.
- Empty queries do not move the viewport. No-result queries show an explicit empty state.
- Search supports both the legacy session layout and the virtualized timeline layout.
- Switching sessions clears the active search state.
- Newly received or newly loaded content causes results to be recomputed without changing the query.

## Search Scope

The default scope indexes readable user message text and assistant text parts, including Markdown content displayed as conversation text.

The all-content scope additionally indexes readable reasoning, tool inputs and outputs, error text, and other textual part fields. Binary attachments and non-readable objects are excluded. Search extraction must avoid blindly stringifying large or binary values.

## Architecture

### Search index

Add a pure search module under `packages/app` that:

- extracts searchable text from messages and parts for the selected scope;
- performs case-insensitive substring matching;
- returns matches associated with message IDs and match positions;
- can recompute an individual message when its parts change;
- bounds per-item indexed text to avoid blocking the render thread on pathological payloads.

The module has no DOM, router, synchronization, or layout dependencies and is covered by unit tests.

### Session controller

The session page owns search state and registers the `Cmd/Ctrl+F` command through the existing command system. Opening search triggers the existing session history pagination loop so all older pages are loaded before the final result count is shown. The query remains active while history is loading.

The controller calls the existing `sync().session.history.loadMore(sessionID)` until no more history is available. It shows a loading state while this happens. If loading fails, already loaded matches remain usable and the UI reports that the result set may be incomplete with a retry action.

History already loaded for the session is not fetched again. Search state is ephemeral and is not written to the URL, database, or session transcript.

### Timeline navigation

The search controller uses a layout-independent “reveal message ID” callback.

- The virtualized timeline resolves the user-message row index and calls its existing virtualizer scroll-to-index behavior, centered in the viewport.
- The legacy layout uses its existing message anchor/reveal scrolling behavior.
- Search code only handles message IDs and does not inspect or scan rendered DOM nodes.

The active match receives a temporary search-active marker at the message container. The marker is styling-only and does not alter message content or virtualization measurements.

### Search bar

The search UI is a compact floating bar positioned at the top of the session content area. It reuses existing icon buttons, text fields, typography, surfaces, borders, and spacing tokens. It contains:

- an auto-focused text input;
- the scope switch;
- result count or loading/empty/partial-history status;
- previous and next controls;
- a close control.

The bar must remain usable on narrow screens without covering the composer. Visible copy, placeholders, labels, tooltips, and status text use the app i18n system.

## Data Flow

1. The user presses `Cmd/Ctrl+F`.
2. The session page opens the search bar and focuses its input.
3. The controller starts or resumes loading older session history through the existing pagination API.
4. Loaded messages and parts are extracted into the selected scope's search index.
5. Query changes are debounced lightly, matches are recomputed, and the active result is initialized to the first match.
6. Navigation changes the active match and invokes the layout-specific reveal callback.
7. Incoming message/part updates or additional history pages invalidate affected index entries and recompute matches.
8. Closing the bar clears its ephemeral state and does not alter the session viewport beyond the last intentional result jump.

## Error Handling and Edge Cases

- A history request failure preserves matches from already loaded content and marks the result set as partial. Retry resumes the pagination loop.
- Content generated while the assistant is working is searchable immediately once present and is included in later recomputations.
- Switching sessions clears the query, scope, matches, active result, and loading/error state.
- An empty query has zero active results and does not move the viewport.
- A query with no matches displays `0` and leaves the viewport unchanged.
- Missing parts, empty text, binary files, and unsupported values are skipped safely.
- A very long single field is truncated for indexing so search cannot monopolize the main thread.
- If the current result disappears after data changes, the active result falls back to the nearest valid result.

## Testing

### Search module

- default scope matches user and assistant text only;
- all-content scope matches reasoning, tool content, and error text;
- matching is case-insensitive substring matching;
- multiple matches, repeated matches, no matches, empty text, and missing parts;
- bounded handling of large fields and unsupported values;
- recomputation after message or part updates.

### History loading

- search starts the existing `loadMore` loop;
- loading stops when history is exhausted;
- already-complete history is not loaded repeatedly;
- failures preserve partial results and expose retry behavior.

### Session interaction

- `Cmd/Ctrl+F` opens search and prevents native browser search;
- input focus, `Escape`, scope changes, result counter, Enter/arrow navigation;
- session changes reset search state;
- incoming content recomputes results;
- both legacy and virtualized layouts reveal the matching message;
- virtualized measurement and normal scrolling remain stable after a search jump.

## Performance Baseline

Before changing session or timeline code, record the existing production benchmark required by `packages/app/AGENTS.md`. After implementation, compare first render, search indexing time, history loading behavior, and scroll stability. The feature must preserve timeline virtualization and must not scan rendered DOM content.

## Out Of Scope

- server-side full-text search or new Protocol/Server APIs;
- persistent search history;
- URL or database persistence of search state;
- regular-expression search;
- searching other sessions from the current-session search bar.

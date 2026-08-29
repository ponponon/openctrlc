# Session Token Speed Design

## Goal

Show output token count, assistant turn duration, and average output token speed for each assistant response in the OpenCtrlC session UI.

The display is inspired by llama.cpp's web UI, but uses OpenCtrlC's existing assistant message fields and does not add a provider-specific timing contract.

## User Experience

- Each completed assistant response can show its output token count and average speed in the existing assistant metadata row.
- The metadata remains next to the existing copy action and uses the current hover/focus reveal behavior.
- The display is shown only beside the last copyable text part for an assistant response, so multiple text parts do not repeat the same statistics.
- The visible format is equivalent to `800 tokens · 650.00 tokens/s`, alongside the existing agent, model, and duration metadata.
- Streaming responses do not show a final speed until the assistant response has a completed timestamp and a positive output token count.
- The legacy `SessionTurn` component and the current virtualized session timeline use the same rendering path and show the same metadata.

## Data Contract

No Schema, Protocol, Server, Core, database, or SDK changes are required.

Use the existing assistant message fields:

- `message.tokens.output` is the output token count.
- `message.time.created` and `message.time.completed` define the assistant message duration.
- `tokensPerSecond = output / ((completed - created) / 1000)`.

The value is valid only when `output > 0`, both timestamps are finite numbers, and `completed > created`. Missing or invalid values produce no speed display. This intentionally measures the full assistant message interval, including prompt processing, first-token latency, tool orchestration, and other turn overhead. It is not equivalent to provider-native decode-only timing.

## Architecture

### Shared assistant metadata

Keep the calculation and display in `packages/session-ui/src/components/message-part.tsx`, alongside the existing assistant text metadata. The shared `MessagePart` path is already used by both:

- `packages/app/src/pages/session/timeline/message-timeline.tsx` for the current virtualized timeline;
- `packages/session-ui/src/components/session-turn.tsx` for the shared/legacy turn component.

The app timeline does not need a second implementation or a new prop. Its existing `turnDurationMs` continues to provide the user-turn duration where applicable, while the assistant message itself provides the token-speed inputs.

### Calculation boundary

Add a small pure calculation boundary close to the display code, or keep the calculation inline if it remains readable. The calculation must not depend on the DOM, timers, provider implementations, or global state. A focused unit test can exercise the boundary without rendering SolidJS components.

### Formatting and localization

Use the existing `useI18n` context and `Intl.NumberFormat` for token counts and speed values. Add shared UI translation keys for the token count and token speed labels. English and Chinese translations are required; other locales use the established shared UI fallback behavior rather than requiring a bulk translation change.

Do not hardcode user-visible copy in the component. Keep the `tokens/s` unit stable because it is a standard performance unit and matches the llama.cpp reference UI.

## Data Flow

1. The session sync layer provides an assistant message with its existing `tokens` and `time` fields.
2. `MessagePart` renders the assistant's text parts.
3. The last copyable text part calculates the valid output count, duration, and average speed from the assistant message.
4. If the values are valid, the text metadata row renders the localized token count and token speed next to the existing duration.
5. If the assistant is still streaming or the fields are incomplete, the existing metadata remains available and the new statistics are omitted.

## Edge Cases

- Missing `tokens` or missing `tokens.output`: omit token statistics.
- Zero output tokens: omit speed to avoid displaying a meaningless zero rate.
- Missing `completed`: omit speed while the assistant is streaming.
- `completed <= created`, non-finite timestamps, or non-finite output: omit speed.
- Multiple assistant messages for one user message: calculate and display each assistant message independently.
- Multiple text parts in one assistant message: display statistics only on the last copyable text part.
- Tool-only or reasoning-only assistant messages: do not create a new statistics row; the existing text metadata path remains unchanged.
- Very short turns: use the exact available millisecond interval and format the resulting rate with two fractional digits.
- Existing historical messages without token data remain visually unchanged.

## Testing

### Calculation

- Calculates tokens per second from positive output and duration.
- Rejects zero output, missing timestamps, non-finite values, and non-positive duration.
- Preserves fractional rates and uses the expected two-decimal display format.

### Rendering

- Shows token count and speed for a completed assistant message.
- Does not show final speed for a streaming assistant message.
- Renders metadata only on the last copyable text part.
- Keeps existing agent, model, duration, copy, and interruption metadata intact.
- Covers both the shared `SessionTurn` path and the current timeline path through their existing shared component boundary where practical.

### Verification

Before changing session/timeline code, record the production benchmark required by `packages/app/AGENTS.md`. After implementation, compare first render, assistant metadata rendering, and timeline scroll/virtualization stability. Run focused package tests and type checking from the affected package directories.

## Out Of Scope

- Provider-native decode-only timing such as llama.cpp's `predicted_ms`.
- New persistent timing fields or migrations.
- New Schema, Protocol, Server, Core, or SDK APIs.
- Session-level aggregate speed statistics.
- Prompt processing speed, cache speed, or input token speed.
- A permanently visible statistics panel or a new assistant message header.

# Prompt Permission Toggle Design

## Goal

Expose the existing directory-scoped automatic permission acceptance control directly in the session prompt input. This prevents users from opening Settings for every new session while preserving the current permission protocol and persistence model.

## Confirmed Behavior

- The prompt input shows a compact automatic permission acceptance control in both the legacy and V2 prompt inputs.
- The control operates on the active `sdk().directory` only. It does not create or modify a session-specific override.
- Enabling the control persists the existing directory-level auto-accept key, so future sessions in the directory inherit it.
- Disabling the control only disables the directory default. It does not remove session-level overrides or saved `always` permission rules.
- The Settings control remains available and reads and writes the same persisted state.
- The feature remains a binary toggle. It does not add Codex-style `request approval`, `help me approve`, or `full access` modes.
- The existing permission event handling continues to answer pending and future requests using the current directory-level state.
- Shell mode follows the existing prompt control visibility behavior so the additional control does not create a second Shell-specific layout.

## Architecture

### Permission Context

The permission context remains the owner of directory-level auto-accept state. It exposes explicit directory operations for the prompt control:

- `isAutoAcceptingDirectory(directory)`
- `enableAutoAcceptDirectory(directory)`
- `disableAutoAcceptDirectory(directory)`
- `toggleAutoAcceptDirectory(directory)`

These operations use the existing `directoryAcceptKey(directory)` representation and persisted `autoAccept` store. No persistence migration or server API change is needed.

### Shared Prompt Control

Add a shared `PromptPermissionControl` application component. It receives the active directory, reads the permission context, and renders the current state with the existing shield icon, menu, tooltip, and button primitives.

The control presents a binary menu:

- Enable automatic permission acceptance
- Stop automatic permission acceptance

The enabled state is visually distinct and the accessible label is localized. The menu action delegates to the permission context rather than duplicating persistence or pending-request handling.

### Prompt Integration

Render the shared control in the existing bottom control row of both prompt implementations:

- `packages/app/src/components/prompt-input.tsx`
- `packages/app/src/components/prompt-input-v2.tsx`

The V2 shared prompt package does not own application permission state, so the control is composed by the application wrapper around the shared V2 prompt component. The legacy input renders it beside the existing agent and model controls.

The control uses the active SDK directory, not the session directory. This matches the confirmed directory-scoped behavior and ensures a newly created session receives the same default.

### Settings Compatibility

The existing Settings switch remains unchanged in user-visible behavior. Both Settings and the prompt control use the same permission context state and directory key, so changing either entry point updates the other through SolidJS reactivity.

## Error Handling

- The control is unavailable when there is no active directory.
- Permission context methods remain no-ops after disposal, matching existing behavior.
- Existing asynchronous listing and response error handling is unchanged; failed permission replies continue to remove the response de-duplication marker.
- No new server or network request is introduced by toggling the persisted directory preference.

## Testing

- Extend permission auto-response tests for explicit directory enable/disable behavior and preservation of session-level overrides.
- Add focused component coverage for the control's enabled state and menu actions where the existing application test setup supports it.
- Verify both legacy and V2 prompt composition includes the control.
- Run `bun typecheck` from `packages/app`.
- Run the focused permission tests from `packages/app` before broader application checks.

## Non-Goals

- No new three-level permission policy.
- No changes to Core permission evaluation, server permission endpoints, SDK generation, or persisted schema version.
- No removal of the Settings entry point.
- No automatic deletion of existing session-level or saved permission grants.

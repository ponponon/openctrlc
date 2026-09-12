# Prompt Permission Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the existing directory-scoped automatic permission acceptance toggle directly in both prompt input implementations so new sessions can inherit it without opening Settings.

**Architecture:** Keep permission persistence and response behavior in `usePermission()`. Add a small application-owned prompt control that reads the active SDK directory and delegates to directory-level permission methods. Compose it into the legacy input and the V2 application wrapper without changing Core, Protocol, Server, SDK, or persisted data formats.

**Tech Stack:** SolidJS, Solid Store, existing `usePermission` context, existing `MenuV2`, `Icon`/`IconV2`, application i18n, Bun tests, TypeScript native typechecking.

## Global Constraints

- Only implement a binary automatic-accept toggle; do not add Codex-style three-level policy.
- Persist the setting per active directory using the existing `directoryAcceptKey(directory)` representation.
- Disabling the directory default must not delete session-level overrides or saved `always` permission rules.
- The control must appear in both legacy and V2 prompt inputs.
- Never hardcode user-visible production copy; add English and Simplified Chinese i18n keys.
- Do not change Core permission evaluation, server endpoints, SDK generation, or persistence schema versions.
- Run typechecking from `packages/app`, never from the repository root.

---

### Task 1: Normalize Directory Permission Operations

**Files:**

- Modify: `packages/app/src/context/permission.tsx:151-183,425-471`
- Test: `packages/app/src/context/permission-auto-respond.test.ts`

**Interfaces:**

- Consumes: existing `createServerPermissionState` directory methods and `usePermission` selected-server API.
- Produces: explicit `enableAutoAcceptDirectory`, `disableAutoAcceptDirectory`, and `toggleAutoAcceptDirectory` methods on `usePermission()`.

- [ ] **Step 1: Add pure behavior tests for explicit directory operations where the existing helper boundary allows it**

  Extend `permission-auto-respond.test.ts` to cover that a directory key with `true` is recognized, `false` is not recognized, and session-specific keys remain independently detectable. Keep these tests focused on `autoRespondsPermission` and `isDirectoryAutoAccepting`; do not duplicate Solid context internals in a unit test.

- [ ] **Step 2: Run the focused permission helper test before implementation**

  Run from `packages/app`:

  ```bash
  bun test --conditions=solid --preload ./happydom.ts ./src/context/permission-auto-respond.test.ts
  ```

  Expected: PASS for the existing baseline tests.

- [ ] **Step 3: Add explicit directory methods to the server permission state API**

  Expose the already-existing internal `enableDirectory` and `disableDirectory` functions through the returned `api` object:

  ```ts
  enableAutoAcceptDirectory(directory: string) {
    if (meta.disposed) return
    enableDirectory(directory)
  }
  disableAutoAcceptDirectory(directory: string) {
    if (meta.disposed) return
    disableDirectory(directory)
  }
  toggleAutoAcceptDirectory(directory: string) {
    if (meta.disposed) return
    if (isAutoAcceptingDirectory(directory)) {
      disableDirectory(directory)
      return
    }
    enableDirectory(directory)
  }
  ```

  Add the same delegating methods to the outer context return object beside the existing `toggleAutoAcceptDirectory`, keeping existing callers compatible.

- [ ] **Step 4: Verify the permission helper tests still pass**

  Run:

  ```bash
  bun test --conditions=solid --preload ./happydom.ts ./src/context/permission-auto-respond.test.ts
  ```

  Expected: PASS.

- [ ] **Step 5: Commit the isolated permission API change**

  ```bash
  git add packages/app/src/context/permission.tsx packages/app/src/context/permission-auto-respond.test.ts
  git commit -m "feat(app): expose directory permission toggle"
  ```

### Task 2: Add Localized Prompt Permission Control

**Files:**

- Create: `packages/app/src/components/prompt-permission-control.tsx`
- Modify: `packages/app/src/i18n/en.ts:82-84,550-553`
- Modify: `packages/app/src/i18n/zh.ts:202-204,645-648`

**Interfaces:**

- Consumes: `usePermission()`, `useLanguage()`, `MenuV2`, `IconV2`, and the active directory string.
- Produces: `PromptPermissionControl(props: { directory: string; visible?: boolean })`.

- [ ] **Step 1: Add English and Simplified Chinese strings**

  Add keys with these exact English source values:

  ```ts
  "prompt.permissions.autoaccept": "Auto-accept permissions"
  "prompt.permissions.autoaccept.enabled": "Auto-accepting permissions"
  "prompt.permissions.autoaccept.enable": "Enable auto-accept permissions"
  "prompt.permissions.autoaccept.disable": "Stop auto-accepting permissions"
  ```

  Add the corresponding Simplified Chinese values:

  ```ts
  "prompt.permissions.autoaccept": "自动接受权限"
  "prompt.permissions.autoaccept.enabled": "正在自动接受权限"
  "prompt.permissions.autoaccept.enable": "开启自动接受权限"
  "prompt.permissions.autoaccept.disable": "停止自动接受权限"
  ```

- [ ] **Step 2: Create the control using existing V2 primitives**

  Implement a compact trigger using `MenuV2`, `ButtonV2`, `IconV2`, and `TooltipV2`. Use `shield` only if it exists in the V2 icon registry; otherwise use the existing V2 `settings-gear` or another verified icon. The trigger must show the enabled state, expose a localized `aria-label`, and render one action at a time:

  ```tsx
  <MenuV2 placement="top-start" gutter={6} modal={false}>
    <MenuV2.Trigger as={ButtonV2} ...>
      ...
    </MenuV2.Trigger>
    <MenuV2.Portal>
      <MenuV2.Content>
        <MenuV2.Item onSelect={() => ...}>{...}</MenuV2.Item>
      </MenuV2.Content>
    </MenuV2.Portal>
  </MenuV2>
  ```

  The component must delegate to `enableAutoAcceptDirectory` or `disableAutoAcceptDirectory`; it must not call persistence utilities directly. Return no control when `directory` is empty.

- [ ] **Step 3: Run app typecheck to catch i18n and primitive API errors**

  Run from `packages/app`:

  ```bash
  bun typecheck
  ```

  Expected: PASS or only pre-existing unrelated diagnostics. Fix all diagnostics caused by this task.

- [ ] **Step 4: Commit the control and localization**

  ```bash
  git add packages/app/src/components/prompt-permission-control.tsx packages/app/src/i18n/en.ts packages/app/src/i18n/zh.ts
  git commit -m "feat(app): add prompt permission control"
  ```

### Task 3: Integrate the Control Into Both Prompt Inputs

**Files:**

- Modify: `packages/app/src/components/prompt-input.tsx:117-130,1624-1789`
- Modify: `packages/app/src/components/prompt-input-v2.tsx:1-80`
- Test: `packages/app/src/components/prompt-input.test.tsx` if an existing component test harness exists; otherwise use typecheck and focused source-level behavior tests only.

**Interfaces:**

- Consumes: `PromptPermissionControl`, `useSDK()`, and the existing prompt control rows.
- Produces: visible directory permission control in legacy and V2 prompt compositions.

- [ ] **Step 1: Identify the existing prompt component test harness before writing tests**

  From `packages/app`, inspect existing prompt component tests and stories. If no component harness renders these large prompt implementations, add a focused unit test for the pure directory selection/visibility helper only; do not introduce a new browser framework for this control.

- [ ] **Step 2: Add the control to the legacy prompt bottom row**

  Import `PromptPermissionControl` and render it beside the existing Agent/model/variant controls, passing `sdk().directory`. Keep the existing Shell-mode opacity/pointer-event transition so the control is hidden with the other normal-mode controls. Do not pass `props.controls.session.id`, because the confirmed behavior is directory-scoped.

- [ ] **Step 3: Add the control to the V2 application wrapper**

  Extend `PromptInputV2Composer` to render the control in the wrapper around `PromptInputV2`. The wrapper already has access to the application contexts through the controller setup; use `useSDK()` in the wrapper and place the control in the V2 prompt footer without modifying the shared `@openctrlc/session-ui` package unless the current component API makes composition impossible.

  If the shared V2 component has no footer slot, add the smallest application-level wrapper composition that preserves the existing layout and places the control alongside the model control. Do not move permission state into `session-ui`.

- [ ] **Step 4: Run focused tests and typecheck**

  Run from `packages/app`:

  ```bash
  bun test --conditions=solid --preload ./happydom.ts ./src/context/permission-auto-respond.test.ts
  bun typecheck
  ```

  Expected: PASS with no new type errors.

- [ ] **Step 5: Commit prompt integration**

  ```bash
  git add packages/app/src/components/prompt-input.tsx packages/app/src/components/prompt-input-v2.tsx
  git commit -m "feat(app): expose permissions in prompt input"
  ```

### Task 4: Final Verification and Review

**Files:**

- Modify: none unless verification finds a defect.
- Test: `packages/app/src/context/permission-auto-respond.test.ts`, relevant prompt tests, application typecheck.

- [ ] **Step 1: Review the complete diff and worktree**

  Run:

  ```bash
  git status --short
  git diff --check HEAD~3..HEAD
  git diff HEAD~3..HEAD -- packages/app/src/context/permission.tsx packages/app/src/components/prompt-permission-control.tsx packages/app/src/components/prompt-input.tsx packages/app/src/components/prompt-input-v2.tsx packages/app/src/i18n/en.ts packages/app/src/i18n/zh.ts
  ```

  Confirm unrelated `README.md` changes remain untouched.

- [ ] **Step 2: Run focused permission tests**

  ```bash
  cd packages/app
  bun test --conditions=solid --preload ./happydom.ts ./src/context/permission-auto-respond.test.ts
  ```

  Expected: PASS.

- [ ] **Step 3: Run application typecheck**

  ```bash
  bun typecheck
  ```

  Expected: PASS.

- [ ] **Step 4: Inspect the final UI paths if local app servers are already available**

  Do not restart any app or server process. If a running local app is available, verify both legacy and V2 prompt rows manually. Otherwise rely on typecheck and existing test harnesses and report that visual verification was not run.

- [ ] **Step 5: Request a code review before claiming completion**

  Review for: directory vs session scope, no deletion of existing grants, i18n completeness, old/V2 parity, Shell-mode layout behavior, and accidental dependency or protocol changes.

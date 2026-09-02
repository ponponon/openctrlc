# Session ID Context Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 desktop 的 Context 详情面板显示当前会话的完整 `sessionID`，并支持一键复制。

**Architecture:** 复用 `SessionContextTab` 已有的 `useSessionLayout().params.id`，不新增后端接口或数据字段。将复制动作封装为一个小型、可测试的纯异步边界函数，组件负责根据当前 ID 渲染统计项、按钮和 toast；ID 文本在窄面板中截断，但复制始终使用完整值。

**Tech Stack:** SolidJS、TypeScript、现有 `@openctrlc/ui` Button/Icon、app i18n、Bun test、app `tsgo` typecheck。

## Global Constraints

- 只修改 app UI、app i18n 和对应测试，不修改 Session schema、Protocol、Server 或数据库。
- 用户可见文字必须通过 app i18n 提供，不能硬编码英文。
- 复制按钮使用现有 Button/Icon 组件和现有 toast 反馈风格。
- 测试真实复制边界函数行为；不复制实现逻辑到测试中，不使用全局 mock，除非 Clipboard API 是唯一可用边界。
- 测试从 `packages/app` 执行，不能从仓库根目录执行。
- 不改变现有 Context 统计项顺序以外的业务行为；没有 session ID 时不渲染 Session ID 项且不触发复制。

---

### Task 1: Add a Testable Clipboard Boundary

**Files:**
- Create: `packages/app/src/components/session/session-id-copy.ts`
- Test: `packages/app/src/components/session/session-id-copy.test.ts`

**Interfaces:**
- Produces `copySessionID(sessionID: string | undefined, clipboard?: Pick<Clipboard, "writeText">): Promise<boolean>`.
- Returns `false` and does not call `writeText` when `sessionID` is absent.
- Returns `true` after the clipboard writes the exact full ID.
- Propagates clipboard rejection so the caller can show the existing request error.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from "bun:test"
import { copySessionID } from "./session-id-copy"

describe("copySessionID", () => {
  test("copies the complete session ID", async () => {
    const copied: string[] = []

    await expect(
      copySessionID("ses_01JSESSIONID", {
        writeText: async (value) => {
          copied.push(value)
        },
      }),
    ).resolves.toBe(true)

    expect(copied).toEqual(["ses_01JSESSIONID"])
  })

  test("does not copy when the session ID is absent", async () => {
    let calls = 0

    await expect(
      copySessionID(undefined, {
        writeText: async () => {
          calls += 1
        },
      }),
    ).resolves.toBe(false)

    expect(calls).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test --conditions=solid --preload ./happydom.ts ./src/components/session/session-id-copy.test.ts`

Expected: FAIL because `./session-id-copy` does not exist yet.

- [ ] **Step 3: Implement the minimal clipboard boundary**

```ts
export function copySessionID(
  sessionID: string | undefined,
  clipboard?: Pick<Clipboard, "writeText">,
) {
  if (!sessionID) return Promise.resolve(false)
  const target = clipboard ?? navigator.clipboard
  return target.writeText(sessionID).then(() => true)
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `bun test --conditions=solid --preload ./happydom.ts ./src/components/session/session-id-copy.test.ts`

Expected: PASS with both tests passing.

- [ ] **Step 5: Review the focused diff**

Run: `git diff -- packages/app/src/components/session/session-id-copy.ts packages/app/src/components/session/session-id-copy.test.ts`

Expected: the boundary only handles the absent-ID guard and the Clipboard API write; no UI or unrelated browser behavior is included.

### Task 2: Add Complete Locale Coverage

**Files:**
- Modify: `packages/app/src/i18n/en.ts:501-516,568-582`
- Modify: `packages/app/src/i18n/zh.ts` at the corresponding context and toast sections
- Modify: every other `packages/app/src/i18n/*.ts` app locale file, adding the same four keys with English fallback values

**Interfaces:**
- Adds the typed keys `context.stats.sessionID`, `context.sessionID.copy`, `context.sessionID.copied`, and `context.sessionID.copyFailed` to every app locale bundle.
- The component uses only these keys plus the existing `common.requestFailed` fallback.

- [ ] **Step 1: Add the i18n entries**

English:

```ts
"context.stats.sessionID": "Session ID",
"context.sessionID.copy": "Copy session ID",
"context.sessionID.copied": "Session ID copied",
"context.sessionID.copyFailed": "Failed to copy session ID",
```

Simplified Chinese:

```ts
"context.stats.sessionID": "会话 ID",
"context.sessionID.copy": "复制会话 ID",
"context.sessionID.copied": "会话 ID 已复制",
"context.sessionID.copyFailed": "复制会话 ID 失败",
```

For every remaining app locale, add the same keys with these exact English fallback values:

```ts
"context.stats.sessionID": "Session ID",
"context.sessionID.copy": "Copy session ID",
"context.sessionID.copied": "Session ID copied",
"context.sessionID.copyFailed": "Failed to copy session ID",
```

Do not modify unrelated locale values. These fallback entries are required because the existing parity test requires every app locale to contain every English key.

- [ ] **Step 2: Run the app typecheck**

Run: `bun typecheck`

Expected: PASS and the new keys are accepted by the typed language API.

- [ ] **Step 3: Run the i18n parity test**

Run: `bun test --conditions=solid --preload ./happydom.ts ./src/i18n/parity.test.ts`

Expected: PASS with no missing app-locale keys.

### Task 3: Render Session ID and Copy Action in Context

**Files:**
- Modify: `packages/app/src/components/session/session-context-tab.tsx:1-225,301-315`

**Interfaces:**
- Consumes `copySessionID` from `./session-id-copy`.
- Uses `params.id` from the existing `useSessionLayout()` result.
- Keeps the existing `Stat` component for the label/value hierarchy and adds a dedicated value renderer only because the copy button is interactive.

- [ ] **Step 1: Add the session ID value renderer and copy handler**

Import `copySessionID` and add a handler near `exportSession`:

```ts
const copySessionIDToClipboard = async () => {
  const sessionID = params.id
  if (!sessionID) return

  try {
    await copySessionID(sessionID)
    showToast({
      variant: "success",
      icon: "circle-check",
      title: language.t("context.sessionID.copied"),
      description: sessionID,
    })
  } catch (err) {
    showToast({
      variant: "error",
      title: language.t("context.sessionID.copyFailed"),
      description: err instanceof Error ? err.message : language.t("common.requestFailed"),
    })
  }
}
```

Render the new row before the regular stats grid so the identity value is easy to find:

```tsx
<Show when={params.id}>
  <div class="flex items-center justify-between gap-3 rounded-md border border-border-weak-base bg-surface-panel px-3 py-2">
    <div class="min-w-0 flex flex-col gap-1">
      <div class="text-12-regular text-text-weak">{language.t("context.stats.sessionID")}</div>
      <div class="truncate text-12-medium text-text-strong" title={params.id}>
        {params.id}
      </div>
    </div>
    <Button
      size="small"
      variant="ghost"
      class="shrink-0 px-2 text-text-weak hover:text-text-base"
      onClick={copySessionIDToClipboard}
      aria-label={language.t("context.sessionID.copy")}
    >
      <Icon name="copy" size="small" />
    </Button>
  </div>
</Show>
```

Use the existing design tokens and icon; do not add a new stylesheet or a new visual component for this single value.

- [ ] **Step 2: Run the focused app tests and typecheck**

Run: `bun test --conditions=solid --preload ./happydom.ts ./src/components/session/session-id-copy.test.ts`

Expected: PASS.

Run: `bun typecheck`

Expected: PASS from `packages/app` with no new diagnostics.

### Task 4: Full Verification and Review

**Files:**
- Verify: `packages/app/src/components/session/session-context-tab.tsx`
- Verify: `packages/app/src/components/session/session-id-copy.ts`
- Verify: `packages/app/src/components/session/session-id-copy.test.ts`
- Verify: `packages/app/src/i18n/en.ts`
- Verify: `packages/app/src/i18n/zh.ts`

- [ ] **Step 1: Run the focused unit test**

Run: `bun test --conditions=solid --preload ./happydom.ts ./src/components/session/session-id-copy.test.ts`

Expected: PASS.

- [ ] **Step 2: Run all app unit tests**

Run: `bun run test:unit`

Expected: PASS. If unrelated pre-existing failures occur, record their exact test names and output; do not change unrelated tests.

- [ ] **Step 3: Run app typecheck**

Run: `bun typecheck`

Expected: PASS.

- [ ] **Step 4: Check the diff and working tree**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only the intended feature files and the approved design/plan documents are changed.

- [ ] **Step 5: Manually verify the desktop Context panel**

Open an existing session in the desktop app, open the Context panel, confirm the full session ID is visible, click the copy icon, and paste into a safe text field to confirm the pasted value exactly matches the route/session ID. Also inspect a narrow panel width to confirm the visible value truncates without changing the copied value.

- [ ] **Step 6: Report verification evidence**

Final response must list the changed files and exact commands run, distinguishing passing checks from any environment or pre-existing failures. Do not claim the feature is complete without successful verification output.

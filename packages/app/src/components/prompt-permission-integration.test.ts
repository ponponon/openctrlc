import { expect, test } from "bun:test"
import { createPromptPermissionController } from "./prompt-permission-controller"

const read = (path: string) => Bun.file(new URL(path, import.meta.url)).text()

test("mounts the permission control from the active SDK directory in both prompt compositions", async () => {
  const [legacy, v2] = await Promise.all([read("./prompt-input.tsx"), read("./prompt-input-v2.tsx")])

  expect(legacy).toContain('import { PromptPermissionControl } from "@/components/prompt-permission-control"')
  expect(legacy).toContain(
    "<PromptPermissionControl directory={sdk().directory} sessionID={props.controls.session.id} />",
  )
  expect(v2).toContain('import { PromptPermissionControl } from "@/components/prompt-permission-control"')
  expect(v2).toContain("<PromptPermissionControl directory={sdk().directory} sessionID={props.sessionID} />")
})

test("keeps the legacy permission control inside the normal-mode prompt control region", async () => {
  const source = await read("./prompt-input.tsx")
  const normalControlRegion = source.indexOf('<Show when={store.mode === "normal" || store.mode === "shell"}>')
  const modelControlRegion = source.indexOf('<Show when={store.mode !== "shell"}>', normalControlRegion)
  const permissionControl = source.indexOf("<PromptPermissionControl", modelControlRegion)

  expect(normalControlRegion).toBeGreaterThanOrEqual(0)
  expect(modelControlRegion).toBeGreaterThan(normalControlRegion)
  expect(permissionControl).toBeGreaterThan(modelControlRegion)
  expect(source.slice(permissionControl)).toMatch(/<PromptPermissionControl[^>]+>\s*<\/Show>\s*<\/Show>/)
})

test("reports the effective state and converges each toggle through setAutoAccept", () => {
  const directory = "/tmp/project"
  let enabled = false
  const actions: string[] = []
  const controller = createPromptPermissionController({
    directory: () => directory,
    sessionID: () => undefined,
    isAutoAccepting: (sessionID) => sessionID === "ses_1" && enabled,
    isAutoAcceptingDirectory: () => enabled,
    setAutoAccept: (sessionID, value, next) => {
      actions.push(`set:${sessionID ?? "none"}:${value}:${next}`)
      enabled = next
    },
  })

  expect(controller.enabled()).toBe(false)
  controller.toggle()
  expect(controller.enabled()).toBe(true)
  expect(actions).toEqual([`set:none:${directory}:true`])

  controller.toggle()
  expect(controller.enabled()).toBe(false)
  expect(actions).toEqual([`set:none:${directory}:true`, `set:none:${directory}:false`])
})

test("prefers the session effective state over the directory state", () => {
  const controller = createPromptPermissionController({
    directory: () => "/tmp/project",
    sessionID: () => "ses_1",
    isAutoAccepting: () => false,
    isAutoAcceptingDirectory: () => true,
    setAutoAccept: () => undefined,
  })

  expect(controller.enabled()).toBe(false)
})

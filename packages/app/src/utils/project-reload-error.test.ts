import { beforeAll, describe, expect, mock, test } from "bun:test"

type ToastInput = { title?: string; description?: string }

const shown: ToastInput[] = []

function translate(key: string, vars?: Record<string, string | number>) {
  if (!vars) return key
  return Object.entries(vars).reduce((text, [name, value]) => text.replace(`{{${name}}}`, String(value)), key)
}

function cancelledError() {
  return new Error("openctrlc server GET /command → 499 request cancelled", {
    cause: {
      kind: "cancelled",
      status: 499,
      body: null,
      request: { method: "GET", url: "http://127.0.0.1:4096/command" },
    },
  })
}

beforeAll(async () => {
  mock.module("./toast", () => ({
    showToast: (options: ToastInput) => shown.push(options),
  }))
  await import("./project-reload-error")
})

describe("showProjectReloadError", () => {
  test("skips cancelled requests instead of toasting a reload failure", async () => {
    const { showProjectReloadError } = await import("./project-reload-error")
    shown.length = 0

    showProjectReloadError({
      project: "crawler_console",
      error: cancelledError(),
      translate,
      platform: {},
    })

    expect(shown).toHaveLength(0)
  })

  test("still toasts genuine reload failures", async () => {
    const { showProjectReloadError } = await import("./project-reload-error")
    shown.length = 0

    showProjectReloadError({
      project: "crawler_console",
      error: new Error("sidecar exited"),
      translate,
      platform: {},
    })

    expect(shown).toHaveLength(1)
    expect(shown[0].title).toBe("toast.project.reloadFailed.title")
    expect(shown[0].description).toBe("sidecar exited")
  })
})

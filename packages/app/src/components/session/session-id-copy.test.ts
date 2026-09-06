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

  test("falls back when the native clipboard bridge is stale", async () => {
    const originalExecCommand = document.execCommand
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: (command: string) => command === "copy" && document.querySelector("textarea")?.value === "ses_01JSESSIONID",
    })

    try {
      await expect(
        copySessionID("ses_01JSESSIONID", {
          writeText: async () => {
            throw new Error("stale preload")
          },
        }),
      ).resolves.toBe(true)
    } finally {
      Object.defineProperty(document, "execCommand", {
        configurable: true,
        value: originalExecCommand,
      })
    }
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

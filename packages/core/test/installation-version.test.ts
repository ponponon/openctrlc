import { afterEach, describe, expect, test } from "bun:test"
import { resolveInstallationChannel } from "../src/installation/version"

const originalChannel = process.env.OPENCTRLC_CHANNEL

afterEach(() => {
  if (originalChannel === undefined) delete process.env.OPENCTRLC_CHANNEL
  else process.env.OPENCTRLC_CHANNEL = originalChannel
})

describe("installation channel", () => {
  test("uses the runtime channel when no build-time channel is available", () => {
    process.env.OPENCTRLC_CHANNEL = "dev"
    expect(resolveInstallationChannel()).toBe("dev")
  })
})

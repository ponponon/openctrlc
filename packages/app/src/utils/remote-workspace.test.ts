import { describe, expect, test } from "bun:test"
import { remoteWorkspaceStorageKey } from "./remote-workspace"

describe("remoteWorkspaceStorageKey", () => {
  test("isolates workspace snapshots for different relay sessions", () => {
    expect(remoteWorkspaceStorageKey("desktop-session-a")).not.toBe(remoteWorkspaceStorageKey("desktop-session-b"))
    expect(remoteWorkspaceStorageKey("desktop-session-a")).toBe("openctrlc.remote-workspace:desktop-session-a")
  })

  test("preserves the unscoped key for non-remote callers", () => {
    expect(remoteWorkspaceStorageKey()).toBe("openctrlc.remote-workspace")
  })
})

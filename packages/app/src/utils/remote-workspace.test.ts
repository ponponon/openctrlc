import { describe, expect, test } from "bun:test"
import { parseRemoteWorkspaceSnapshot, remoteSessionProtocols, remoteWorkspaceStorageKey } from "./remote-workspace"

describe("remoteWorkspaceStorageKey", () => {
  test("isolates workspace snapshots for different relay sessions", () => {
    expect(remoteWorkspaceStorageKey("desktop-session-a")).not.toBe(remoteWorkspaceStorageKey("desktop-session-b"))
    expect(remoteWorkspaceStorageKey("desktop-session-a")).toBe("openctrlc.remote-workspace:desktop-session-a")
  })

  test("preserves the unscoped key for non-remote callers", () => {
    expect(remoteWorkspaceStorageKey()).toBe("openctrlc.remote-workspace")
  })
})

describe("remote workspace session protocol hints", () => {
  test("keeps validated protocol hints while allowing title-less session metadata", () => {
    const snapshot = parseRemoteWorkspaceSnapshot({
      projects: [],
      sessionIDs: ["legacy-session", "current-session"],
      sessionInfo: [
        { sessionID: "legacy-session", protocol: "v1" },
        { sessionID: "current-session", title: "Current", protocol: "v2" },
      ],
    })

    expect(snapshot?.sessionInfo).toEqual([
      { sessionID: "legacy-session", protocol: "v1" },
      { sessionID: "current-session", title: "Current", protocol: "v2" },
    ])
    expect(remoteSessionProtocols(snapshot)).toEqual(
      new Map([
        ["legacy-session", "v1"],
        ["current-session", "v2"],
      ]),
    )
  })

  test("rejects unknown protocols rather than seeding an unsafe route", () => {
    expect(
      parseRemoteWorkspaceSnapshot({
        projects: [],
        sessionIDs: ["session"],
        sessionInfo: [{ sessionID: "session", protocol: "v3" }],
      }),
    ).toBeUndefined()
  })
})

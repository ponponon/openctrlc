import { describe, expect, test } from "bun:test"
import type { PermissionRequest, Session } from "@openctrlc/sdk/v2/client"
import { base64Encode } from "@openctrlc/core/util/encode"
import {
  autoAcceptDirectories,
  autoRespondsPermission,
  convergeAutoAccept,
  isDirectoryAutoAccepting,
  sessionAutoAccept,
} from "./permission-auto-respond"

const session = (input: { id: string; parentID?: string }) =>
  ({
    id: input.id,
    parentID: input.parentID,
  }) as Session

const permission = (sessionID: string) =>
  ({
    sessionID,
  }) as Pick<PermissionRequest, "sessionID">

describe("autoRespondsPermission", () => {
  test("uses a parent session's directory-scoped auto-accept", () => {
    const directory = "/tmp/project"
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" })]
    const autoAccept = {
      [`${base64Encode(directory)}/root`]: true,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("child"), directory)).toBe(true)
  })

  test("uses a parent session's legacy auto-accept key", () => {
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" })]

    expect(autoRespondsPermission({ root: true }, sessions, permission("child"), "/tmp/project")).toBe(true)
  })

  test("uses the default directory auto-accept when no lineage override exists", () => {
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" }), session({ id: "other" })]
    const autoAccept = {
      other: true,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("child"), "/tmp/project")).toBe(true)
  })

  test("inherits a parent session's false override", () => {
    const directory = "/tmp/project"
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" })]
    const autoAccept = {
      [`${base64Encode(directory)}/root`]: false,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("child"), directory)).toBe(false)
  })

  test("prefers a child override over parent override", () => {
    const directory = "/tmp/project"
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" })]
    const autoAccept = {
      [`${base64Encode(directory)}/root`]: false,
      [`${base64Encode(directory)}/child`]: true,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("child"), directory)).toBe(true)
  })

  test("falls back to directory-level auto-accept", () => {
    const directory = "/tmp/project"
    const sessions = [session({ id: "root" })]
    const autoAccept = {
      [`${base64Encode(directory)}/*`]: true,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("root"), directory)).toBe(true)
    expect(sessionAutoAccept(autoAccept, sessions, permission("root"), directory)).toBeUndefined()
  })

  test("session-level override takes precedence over directory-level", () => {
    const directory = "/tmp/project"
    const sessions = [session({ id: "root" })]
    const autoAccept = {
      [`${base64Encode(directory)}/*`]: true,
      [`${base64Encode(directory)}/root`]: false,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("root"), directory)).toBe(false)
  })

  test("parent false override takes precedence over directory-level auto-accept", () => {
    const directory = "/tmp/project"
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" })]
    const autoAccept = {
      [`${base64Encode(directory)}/*`]: true,
      [`${base64Encode(directory)}/root`]: false,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("child"), directory)).toBe(false)
  })

  test("parent true override takes precedence over disabled directory fallback", () => {
    const directory = "/tmp/project"
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" })]
    const autoAccept = {
      [`${base64Encode(directory)}/*`]: false,
      [`${base64Encode(directory)}/root`]: true,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("child"), directory)).toBe(true)
  })
})

describe("isDirectoryAutoAccepting", () => {
  test("returns true when directory key is set", () => {
    const directory = "/tmp/project"
    const autoAccept = { [`${base64Encode(directory)}/*`]: true }
    expect(isDirectoryAutoAccepting(autoAccept, directory)).toBe(true)
  })

  test("returns true when directory key is not set", () => {
    expect(isDirectoryAutoAccepting({}, "/tmp/project")).toBe(true)
  })

  test("returns false when directory key is explicitly false", () => {
    const directory = "/tmp/project"
    const autoAccept = { [`${base64Encode(directory)}/*`]: false }
    expect(isDirectoryAutoAccepting(autoAccept, directory)).toBe(false)
  })

  test("ignores session-specific keys", () => {
    const directory = "/tmp/project"
    const autoAccept = { session: true }
    expect(isDirectoryAutoAccepting(autoAccept, directory)).toBe(true)
  })
})

describe("autoAcceptDirectories", () => {
  test("recovers directories from persisted session and directory keys", () => {
    const first = "/tmp/first"
    const second = "/tmp/second"
    const directories = autoAcceptDirectories({
      [`${base64Encode(first)}/*`]: true,
      [`${base64Encode(second)}/session`]: true,
      [`${base64Encode("/tmp/disabled")}/*`]: false,
      legacy: true,
    })

    expect([...directories].sort()).toEqual([first, second].sort())
  })

  test("ignores malformed persisted keys", () => {
    expect([...autoAcceptDirectories({ "not-base64/permission": true })]).toEqual([])
  })
})

describe("convergeAutoAccept", () => {
  const directory = "/tmp/project"

  test("writes the directory key and preserves other sessions' overrides", () => {
    const autoAccept = {
      [`${base64Encode(directory)}/other`]: true,
      [`${base64Encode("/tmp/other")}/*`]: true,
    }

    const next = convergeAutoAccept(autoAccept, "ses_1", directory, false, [session({ id: "ses_1" })])

    expect(next[`${base64Encode(directory)}/*`]).toBe(false)
    expect(next[`${base64Encode(directory)}/other`]).toBe(true)
    expect(next[`${base64Encode("/tmp/other")}/*`]).toBe(true)
  })

  test("clears the current session override so the directory value wins", () => {
    const sessions = [session({ id: "ses_1" })]
    const autoAccept = {
      [`${base64Encode(directory)}/*`]: true,
      [`${base64Encode(directory)}/ses_1`]: true,
    }

    const next = convergeAutoAccept(autoAccept, "ses_1", directory, false, sessions)

    expect(next[`${base64Encode(directory)}/ses_1`]).toBeUndefined()
    expect(autoRespondsPermission(next, sessions, permission("ses_1"), directory)).toBe(false)
  })

  test("clears the legacy bare session key", () => {
    const next = convergeAutoAccept({ ses_1: true }, "ses_1", directory, true, [session({ id: "ses_1" })])

    expect(next.ses_1).toBeUndefined()
    expect(next[`${base64Encode(directory)}/*`]).toBe(true)
  })

  test("only writes the directory key without a session", () => {
    const next = convergeAutoAccept({ [`${base64Encode(directory)}/ses_1`]: true }, undefined, directory, false, [])

    expect(next[`${base64Encode(directory)}/*`]).toBe(false)
    expect(next[`${base64Encode(directory)}/ses_1`]).toBe(true)
    expect(isDirectoryAutoAccepting(next, directory)).toBe(false)
  })

  test("preserves a child choice when it conflicts with a parent and leaves siblings unchanged", () => {
    const sessions = [
      session({ id: "parent" }),
      session({ id: "child", parentID: "parent" }),
      session({ id: "sibling", parentID: "parent" }),
    ]
    const autoAccept = {
      [`${base64Encode(directory)}/parent`]: true,
      [`${base64Encode(directory)}/child`]: true,
    }

    const next = convergeAutoAccept(autoAccept, "child", directory, false, sessions)

    expect(next[`${base64Encode(directory)}/*`]).toBe(false)
    expect(next[`${base64Encode(directory)}/parent`]).toBe(true)
    expect(next[`${base64Encode(directory)}/child`]).toBe(false)
    expect(autoRespondsPermission(next, sessions, permission("child"), directory)).toBe(false)
    expect(autoRespondsPermission(next, sessions, permission("sibling"), directory)).toBe(true)
  })

  test("removes a child override when it matches the nearest inherited value", () => {
    const sessions = [session({ id: "parent" }), session({ id: "child", parentID: "parent" })]
    const autoAccept = {
      [`${base64Encode(directory)}/parent`]: false,
      [`${base64Encode(directory)}/child`]: true,
    }

    const next = convergeAutoAccept(autoAccept, "child", directory, false, sessions)

    expect(next[`${base64Encode(directory)}/child`]).toBeUndefined()
    expect(autoRespondsPermission(next, sessions, permission("child"), directory)).toBe(false)
  })

  test("uses the nearest override in a three-level parent chain", () => {
    const sessions = [
      session({ id: "root" }),
      session({ id: "parent", parentID: "root" }),
      session({ id: "child", parentID: "parent" }),
    ]
    const autoAccept = {
      [`${base64Encode(directory)}/root`]: true,
      [`${base64Encode(directory)}/parent`]: false,
    }

    const next = convergeAutoAccept(autoAccept, "child", directory, true, sessions)

    expect(next[`${base64Encode(directory)}/child`]).toBe(true)
    expect(next[`${base64Encode(directory)}/parent`]).toBe(false)
    expect(next[`${base64Encode(directory)}/root`]).toBe(true)
    expect(autoRespondsPermission(next, sessions, permission("child"), directory)).toBe(true)
  })

  test("respects a legacy parent key when converging a child choice", () => {
    const sessions = [session({ id: "parent" }), session({ id: "child", parentID: "parent" })]

    const next = convergeAutoAccept({ parent: true }, "child", directory, false, sessions)

    expect(next.parent).toBe(true)
    expect(next[`${base64Encode(directory)}/child`]).toBe(false)
    expect(autoRespondsPermission(next, sessions, permission("child"), directory)).toBe(false)
  })

  test("keeps the requested choice when the parent snapshot is incomplete", () => {
    const sessions = [session({ id: "child", parentID: "unloaded-parent" })]

    const next = convergeAutoAccept({ [`${base64Encode(directory)}/*`]: true }, "child", directory, false, sessions)

    expect(next[`${base64Encode(directory)}/*`]).toBe(false)
    expect(next[`${base64Encode(directory)}/child`]).toBe(false)
    expect(autoRespondsPermission(next, sessions, permission("child"), directory)).toBe(false)
  })
})

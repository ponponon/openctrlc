import { describe, expect, test } from "bun:test"
import { createCoturnIceServers, createTurnIceServerCache } from "./turn"
import type { PeerIceServer } from "./protocol"

const iceServers: PeerIceServer[] = [{
  urls: "turn:turn.example.test:3478",
  username: "temporary-user",
  credential: "temporary-secret",
}]

describe("createCoturnIceServers", () => {
  test("creates session-scoped credentials with a bounded expiry", () => {
    const now = Date.UTC(2026, 9, 6)
    const servers = createCoturnIceServers(
      "remote-session-id",
      ["turn:turn.example.test:3478?transport=udp", "turns:turn.example.test:443?transport=tcp"],
      "a-shared-secret-with-at-least-32-characters",
      now,
    )

    expect(servers).toHaveLength(1)
    expect(servers?.[0]?.urls).toEqual([
      "turn:turn.example.test:3478?transport=udp",
      "turns:turn.example.test:443?transport=tcp",
    ])
    expect(servers?.[0]?.username).toBe(`${Math.floor(now / 1000) + 12 * 60 * 60}:remote-session-id`)
    expect(servers?.[0]?.credential).toMatch(/^[A-Za-z0-9+/]{27}=$/)
  })

  test("rejects missing URLs, weak shared secrets, and non-WebRTC schemes", () => {
    expect(createCoturnIceServers("session", [], "a-shared-secret-with-at-least-32-characters")).toBeUndefined()
    expect(createCoturnIceServers("session", ["turn:turn.example.test:3478"], "short")).toBeUndefined()
    expect(
      createCoturnIceServers(
        "session",
        ["https://example.test"],
        "a-shared-secret-with-at-least-32-characters",
      ),
    ).toBeUndefined()
  })
})

describe("createTurnIceServerCache", () => {
  test("coalesces concurrent requests and keeps credentials scoped to each session", async () => {
    let calls = 0
    const cache = createTurnIceServerCache(async () => {
      calls += 1
      await Promise.resolve()
      return iceServers
    })

    const [first, retry, otherSession] = await Promise.all([
      cache.get("session-a"),
      cache.get("session-a"),
      cache.get("session-b"),
    ])

    expect(first).toEqual(iceServers)
    expect(retry).toEqual(iceServers)
    expect(otherSession).toEqual(iceServers)
    expect(calls).toBe(2)
    expect(await cache.get("session-a")).toEqual(iceServers)
    expect(calls).toBe(2)
  })

  test("refreshes credentials five minutes before their TTL expires", async () => {
    let currentTime = 0
    let calls = 0
    const cache = createTurnIceServerCache(async () => {
      calls += 1
      return iceServers
    }, () => currentTime)

    await cache.get("session-a")
    currentTime += 12 * 60 * 60 * 1000 - 5 * 60 * 1000 + 1
    await cache.get("session-a")

    expect(calls).toBe(2)
  })

  test("cools down failed requests and retries after the cooldown", async () => {
    let currentTime = 0
    let calls = 0
    const cache = createTurnIceServerCache(async () => {
      calls += 1
      return undefined
    }, () => currentTime)

    expect(await cache.get("session-a")).toBeUndefined()
    expect(await cache.get("session-a")).toBeUndefined()
    expect(calls).toBe(1)

    currentTime += 30_001
    expect(await cache.get("session-a")).toBeUndefined()
    expect(calls).toBe(2)
  })

  test("does not retain or reuse credentials when the session is deleted during generation", async () => {
    let resolveFirst: (value: PeerIceServer[] | undefined) => void = () => {}
    let calls = 0
    const cache = createTurnIceServerCache(() => {
      calls += 1
      if (calls === 1) return new Promise((resolve) => { resolveFirst = resolve })
      return Promise.resolve(iceServers)
    })

    const pending = cache.get("session-a")
    await Promise.resolve()
    cache.delete("session-a")
    expect(await cache.get("session-a")).toEqual(iceServers)
    resolveFirst(iceServers)

    expect(await pending).toBeUndefined()
    expect(await cache.get("session-a")).toEqual(iceServers)
    expect(calls).toBe(2)
  })
})

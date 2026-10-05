import { describe, expect, test } from "bun:test"
import { PEER_RESPONSE_CHUNK_BYTES } from "@openctrlc/remote-relay/protocol"
import {
  decodePeerResponseBody,
  PEER_CAPACITY_RETRY_DELAY_MS,
  remotePeerReconnectDelay,
  remoteSocketTarget,
  responseCreditBatch,
} from "./remote-peer"

describe("remotePeerReconnectDelay", () => {
  test("backs off after a desktop direct-peer capacity rejection", () => {
    expect(remotePeerReconnectDelay(0, 4429)).toBe(PEER_CAPACITY_RETRY_DELAY_MS)
    expect(remotePeerReconnectDelay(1, 1000)).toBe(2_000)
    expect(remotePeerReconnectDelay(3)).toBe(8_000)
    expect(remotePeerReconnectDelay(99)).toBe(30_000)
  })
})

describe("remoteSocketTarget", () => {
  test("adds the remote session only to same-origin WebSocket URLs", () => {
    const { target, relayTarget, sameOrigin } = remoteSocketTarget("wss://app.example.test/pty?existing=1", "https://app.example.test", "session-secret")

    expect(sameOrigin).toBe(true)
    expect(target.searchParams.get("existing")).toBe("1")
    expect(target.searchParams.has("_oc_remote_session")).toBe(false)
    expect(relayTarget.searchParams.get("existing")).toBe("1")
    expect(relayTarget.searchParams.get("_oc_remote_session")).toBe("session-secret")
  })

  test("does not disclose the remote session to cross-origin WebSocket URLs", () => {
    const { target, relayTarget, sameOrigin } = remoteSocketTarget("wss://other.example.test/pty?existing=1", "https://app.example.test", "session-secret")

    expect(sameOrigin).toBe(false)
    expect(target.searchParams.get("existing")).toBe("1")
    expect(target.searchParams.has("_oc_remote_session")).toBe(false)
    expect(relayTarget.searchParams.has("_oc_remote_session")).toBe(false)
  })

  test("treats HTTP and WebSocket schemes on the same host as one origin", () => {
    const { target, relayTarget, sameOrigin } = remoteSocketTarget("ws://app.example.test/pty", "http://app.example.test", "session-secret")

    expect(sameOrigin).toBe(true)
    expect(target.searchParams.has("_oc_remote_session")).toBe(false)
    expect(relayTarget.searchParams.get("_oc_remote_session")).toBe("session-secret")
  })

  test("does not equate insecure WebSocket with a secure page origin", () => {
    const { relayTarget, sameOrigin } = remoteSocketTarget("ws://app.example.test/pty", "https://app.example.test", "session-secret")

    expect(sameOrigin).toBe(false)
    expect(relayTarget.searchParams.has("_oc_remote_session")).toBe(false)
  })
})

describe("responseCreditBatch", () => {
  test("fills the available receive window with bounded credits", () => {
    const credits = responseCreditBatch(256 * 1024)

    expect(credits).toEqual([...Array.from({ length: 10 }, () => PEER_RESPONSE_CHUNK_BYTES), 16 * 1024])
    expect(credits.reduce((sum, bytes) => sum + bytes, 0)).toBe(256 * 1024)
    expect(credits.every((bytes) => bytes > 0 && bytes <= PEER_RESPONSE_CHUNK_BYTES)).toBe(true)
  })

  test("never grants more than finite positive buffer space", () => {
    expect(responseCreditBatch(PEER_RESPONSE_CHUNK_BYTES + 0.9)).toEqual([PEER_RESPONSE_CHUNK_BYTES])
    expect(responseCreditBatch(0)).toEqual([])
    expect(responseCreditBatch(-1)).toEqual([])
    expect(responseCreditBatch(Number.NaN)).toEqual([])
    expect(responseCreditBatch(Number.POSITIVE_INFINITY)).toEqual([])
  })
})

describe("decodePeerResponseBody", () => {
  test("decodes gzip before exposing direct responses to fetch consumers", async () => {
    const source = new Response(JSON.stringify({ sessions: 12, ready: true })).body!
    const compressed = source.pipeThrough(new CompressionStream("gzip"))
    const headers = new Headers({ "content-encoding": "gzip", "content-length": "42" })
    const body = decodePeerResponseBody(compressed, headers)

    expect(headers.has("content-encoding")).toBe(false)
    expect(headers.has("content-length")).toBe(false)
    expect(await new Response(body).json()).toEqual({ sessions: 12, ready: true })
  })
})

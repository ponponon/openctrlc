import { describe, expect, test } from "bun:test"
import { parseRelayURLInput } from "./remote-relay-url"

describe("parseRelayURLInput", () => {
  test("completes a bare host or https origin to the host WebSocket path", () => {
    expect(parseRelayURLInput("relay.example.com")).toBe("wss://relay.example.com/v1/host")
    expect(parseRelayURLInput("https://relay.example.com")).toBe("wss://relay.example.com/v1/host")
    expect(parseRelayURLInput("https://relay.example.com/")).toBe("wss://relay.example.com/v1/host")
  })

  test("keeps a full wss endpoint and its port", () => {
    expect(parseRelayURLInput("wss://relay.example.com:8443/v1/host")).toBe("wss://relay.example.com:8443/v1/host")
    expect(parseRelayURLInput("  wss://relay.example.com/v1/host  ")).toBe("wss://relay.example.com/v1/host")
  })

  test("treats a pasted pairing link as its relay origin", () => {
    expect(parseRelayURLInput("https://relay.example.com/join/abc123#secret")).toBe(
      "wss://relay.example.com/v1/host",
    )
  })

  test("allows plain ws for local test deployments", () => {
    expect(parseRelayURLInput("http://127.0.0.1:4097")).toBe("ws://127.0.0.1:4097/v1/host")
    expect(parseRelayURLInput("ws://127.0.0.1:4097/v1/host")).toBe("ws://127.0.0.1:4097/v1/host")
  })

  test("rejects values that cannot be a relay address", () => {
    expect(parseRelayURLInput("")).toBeUndefined()
    expect(parseRelayURLInput("   ")).toBeUndefined()
    expect(parseRelayURLInput(42)).toBeUndefined()
    expect(parseRelayURLInput("ftp://relay.example.com")).toBeUndefined()
    expect(parseRelayURLInput("https://user:pass@relay.example.com")).toBeUndefined()
    expect(parseRelayURLInput("not a url at all ///")).toBeUndefined()
    expect(parseRelayURLInput(":::")).toBeUndefined()
    expect(parseRelayURLInput("javascript:alert(1)")).toBeUndefined()
  })
})

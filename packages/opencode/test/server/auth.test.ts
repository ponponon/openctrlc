import { afterEach, describe, expect, test } from "bun:test"
import { Option, Redacted } from "effect"
import { Flag } from "@openctrlc/core/flag/flag"
import { Brand } from "@openctrlc/identity"
import { ServerAuth } from "../../src/server/auth"

const original = {
  OPENCTRLC_SERVER_PASSWORD: Flag.OPENCTRLC_SERVER_PASSWORD,
  OPENCTRLC_SERVER_USERNAME: Flag.OPENCTRLC_SERVER_USERNAME,
}

afterEach(() => {
  Flag.OPENCTRLC_SERVER_PASSWORD = original.OPENCTRLC_SERVER_PASSWORD
  Flag.OPENCTRLC_SERVER_USERNAME = original.OPENCTRLC_SERVER_USERNAME
})

describe("ServerAuth", () => {
  test("does not emit auth headers without a password", () => {
    Flag.OPENCTRLC_SERVER_PASSWORD = undefined
    Flag.OPENCTRLC_SERVER_USERNAME = "alice"

    expect(ServerAuth.header()).toBeUndefined()
    expect(ServerAuth.headers()).toBeUndefined()
  })

  test("defaults to the openctrlc username", () => {
    Flag.OPENCTRLC_SERVER_PASSWORD = "secret"
    Flag.OPENCTRLC_SERVER_USERNAME = undefined

    expect(ServerAuth.headers()).toEqual({
      Authorization: `Basic ${Buffer.from(`${Brand.cli}:secret`).toString("base64")}`,
    })
  })

  test("uses the configured username", () => {
    Flag.OPENCTRLC_SERVER_PASSWORD = "secret"
    Flag.OPENCTRLC_SERVER_USERNAME = "alice"

    expect(ServerAuth.headers()).toEqual({
      Authorization: `Basic ${Buffer.from("alice:secret").toString("base64")}`,
    })
  })

  test("prefers explicit credentials", () => {
    Flag.OPENCTRLC_SERVER_PASSWORD = "secret"
    Flag.OPENCTRLC_SERVER_USERNAME = "alice"

    expect(ServerAuth.headers({ password: "cli-secret", username: "bob" })).toEqual({
      Authorization: `Basic ${Buffer.from("bob:cli-secret").toString("base64")}`,
    })
  })

  test("validates decoded credentials against effect config", () => {
    const config = { password: Option.some("secret"), username: "alice" }

    expect(ServerAuth.required(config)).toBe(true)
    expect(ServerAuth.authorized({ username: "alice", password: Redacted.make("secret") }, config)).toBe(true)
    expect(ServerAuth.authorized({ username: Brand.cli, password: Redacted.make("secret") }, config)).toBe(false)
  })
})

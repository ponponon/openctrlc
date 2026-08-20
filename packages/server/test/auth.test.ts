import { expect, test } from "bun:test"
import { Option, Redacted } from "effect"
import { Brand } from "@openctrlc/identity"
import { ServerAuth } from "../src/auth"

test("server auth accepts the product CLI default username", () => {
  const config = { username: Brand.cli, password: Option.some("secret") }
  const authorization = ServerAuth.header({ password: "secret" })

  expect(authorization).toBe(`Basic ${Buffer.from(`${Brand.cli}:secret`).toString("base64")}`)
  expect(
    ServerAuth.authorized(
      { username: Brand.cli, password: Redacted.make("secret") },
      config,
    ),
  ).toBe(true)
})

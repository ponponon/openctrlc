import { expect, test } from "bun:test"
import { resolveCliVersion } from "./utils"

test("uses the 0.1.1 CLI release by default", () => {
  expect(resolveCliVersion({})).toBe("0.1.1")
})

test("allows the CLI release to be overridden by the environment", () => {
  expect(resolveCliVersion({ OPENCTRLC_CLI_VERSION: "0.1.1" })).toBe("0.1.1")
})

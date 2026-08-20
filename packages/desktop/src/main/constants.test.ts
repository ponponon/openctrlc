import { expect, test } from "bun:test"
import { resolveChannel } from "./channel"

test("selects every OpenCtrlC desktop channel without falling back", () => {
  expect(resolveChannel("dev")).toBe("dev")
  expect(resolveChannel("beta")).toBe("beta")
  expect(resolveChannel("prod")).toBe("prod")
  expect(resolveChannel("unknown")).toBe("dev")
})

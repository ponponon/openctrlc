import { expect, test } from "bun:test"
import { releaseTag, releaseUrl } from "./[platform]"

test("uses separate release tags for stable and beta downloads", () => {
  expect(releaseTag("stable")).toBe("latest")
  expect(releaseTag("beta")).toBe("beta")
  expect(releaseTag("stable")).not.toBe(releaseTag("beta"))
  expect(releaseUrl("stable", "openctrlc-linux-x64.deb")).toContain("/releases/latest/download/")
  expect(releaseUrl("beta", "openctrlc-linux-x64.deb")).toContain("/releases/download/beta/")
})

import { expect, test } from "bun:test"
import { releaseTag } from "./[platform]"

test("uses separate release tags for stable and beta downloads", () => {
  expect(releaseTag("stable")).toBe("latest")
  expect(releaseTag("beta")).toBe("beta")
  expect(releaseTag("stable")).not.toBe(releaseTag("beta"))
})

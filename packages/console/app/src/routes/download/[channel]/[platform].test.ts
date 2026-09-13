import { expect, test } from "bun:test"
import { releaseTag, releaseUrl } from "./[platform]"
import { resolveR2AssetUrl } from "../r2"

test("uses separate release tags for stable and beta downloads", () => {
  expect(releaseTag("stable")).toBe("latest")
  expect(releaseTag("beta")).toBe("beta")
  expect(releaseTag("stable")).not.toBe(releaseTag("beta"))
  expect(releaseUrl("stable", "openctrlc-linux-x64.deb")).toContain("/releases/latest/download/")
  expect(releaseUrl("beta", "openctrlc-linux-x64.deb")).toContain("/releases/download/beta/")
})

test("resolves only the newest public release asset from the trusted R2 host", () => {
  expect(
    resolveR2AssetUrl(
      {
        releases: [
          {
            tag: "v0.2.3",
            assets: {
              "openctrlc-win-x64.exe": {
                url: "https://openctrlc-releases.quniv.cn/openctrlc/releases/0.2.3/openctrlc-win-x64.exe",
              },
            },
          },
        ],
      },
      "openctrlc-win-x64.exe",
    ),
  ).toBe("https://openctrlc-releases.quniv.cn/openctrlc/releases/0.2.3/openctrlc-win-x64.exe")
})

test("rejects missing or untrusted R2 asset URLs", () => {
  expect(resolveR2AssetUrl({ releases: [] }, "openctrlc-win-x64.exe")).toBeUndefined()
  expect(
    resolveR2AssetUrl(
      {
        releases: [
          {
            tag: "v0.2.3",
            assets: {
              "openctrlc-win-x64.exe": { url: "https://example.com/malicious.exe" },
            },
          },
        ],
      },
      "openctrlc-win-x64.exe",
    ),
  ).toBeUndefined()
  expect(
    resolveR2AssetUrl(
      { releases: [{ tag: "v0.2.3", assets: { "openctrlc-win-x64.exe": { url: "not-a-url" } } }] },
      "openctrlc-win-x64.exe",
    ),
  ).toBeUndefined()
})

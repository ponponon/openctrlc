import { expect, test } from "bun:test"
import { detectArch, getDownloadHref, getDownloadPlatform } from "./helpers"

test("uses the published OpenCtrlC AUR package", async () => {
  const source = await Bun.file(new URL("./index.tsx", import.meta.url)).text()
  expect(source).toContain("paru -S openctrlc-bin")
  expect(source).not.toContain("paru -S openctrlc\n")
})

test("maps Linux architectures to distinct OpenCtrlC download routes", () => {
  expect(getDownloadPlatform("Linux", "x64")).toBe("linux-x64-deb")
  expect(getDownloadPlatform("Linux", "arm64")).toBe("linux-arm64-deb")
  expect(getDownloadHref("linux-x64-deb", "stable")).toBe("/download/stable/linux-x64-deb")
  expect(getDownloadHref("linux-arm64-deb", "beta")).toBe("/download/beta/linux-arm64-deb")
})

test("maps Windows architectures to distinct OpenCtrlC download routes", () => {
  expect(getDownloadPlatform("Windows", "x64")).toBe("windows-x64-nsis")
  expect(getDownloadPlatform("Windows", "arm64")).toBe("windows-arm64-nsis")
  expect(getDownloadHref("windows-arm64-nsis", "stable")).toBe("/download/stable/windows-arm64-nsis")
})

test("defaults architecture detection to x64 outside an ARM browser", () => {
  expect(detectArch()).toBe("x64")
})

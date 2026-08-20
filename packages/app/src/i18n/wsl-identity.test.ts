import { expect, test } from "bun:test"
import { DESKTOP_NATIVE_LOCALES } from "./desktop-native"
import { dict as en } from "./en"

const keys = Object.keys(en).filter(
  (key) => key.startsWith("wsl.onboarding.") || key.startsWith("desktop.wsl.error."),
)
const bundles = await Promise.all(
  DESKTOP_NATIVE_LOCALES.map(async (locale) => (locale === "en" ? { dict: en } : await import(`./${locale}`))),
)

test("WSL product-owned translations do not retain the OpenCode identity", () => {
  for (const bundle of bundles) {
    for (const key of keys) {
      const value = String(bundle.dict[key as keyof typeof bundle.dict] ?? "")
      expect(value).not.toContain("OpenCode")
      expect(value).not.toContain("opencode")
    }
  }
})

import { describe, expect, test } from "bun:test"
import { CLOUDFLARE_AI_GATEWAY_PROVIDER_ID, defaultProviderEnabled } from "./models"

describe("model provider defaults", () => {
  test("keeps Cloudflare AI Gateway disabled until explicitly enabled", () => {
    expect(defaultProviderEnabled(CLOUDFLARE_AI_GATEWAY_PROVIDER_ID)).toBe(false)
  })

  test("does not change the default for other providers", () => {
    expect(defaultProviderEnabled("openai")).toBe(true)
  })
})

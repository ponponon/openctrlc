import { describe, expect, test } from "bun:test"
import {
  CLOUDFLARE_AI_GATEWAY_PROVIDER_ID,
  CLOUDFLARE_WORKERS_AI_PROVIDER_ID,
  defaultProviderEnabled,
  isCloudflareModelProvider,
} from "./models"

describe("model provider defaults", () => {
  test("keeps both Cloudflare model providers disabled until explicitly enabled", () => {
    expect(defaultProviderEnabled(CLOUDFLARE_AI_GATEWAY_PROVIDER_ID)).toBe(false)
    expect(defaultProviderEnabled(CLOUDFLARE_WORKERS_AI_PROVIDER_ID)).toBe(false)
  })

  test("recognizes only Cloudflare model providers", () => {
    expect(isCloudflareModelProvider(CLOUDFLARE_AI_GATEWAY_PROVIDER_ID)).toBe(true)
    expect(isCloudflareModelProvider(CLOUDFLARE_WORKERS_AI_PROVIDER_ID)).toBe(true)
    expect(isCloudflareModelProvider("openai")).toBe(false)
  })

  test("does not change the default for other providers", () => {
    expect(defaultProviderEnabled("openai")).toBe(true)
  })
})

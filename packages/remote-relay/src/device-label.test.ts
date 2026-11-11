import { describe, expect, test } from "bun:test"
import { deviceLabel } from "./device-label"

describe("deviceLabel", () => {
  test("distinguishes Chrome on iOS from Safari", () => {
    const chrome =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.58 Mobile/15E148 Safari/604.1"
    expect(deviceLabel(chrome)).toBe("iPhone · Chrome")
  })

  test("keeps iOS Safari labelled as Safari", () => {
    const safari =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
    expect(deviceLabel(safari)).toBe("iPhone · Safari")
  })

  test("recognizes other iOS browser tokens", () => {
    expect(deviceLabel("Mozilla/5.0 (iPhone) FxiOS/131.0 Mobile Safari/605.1.15")).toBe("iPhone · Firefox")
    expect(deviceLabel("Mozilla/5.0 (iPad) EdgiOS/130.0 Mobile Safari/605.1.15")).toBe("iPad · Edge")
  })

  test("keeps desktop and Android labels unchanged", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe("Android · Chrome")
    expect(
      deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15"),
    ).toBe("Mac · Safari")
  })

  test("falls back for missing or unknown user agents", () => {
    expect(deviceLabel(null)).toBe("Device · Browser")
    expect(deviceLabel("some-custom-client/1.0")).toBe("Device · Browser")
  })
})

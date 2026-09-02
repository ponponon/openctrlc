import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { exaUrl, parseResponse } from "../../src/tool/mcp-websearch"
import {
  parallelAuthHeaders,
  selectWebSearchProvider,
  webSearchModelName,
  webSearchProviderLabel,
} from "../../src/tool/websearch"

import { webSearchEnabled } from "../../src/tool/registry"
import { it } from "../lib/effect"
import { ProviderV2 } from "@openctrlc/core/provider"

const SESSION_ID = "ses_0196aabbccddeeff001122334455"

describe("websearch provider", () => {
  test("selects a stable provider per session", () => {
    expect(selectWebSearchProvider(SESSION_ID)).toBe(selectWebSearchProvider(SESSION_ID))
  })

  test("supports an operational override", () => {
    const original = process.env.OPENCTRLC_WEBSEARCH_PROVIDER

    try {
      process.env.OPENCTRLC_WEBSEARCH_PROVIDER = "parallel"
      expect(selectWebSearchProvider(SESSION_ID)).toBe("parallel")

      process.env.OPENCTRLC_WEBSEARCH_PROVIDER = "exa"
      expect(selectWebSearchProvider(SESSION_ID)).toBe("exa")
    } finally {
      if (original === undefined) delete process.env.OPENCTRLC_WEBSEARCH_PROVIDER
      else process.env.OPENCTRLC_WEBSEARCH_PROVIDER = original
    }
  })

  test("routes to Exa when the Exa flag is enabled", () => {
    expect(selectWebSearchProvider(SESSION_ID, { exa: true, parallel: false })).toBe("exa")
  })

  test("routes to Parallel when the Parallel flag is enabled", () => {
    expect(selectWebSearchProvider(SESSION_ID, { exa: false, parallel: true })).toBe("parallel")
  })

  test("is enabled for all providers by default", () => {
    expect(webSearchEnabled(ProviderV2.ID.opencode, { exa: false, parallel: false })).toBe(true)
    expect(webSearchEnabled(ProviderV2.ID.make("opencode-go"), { exa: false, parallel: false })).toBe(true)
    expect(webSearchEnabled(ProviderV2.ID.openai, { exa: false, parallel: false })).toBe(true)
    expect(webSearchEnabled(ProviderV2.ID.openai, { exa: true, parallel: false })).toBe(true)
    expect(webSearchEnabled(ProviderV2.ID.openai, { exa: false, parallel: true })).toBe(true)
  })

  test("is enabled when a provider override selects Exa", () => {
    const original = process.env.OPENCTRLC_WEBSEARCH_PROVIDER

    try {
      process.env.OPENCTRLC_WEBSEARCH_PROVIDER = "exa"
      expect(webSearchEnabled(ProviderV2.ID.openai, { exa: false, parallel: false })).toBe(true)
    } finally {
      if (original === undefined) delete process.env.OPENCTRLC_WEBSEARCH_PROVIDER
      else process.env.OPENCTRLC_WEBSEARCH_PROVIDER = original
    }
  })

  test("uses branded labels", () => {
    expect(webSearchProviderLabel("parallel")).toBe("Parallel Web Search")
    expect(webSearchProviderLabel("exa")).toBe("Exa Web Search")
    expect(webSearchProviderLabel(undefined)).toBe("Web Search")
  })

  test("uses the provider API model id for Parallel analytics", () => {
    expect(
      webSearchModelName({
        model: {
          id: "claude-opus-4-7",
          api: { id: "claude-opus-4.7" },
        },
      }),
    ).toBe("claude-opus-4.7")
  })

  test("sends the product user agent without an API key", () => {
    const original = process.env.PARALLEL_API_KEY
    try {
      delete process.env.PARALLEL_API_KEY
      expect(parallelAuthHeaders()).toEqual({ "User-Agent": expect.stringMatching(/^opencode\//) })
    } finally {
      if (original === undefined) delete process.env.PARALLEL_API_KEY
      else process.env.PARALLEL_API_KEY = original
    }
  })

  test("adds the Parallel authorization header when an API key is configured", () => {
    const original = process.env.PARALLEL_API_KEY
    try {
      process.env.PARALLEL_API_KEY = "parallel-test-key"
      expect(parallelAuthHeaders()).toEqual({
        "User-Agent": expect.stringMatching(/^opencode\//),
        Authorization: "Bearer parallel-test-key",
      })
    } finally {
      if (original === undefined) delete process.env.PARALLEL_API_KEY
      else process.env.PARALLEL_API_KEY = original
    }
  })
})

describe("websearch MCP response parser", () => {
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: {
      content: [
        {
          type: "text",
          text: "search results",
        },
      ],
    },
  })

  it.effect("parses plain JSON-RPC responses", () =>
    Effect.gen(function* () {
      const result = yield* parseResponse(payload)
      expect(result).toBe("search results")
    }),
  )

  it.effect("parses SSE JSON-RPC responses", () =>
    Effect.gen(function* () {
      const result = yield* parseResponse(`event: message\ndata: ${payload}\n\n`)
      expect(result).toBe("search results")
    }),
  )

  it.effect("ignores non-JSON SSE data frames", () =>
    Effect.gen(function* () {
      const result = yield* parseResponse(`data: [DONE]\ndata: ${payload}\n\n`)
      expect(result).toBe("search results")
    }),
  )
})

describe("websearch Exa URL", () => {
  test("reads the Exa API key when the request URL is built", () => {
    const original = process.env.EXA_API_KEY

    try {
      process.env.EXA_API_KEY = "exa test key"
      expect(exaUrl()).toBe("https://mcp.exa.ai/mcp?exaApiKey=exa+test+key")
    } finally {
      if (original === undefined) delete process.env.EXA_API_KEY
      else process.env.EXA_API_KEY = original
    }
  })
})

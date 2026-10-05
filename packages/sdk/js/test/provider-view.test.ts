import { expect, test } from "bun:test"
import { createOpencodeClient } from "../src/v2/client"

test("serializes provider catalog views on the provider endpoint", async () => {
  const urls: string[] = []
  const client = createOpencodeClient({
    baseUrl: "http://127.0.0.1:4000",
    fetch: async (request) => {
      urls.push(request.url)
      return new Response(JSON.stringify({ all: [], default: {}, connected: [] }), {
        headers: { "content-type": "application/json" },
      })
    },
  })

  await client.provider.list({ directory: "/repo", view: "summary" })
  await client.provider.list({ directory: "/repo", view: "full" })

  expect(urls.map((value) => new URL(value).searchParams.get("view"))).toEqual(["summary", "full"])
})

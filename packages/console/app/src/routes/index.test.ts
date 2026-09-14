import { expect, test } from "bun:test"

test("keeps the open-source support entry point on the homepage", async () => {
  const source = await Bun.file(new URL("./index.tsx", import.meta.url)).text()
  const image = await Bun.file(new URL("../../public/wechat-appreciate.jpg", import.meta.url)).exists()

  expect(source).toContain('data-component="support"')
  expect(source).toContain('id="support"')
  expect(source).toContain("/wechat-appreciate.jpg")
  expect(source).toContain('loading="lazy"')
  expect(image).toBe(true)
})

import { expect, test } from "bun:test"
import { createMarkdownParser, parseMarkdownSync } from "./marked-parser"

const parser = createMarkdownParser((code, language) => `<pre data-language="${language}">${code}</pre>`)

test("renders links with application attributes", async () => {
  expect(await parser.parse("[OpenCode](https://opencode.ai)")).toBe(
    '<p><a href="https://opencode.ai" class="external-link" target="_blank" rel="noopener noreferrer">OpenCode</a></p>\n',
  )
})

test("renders inline and block math", async () => {
  expect(await parser.parse("\\(x^2\\)")).toContain('<span class="katex">')
  expect(await parser.parse("$$\nx^2\n$$\n")).toContain('<span class="katex-display">')
  expect(await parser.parse("$$x^2$$")).toContain('<span class="katex-display">')
  expect(await parser.parse("$O(1)$")).toContain('<span class="katex">')
  expect(await parser.parse("\\[x^2\\]")).toContain('<span class="katex-display">')
})

test("renders display math embedded in a list item", async () => {
  const text = "- Segment 最大体积为 $$\\frac{512,000 \\text{ 行}}{8 \\text{ bit}} = 64 \\text{ KB}$$"

  const result = await parser.parse(text)

  expect(result).toContain('<span class="katex-display">')
  expect(result).not.toContain("$$")
})

test("renders strong text in the synchronous fallback parser", () => {
  const text = "直击**列式存储\n**最底层的工程秘密！"
  const result = parseMarkdownSync(text)

  expect(result).toContain("<strong>")
  expect(result).not.toContain("**")
})

test("renders strong text adjacent to CJK characters in the worker parser", async () => {
  const result = await parser.parse("直击**列式存储**最底层的工程秘密！")

  expect(result).toContain("<strong>")
  expect(result).not.toContain("**")
})

test("uses the configured code highlighter", async () => {
  expect(await parser.parse("```ts\nconst value = 1\n```\n")).toBe('<pre data-language="ts">const value = 1</pre>\n')
})

import { describe, expect, test } from "bun:test"
import { parseMarkdown } from "./changelog-markdown"

describe("parseMarkdown", () => {
  test("renders headings, nested markdown, and safe external links", () => {
    const result = parseMarkdown(
      [
        "## Downloads",
        "",
        "### Linux",
        "",
        "- [x64 DEB](https://example.com/openctrlc.deb)",
        "- **ARM64** `AppImage`",
        "",
        "<script>alert('unsafe')</script>",
      ].join("\n"),
    )

    expect(result).toContain("<h2>Downloads</h2>")
    expect(result).toContain("<h3>Linux</h3>")
    expect(result).toContain('href="https://example.com/openctrlc.deb"')
    expect(result).toContain("<strong>ARM64</strong>")
    expect(result).toContain("<code>AppImage</code>")
    expect(result).not.toContain("[x64 DEB]")
    expect(result).not.toContain("<script>")
  })

  test("removes custom highlight markup from the markdown body", () => {
    const result = parseMarkdown('<highlight source="OpenCtrlC">hidden</highlight>\n\n## Fixes\n\n- Stable')

    expect(result).toContain("<h2>Fixes</h2>")
    expect(result).toContain("Stable")
    expect(result).not.toContain("highlight")
  })
})

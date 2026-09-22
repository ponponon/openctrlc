import { marked, type Tokens } from "marked"

export function parseMarkdown(body: string) {
  const markdown = body
    .replace(/<highlight\s+source="[^"]+">[\s\S]*?<\/highlight>/gi, "")
    .replace(/^\*\*Thank you[\s\S]*$/m, "")
    .trim()

  return markdown ? marked.parse(markdown, { async: false, gfm: true, renderer: changelogRenderer }) : ""
}

const changelogRenderer = new marked.Renderer()

changelogRenderer.html = () => ""
changelogRenderer.link = function (token: Tokens.Link) {
  const text = this.parser.parseInline(token.tokens)
  const href = safeExternalUrl(token.href)
  if (!href) return text

  const title = token.title ? ` title="${escapeAttribute(token.title)}"` : ""
  return `<a href="${escapeAttribute(href)}"${title} target="_blank" rel="noopener noreferrer">${text}</a>`
}
changelogRenderer.image = function (token: Tokens.Image) {
  const src = safeExternalUrl(token.href)
  if (!src) return this.parser.parseInline(token.tokens)

  return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(token.text)}" loading="lazy" />`
}

function safeExternalUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) return
  return value
}

function escapeAttribute(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    if (character === "&") return "&amp;"
    if (character === "<") return "&lt;"
    if (character === ">") return "&gt;"
    if (character === '"') return "&quot;"
    return "&#39;"
  })
}

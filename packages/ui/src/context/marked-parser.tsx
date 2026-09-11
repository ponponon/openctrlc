import katex from "katex"
import { Marked, type MarkedExtension, type Tokens } from "marked"
import markedShiki from "marked-shiki"

export function createMarkdownParser(highlight: (code: string, language: string) => string | Promise<string>) {
  return new Marked(
    {
      renderer: {
        link({ href, title, text }) {
          const titleAttr = title ? ` title="${title}"` : ""
          return `<a href="${href}"${titleAttr} class="external-link" target="_blank" rel="noopener noreferrer">${text}</a>`
        },
      },
    },
    katexExtension,
    markedShiki({ highlight }),
  )
}

const inlineMathRegex = /^(?:\\\(((?:\\.|[^\\\n])*?)\\\)|\\\[([\s\S]+?)\\\]|(\$\$([^\n]+?)\$\$)|(\$(?!\s)((?:\\.|[^$\\\n])*?\S)\$(?!\$)))/
const blockMathRegex = /^\$\$(?:\r?\n([\s\S]+?)\r?\n\$\$|([^\r\n]+?)\$\$)(?:\r?\n|$)/
const mathDelimiters = ["\\(", "\\[", "$$", "$"]

const katexExtension: MarkedExtension = {
  extensions: [
    {
      name: "inlineKatex",
      level: "inline",
      start(src) {
        const indexes = mathDelimiters.map((delimiter) => src.indexOf(delimiter)).filter((index) => index >= 0)
        if (indexes.length === 0) return
        return Math.min(...indexes)
      },
      tokenizer(src) {
        const match = src.match(inlineMathRegex)
        if (!match) return
        return {
          type: "inlineKatex",
          raw: match[0],
          text: (match[1] ?? match[2] ?? match[4] ?? match[6] ?? "").trim(),
          displayMode: match[2] !== undefined || match[4] !== undefined,
        }
      },
      renderer: renderKatexToken,
    },
    {
      name: "blockKatex",
      level: "block",
      tokenizer(src) {
        const match = src.match(blockMathRegex)
        if (!match) return
        return {
          type: "blockKatex",
          raw: match[0],
          text: (match[1] ?? match[2] ?? "").trim(),
          displayMode: true,
        }
      },
      renderer: renderKatexToken,
    },
  ],
}

function renderKatexToken(token: Tokens.Generic) {
  return katex.renderToString(typeof token.text === "string" ? token.text : "", {
    displayMode: token.displayMode === true,
    throwOnError: false,
  })
}

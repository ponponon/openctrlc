import type { MarkedExtension, Tokens } from "marked"

export const markdownOptions: MarkedExtension = {
  renderer: {
    link(token: Tokens.Link) {
      const titleAttr = token.title ? ` title="${token.title}"` : ""
      return `<a href="${token.href}"${titleAttr} class="external-link" target="_blank" rel="noopener noreferrer">${token.text}</a>`
    },
  },
}

const strongRegex = /^(\*\*|__)([\s\S]+?)\1/
const strongDelimiters = ["**", "__"]

export const adjacentStrong: MarkedExtension = {
  extensions: [
    {
      name: "adjacentStrong",
      level: "inline",
      start(src) {
        const indexes = strongDelimiters.map((delimiter) => src.indexOf(delimiter)).filter((index) => index >= 0)
        if (indexes.length === 0) return
        return Math.min(...indexes)
      },
      tokenizer(src) {
        const match = src.match(strongRegex)
        if (!match) return
        return {
          type: "strong",
          raw: match[0],
          text: match[2],
          tokens: this.lexer.inlineTokens(match[2]),
        }
      },
    },
  ],
}

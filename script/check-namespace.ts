import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const productTokens = /OpenCode|opencode|OPENCODE_|\.opencode|opencode\.jsonc?|opencode\.json|@opencode-ai\/[A-Za-z0-9._-]+/g
const externalTokens = [
  /https?:\/\/[^\s)`"]*opencode\.ai[^\s)`"]*/,
  /https?:\/\/[^\s)`"]*anomalyco\/opencode[^\s)`"]*/,
  /anomalyco\/opencode/,
  /@opencode-ai\/sdk(?=\/|$|[^A-Za-z0-9._-])/,
  /@opencode-ai\/plugin(?=\/|$|[^A-Za-z0-9._-])/,
  /@opencode-ai\/client(?=\/|$|[^A-Za-z0-9._-])/,
  /@plannotator\/opencode\b/,
  /@openspoon\/subtask2\b/,
  /opencode-(?:agent|go|google-antigravity-auth|gitlab-auth|poe-auth|helicone-session|wakatime|gitlab-plugin|daytona|type-inject|openai-codex-auth|antigravity-auth|devcontainers|dynamic-context-pruning|vibeguard|websearch-cited|pty|shell-strategy|md-table-formatter|morph-fast-apply|morph-plugin|notificator|notifier|zellij-namer|skillful|supermemory|scheduler|conductor|background-agents|notify|workspace|worktree|sentry-monitor|firecrawl|jfrog-plugin|goal-plugin|tavily)\b/,
  /opencode\/(?:[A-Za-z0-9._-]+|<model-id>)/,
  /opencode-go\/(?:[A-Za-z0-9._-]+|<model-id>)/,
  /\.well-known\/opencode/,
  /OPENCODE_API_KEY/,
  /OPENCODE_AUTH_JSON/,
  /GITLAB_TOKEN_OPENCODE/,
  /opencode-config/,
  /sst-dev/,
  /security@anoma\.ly/,
  /models\.dev/,
  /\bopencode\/[A-Za-z0-9._-]+/,
  /\bopencode-(?:go|agent|gemini-auth|google-antigravity-auth|gitlab-auth|gitlab-plugin|poe-auth|helicone-session|wakatime|daytona|type-inject|openai-codex-auth|antigravity-auth|devcontainers|dynamic-context-pruning|vibeguard|websearch-cited|pty|shell-strategy|md-table-formatter|morph-fast-apply|morph-plugin|notificator|notifier|zellij-namer|skillful|supermemory|scheduler|conductor|background-agents|notify|workspace|worktree|sentry-monitor|firecrawl|jfrog-plugin|goal-plugin|tavily|nvim|plugin-template|obsidian|agents)\b/,
  /\b(?:awesome-opencode|oh-my-opencode)\b/,
  /https?:\/\/[^\s)`"]*github\.com\/(?:awesome-opencode|daytonaio\/daytona|H2Shami\/opencode-helicone-session|nick-vi\/opencode-type-inject|numman-ali\/opencode-openai-codex-auth|NoeFabris\/opencode-antigravity-auth|athal7\/opencode-devcontainers|shekohex\/opencode-google-antigravity-auth|Tarquinen\/opencode-dynamic-context-pruning|inkdust2021\/opencode-vibeguard|ghoulr\/opencode-websearch-cited|shekohex\/opencode-pty|JRedeker\/opencode-shell-strategy|franlol\/opencode-md-table-formatter|morphllm\/opencode|panta82\/opencode-notificator|mohak34\/opencode-notifier|24601\/opencode-zellij-namer|zenobi-us\/opencode-skillful|supermemoryai\/opencode-supermemory|different-ai\/opencode-scheduler|derekbar90\/opencode-conductor|kdcokenny\/opencode|stolinski\/opencode-sentry-monitor|firecrawl\/opencode-firecrawl|jfrog\/opencode-jfrog-plugin|willytop8\/OpenCode-goal-plugin|tavily-ai\/opencode-tavily|NickvanDyke\/opencode\.nvim|sudo-tee\/opencode\.nvim|zenobi-us\/opencode-plugin-template|mtymek\/opencode-obsidian|darrenhinde\/opencode-agents|code-yeongyu\/oh-my-opencode|awesome-opencode)\b/,
  /(?:^|[\[(\s])(?:awesome-opencode|oh-my-opencode|opencode(?:gent|-agent|-go)?)(?=[\])\s).,])/,
  /https?:\/\/[^\s)`"]*gitlab\.com\/nagyv\/gitlab-opencode\b/,
  /https?:\/\/[^\s)`"]*docs\.ollama\.com\/integrations\/opencode\b/,
  /https?:\/\/[^\s)`"]*gitlab\.com\/explore\/catalog\/nagyv\/gitlab-opencode\b/,
  /https?:\/\/[^\s)`"]*signup\.snowflake\.com\/[^\s)`"]*utm_source=opencode/,
  /(?:github\.com\/apps\/opencode(?:-agent|-gent)?|github\.com\/apps\/openctrlcgent)/,
  /(?:^|[\[(\s])(?:opencode-[A-Za-z0-9._-]+|@plannotator\/opencode)(?=[\])\s).,])/,
  /\[[^\]]*opencode[^\]]*\]\([^)]*\)/,
  /\| \[[^\]]*opencode[^\]]*\]\([^)]*\)\s*\|[^\n]*@opencode-ai\/sdk/,
  /\| \[OpenCode-Obsidian\]\([^)]*\)\s*\|[^\n]*/,
  /https?:\/\/[^\s)`"]*opencode[^\s)`"]*/,
  /https?:\/\/[^\s)`"]*gitlab\.com\/nagyv\/gitlab-opencode\b/,
  /https?:\/\/[^\s)`"]*docs\.ollama\.com\/integrations\/opencode\b/,
  /github\.com\/anomalyco\/opencode\/(?:issues|pull|actions)/,
  /\[[^\]]*(?:opencode\.ai|openctrlc\.ai)[^\]]*\]\((?:<[^>]+>|[^)]*)\)/i,
]
const externalContext = /https?:\/\/[^\s)`"]*opencode(?:\.ai|\/)|(?:^|[\[(\s])(?:awesome-opencode|oh-my-opencode|opencode(?:gent|-agent|-go)?)(?=[\])\s).,])/g
const auditedScopes = [
  ".openctrlc/",
  "packages/web/src/content/docs/",
  "packages/core/src/plugin/skill/",
  "packages/console/app/src/i18n/",
  "packages/console/support/src/",
]

export function scanText(source: string, file: string) {
  const mismatch = [...source.matchAll(/\[([^\]]*(?:opencode\.ai|openctrlc\.ai)[^\]]*)\]\(/gi)].some((match) => {
    const label = match[1].toLowerCase()
    const parsed = parseInlineLink(source, (match.index ?? 0) + match[0].length)
    if (!parsed) return true
    const hostname = URL.canParse(parsed.href) ? new URL(parsed.href).hostname : undefined
    if (!hostname) return true
    return (label.includes("opencode.ai") && !isAllowedWebHostname(hostname, "opencode.ai")) || (label.includes("openctrlc.ai") && !isAllowedWebHostname(hostname, "openctrlc.ai"))
  })
  if (mismatch) return [`${file}:1:external-link-mismatch`]
  return source.split("\n").flatMap((line, index) => {
    const matches = [...line.matchAll(productTokens)]
    const externalRanges = [...externalTokens, externalContext].flatMap((pattern) =>
      [...line.matchAll(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`))].map((match) => [match.index ?? 0, (match.index ?? 0) + match[0].length]),
    )
    return matches
      .filter((match) => !isAllowedExternalMatch(line, match.index ?? 0, match[0], externalRanges))
      .map((match) => `${file}:${index + 1}:${match[0]}`)
  })
}

if (import.meta.main) await run()

async function run() {
  const tracked = (await Bun.$`git ls-files -z`.cwd(root).text()).split("\0").filter(Boolean)
  const ignored = new Set([
    "script/check-namespace.ts",
    "script/check-namespace.test.ts",
    "packages/sdk/openapi.json",
    ...tracked.filter(
      (file) =>
        file.startsWith("packages/app/vendor/") ||
        file.startsWith("packages/client/src/generated/") ||
        file.startsWith("packages/client/src/generated-effect/") ||
        file.startsWith("packages/sdk/js/src/gen/") ||
        file.startsWith("packages/sdk/js/src/v2/gen/"),
    ),
  ])
  const violations = await Promise.all(
    tracked.map(async (file) => {
      if (ignored.has(file) || !auditedScopes.some((scope) => file.startsWith(scope)) || !/\.(md|mdx|ts|tsx|json|jsonc)$/.test(file)) return []
      return scanText(await Bun.file(path.join(root, file)).text(), file)
    }),
  ).then((results) => results.flat())

  if (violations.length) {
    console.error(violations.join("\n"))
    process.exit(1)
  }
}

function isAllowedExternalMatch(line: string, offset: number, token: string, externalRanges: number[][]) {
  if (externalRanges.some(([start, end]) => offset < end && offset + token.length > start)) return true
  if (fileIsHistoricalTool(line, token)) return true
  return false
}

function fileIsHistoricalTool(line: string, token: string) {
  return token === "opencode" && /const repo = "opencode"/.test(line)
}

function isAllowedWebHostname(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

function parseInlineLink(source: string, start: number) {
  const destinationStart = skipWhitespace(source, start)
  const angle = source[destinationStart] === "<"
  const hrefStart = angle ? destinationStart + 1 : destinationStart
  const hrefEnd = angle ? source.indexOf(">", hrefStart) : findBareDestinationEnd(source, hrefStart)
  if (hrefEnd < 0 || hrefEnd === hrefStart) return
  const href = source.slice(hrefStart, hrefEnd)
  const suffixStart = angle ? hrefEnd + 1 : hrefEnd
  const suffix = parseLinkSuffix(source, suffixStart)
  if (suffix === undefined) return
  return { href }
}

function skipWhitespace(source: string, start: number) {
  let index = start
  while (/\s/.test(source[index] ?? "")) index++
  return index
}

function findBareDestinationEnd(source: string, start: number) {
  let index = start
  while (index < source.length && !/[\s)]/.test(source[index])) index++
  return index
}

function parseLinkSuffix(source: string, start: number) {
  const index = skipWhitespace(source, start)
  if (source[index] === ")") return index + 1
  if (source[index] === '"' || source[index] === "'") return parseQuotedTitle(source, index)
  if (source[index] === "(") return parseParenthesizedTitle(source, index)
  return
}

function parseQuotedTitle(source: string, start: number) {
  const quote = source[start]
  let index = start + 1
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2
      continue
    }
    if (source[index] === quote) return requireClosingLink(source, index + 1)
    index++
  }
  return
}

function parseParenthesizedTitle(source: string, start: number) {
  let depth = 1
  let index = start + 1
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2
      continue
    }
    if (source[index] === "(") depth++
    if (source[index] === ")") {
      depth--
      if (depth === 0) return requireClosingLink(source, index + 1)
    }
    index++
  }
  return
}

function requireClosingLink(source: string, start: number) {
  const index = skipWhitespace(source, start)
  return source[index] === ")" ? index + 1 : undefined
}

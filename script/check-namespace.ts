import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const productTokens =
  /OpenCode(?![A-Za-z0-9._-])|opencode(?![A-Za-z0-9._-])|OPENCODE_[A-Z0-9_]+|\.opencode|opencode\.jsonc?|opencode\.json|@opencode-ai\/[A-Za-z0-9._-]+/g
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
const externalContext =
  /https?:\/\/[^\s)`"]*opencode(?:\.ai|\/)|(?:^|[\[(\s])(?:awesome-opencode|oh-my-opencode|opencode(?:gent|-agent|-go)?)(?=[\])\s).,])/g
const productContractAllowlist: Array<{ file: RegExp; line: RegExp }> = [
  {
    file: /packages\/app\/src\/i18n\/[^/]+\.ts$/,
    line: /.*(?:dialog\.provider\.opencode|provider\.connect\.opencodeZen|opencode\.ai\/zen).*/,
  },
  {
    file: /packages\/app\/src\/components\/(?:dialog-connect-provider|dialog-select-model(?:-unpaid|-unpaid-v2)?|settings-providers|settings-v2\/providers)\.tsx$/,
    line: /(?:id|provider)\s*===?\s*["'`]opencode|["'`]opencode(?:-go)?["'`]|opencode\.ai\/zen|\.opencode/,
  },
  { file: /packages\/app\/src\/components\/dialog-.*\.stories\.tsx$/, line: /.*(?:OpenCode|["'`]opencode["'`]).*/ },
  {
    file: /packages\/app\/src\/(?:context|utils|pages\/session)\/.*\.(?:ts|tsx)$/,
    line: /.*(?:OpenCodeEvent|OpenCodeClient|@opencode-ai\/client|@opencode-ai\/sdk).*/,
  },
  {
    file: /packages\/app\/src\/(?:context|utils|pages\/session)\/.*\.(?:ts|tsx)$/,
    line: /.*(?:opencode\.(?:window|global)|opencode-titlebar|legacy.*opencode|opencode\.dat).*/i,
  },
  {
    file: /packages\/app\/src\/i18n\/(?:parity|wsl-identity)\.test\.ts$/,
    line: /.*(?:OpenCode|opencode|\.opencode).*/,
  },
  { file: /packages\/app\/src\/theme-preload\.test\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/app\/src\/utils\/(?:persist|terminal-websocket-url)\.test\.ts$/, line: /.*opencode.*/ },
  {
    file: /packages\/app\/src\/utils\/(?:comment-note|draft-store|session-export)\.ts$/,
    line: /.*(?:opencode|\.opencode).*/,
  },
  { file: /packages\/app\/src\/utils\/server(?:-health)?\.ts$/, line: /.*OpenCode.*/ },
  { file: /packages\/app\/src\/entry\.tsx$/, line: /.*opencode\.ai.*/ },
  { file: /packages\/app\/src\/hooks\/use-providers\.ts$/, line: /.*["'`]opencode(?:-go)?["'`].*/ },
  {
    file: /packages\/app\/src\/components\/(?:session\/session-header|titlebar|titlebar-session-events|windows-app-menu)\.[^.]+$/,
    line: /.*opencode.*/,
  },
  { file: /packages\/app\/src\/components\/terminal\.tsx$/, line: /.*opencode.*/ },
  { file: /packages\/app\/src\/components\/windows-app-menu\.tsx$/, line: /.*OpenCode.*/ },
  {
    file: /packages\/app\/src\/components\/prompt-input\/build-request-parts\.test\.ts$/,
    line: /.*(?:opencode|\.opencode).*/,
  },
  {
    file: /packages\/app\/src\/components\/(?:dialog-select-model-unpaid|dialog-select-model-unpaid-v2)\.tsx$/,
    line: /.*(?:opencode|\.opencode).*/,
  },
  {
    file: /packages\/app\/src\/components\/settings-(?:providers|v2\/providers)\.tsx$/,
    line: /.*(?:opencode|\.opencode).*/,
  },
  {
    file: /packages\/app\/src\/context\/(?:file\/path|global-sync\/bootstrap|global-sync\/utils|server)\.(?:ts|tsx)$/,
    line: /.*opencode.*/,
  },
  { file: /packages\/app\/src\/identity-residuals\.test\.ts$/, line: /.*(?:opencode|OPENCODE_).*/ },
  { file: /packages\/app\/src\/pages\/layout\/helpers\.ts$/, line: /.*OPENCODE_PROJECT_ID.*/ },
  { file: /packages\/app\/src\/pages\/session\/usage-exceeded-dialogs\.tsx$/, line: /.*opencode.*/ },
  { file: /packages\/app\/src\/utils\/(?:server-compat|server-errors)\.test\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/app\/src\/context\/file\/path\.test\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/app\/src\/context\/global-sync\/utils\.test\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/app\/src\/context\/server\.test\.ts$/, line: /.*opencode.*/ },
  {
    file: /packages\/core\/src\/plugin\/provider\/[^/]+\.ts$/,
    line: /.*(?:User-Agent|X-Title|X-Source|HTTP-Referer|http-referer|X-BILLING|Integration|opencode\.ai).*opencode.*/,
  },
  { file: /packages\/core\/src\/plugin\/provider\/opencode\.ts$/, line: /.*(?:opencode|OpenCode).*/ },
  { file: /packages\/core\/src\/plugin\/provider\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/core\/src\/plugin\/provider\/(?:nvidia|vercel)\.ts$/, line: /.*(?:OpenCode|opencode).*/ },
  { file: /packages\/core\/src\/plugin\/skill\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/core\/src\/tool\/websearch\.ts$/, line: /.*User-Agent.*opencode.*/ },
  { file: /packages\/core\/src\/plugin\/provider\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/core\/src\/plugin\/provider\/(?:nvidia|openai|vercel)\.ts$/, line: /.*(?:OpenCode|opencode).*/ },
  { file: /packages\/core\/src\/plugin\/skill\.ts$/, line: /.*opencode.*/ },
  {
    file: /packages\/core\/src\/(?:catalog|observability\/otlp|file-mutation|shell|tool\/AGENTS|v1\/config\/lsp)\.[^.]+$/,
    line: /.*(?:opencode|OpenCode).*/,
  },
  {
    file: /packages\/opencode\/src\/(?:acp|account|auth|config\/managed|control-plane\/dev|ide|plugin|provider|server|session|skill|util|worktree)\/.*\.(?:ts|tsx|md|mdx)$/,
    line: /(?:User-Agent|originator|X-Title|X-Source|@opencode|OpenCodeEvent|ProviderV2|providerID|provider\.id|OPENCODE_)[^;\n]*(?:OpenCode|opencode)/,
  },
  { file: /packages\/opencode\/src\/plugin\/openai\/codex\.ts$/, line: /.*(?:originator|User-Agent).*opencode.*/ },
  {
    file: /packages\/opencode\/src\/plugin\/(?:digitalocean|github-copilot\/copilot|snowflake-cortex|xai)\.ts$/,
    line: /.*User-Agent.*opencode.*/,
  },
  { file: /packages\/opencode\/src\/cli\/cmd\/run\/footer\.(?:prompt|view)\.tsx$/, line: /.*OPENCODE_.*/ },
  { file: /packages\/opencode\/src\/plugin\/openai\/README\.md$/, line: /.*OPENCODE_.*/ },
  { file: /packages\/opencode\/src\/session\/llm\/AGENTS\.md$/, line: /.*(?:OPENCODE_|@opencode|opencode).*/ },
  { file: /packages\/opencode\/src\/session\/llm\/AGENTS\.md$/, line: /.*opencode's normalized session input.*/ },
  { file: /packages\/opencode\/src\/skill\/index\.ts$/, line: /.*OPENCODE_.*/ },
  { file: /packages\/opencode\/src\/session\/llm\.ts$/, line: /.*@opencode-ai\/llm.*/ },
  { file: /packages\/opencode\/src\/session\/llm\/request\.ts$/, line: /.*x-opencode-.*/ },
  { file: /packages\/opencode\/src\/plugin\/shared\.ts$/, line: /.*(?:opencode|\.opencode).*/ },
  { file: /packages\/opencode\/src\/server\/routes\/instance\/httpapi\/.*\.ts$/, line: /.*(?:opencode|OpenCode).*/ },
  { file: /packages\/opencode\/src\/server\/(?:proxy-util|shared\/.*)\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/opencode\/src\/worktree\/index\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/opencode\/src\/config\/managed\.ts$/, line: /.*(?:opencode|OpenCode|\.opencode).*/ },
  { file: /packages\/opencode\/src\/ide\/index\.ts$/, line: /.*\.opencode.*/ },
  { file: /packages\/opencode\/src\/plugin\/openai\/ws-pool\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/opencode\/src\/plugin\/github-copilot\/models\.ts$/, line: /.*OpenCode.*/ },
  { file: /packages\/opencode\/src\/plugin\/(?:digitalocean|snowflake-cortex)\.ts$/, line: /.*OpenCode.*/ },
  { file: /packages\/opencode\/src\/provider\/(?:error|provider|transform)\.ts$/, line: /.*(?:opencode|OpenCode).*/ },
  { file: /packages\/opencode\/src\/session\/retry\.ts$/, line: /.*OpenCode.*/ },
  { file: /packages\/opencode\/src\/cli\/cmd\/run\/footer\.prompt\.tsx$/, line: /.*OpenCode.*/ },
  { file: /packages\/opencode\/src\/session\/llm\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/opencode\/src\/session\/llm\/native-request\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/opencode\/src\/session\/llm\/request\.ts$/, line: /.*providerID\.startsWith\("opencode"\).*/ },
  { file: /packages\/opencode\/src\/tool\/registry\.ts$/, line: /.*\.opencode.*/ },
  { file: /packages\/opencode\/src\/util\/process\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/opencode\/src\/account\/account\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/opencode\/src\/cli\/cmd\/(?:github\.handler|models|providers)\.ts$/, line: /.*opencode.*/ },
  {
    file: /packages\/opencode\/src\/cli\/cmd\/run\/(?:demo|footer\.command|footer\.permission|permission\.shared|splash)\.(?:ts|tsx)$/,
    line: /.*(?:opencode|OpenCode).*/,
  },
  { file: /packages\/opencode\/src\/cli\/cmd\/(?:serve|web)\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/opencode\/src\/acp\/(?:service|usage)\.ts$/, line: /.*(?:opencode|OpenCode).*/ },
  { file: /packages\/opencode\/src\/auth\/index\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/opencode\/src\/control-plane\/dev\/README\.md$/, line: /.*OpenCode.*/ },
  { file: /packages\/opencode\/src\/plugin\/shared\.ts$/, line: /.*(?:opencode|\.opencode).*/ },
  { file: /packages\/opencode\/src\/plugin\/openai\/ws-pool\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/opencode\/src\/plugin\/github-copilot\/models\.ts$/, line: /.*OpenCode.*/ },
  { file: /packages\/opencode\/src\/plugin\/(?:digitalocean|snowflake-cortex)\.ts$/, line: /.*OpenCode.*/ },
  { file: /packages\/opencode\/src\/plugin\/xai\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/opencode\/src\/provider\/(?:error|provider|transform)\.ts$/, line: /.*(?:opencode|OpenCode).*/ },
  { file: /packages\/opencode\/src\/server\/(?:proxy-util|shared\/.*)\.ts$/, line: /.*opencode.*/ },
  { file: /packages\/opencode\/src\/server\/routes\/instance\/httpapi\/.*\.ts$/, line: /.*(?:opencode|OpenCode).*/ },
  { file: /packages\/opencode\/src\/session\/retry\.ts$/, line: /.*OpenCode.*/ },
  { file: /packages\/desktop\/src\/main\/.*\.test\.ts$/, line: /.*(?:opencode|OpenCode).*/ },
  { file: /packages\/desktop\/src\/renderer\/(?:html|window-state)\.test\.ts$/, line: /.*(?:opencode|OpenCode).*/ },
  { file: /packages\/opencode\/src\/server\/mdns\.ts$/, line: /.*(?:opencode\.local|opencode-\$\{port\}).*/ },
  { file: /packages\/opencode\/src\/tool\/webfetch\.ts$/, line: /.*User-Agent.*opencode.*/ },
]
const auditedScopes = [
  ".openctrlc/",
  "packages/core/src/",
  "packages/opencode/src/",
  "packages/app/src/",
  "packages/desktop/src/",
  "packages/web/src/content/docs/",
  "packages/core/src/plugin/skill/",
  "packages/console/app/src/i18n/",
  "packages/console/support/src/",
]

export function scanText(source: string, file: string, strictExternal = false) {
  const mismatch = [...source.matchAll(/\[([^\]]*(?:opencode\.ai|openctrlc\.ai)[^\]]*)\]\(/gi)].some((match) => {
    const label = match[1].toLowerCase()
    const parsed = parseInlineLink(source, (match.index ?? 0) + match[0].length)
    if (!parsed) return true
    const hostname = URL.canParse(parsed.href) ? new URL(parsed.href).hostname : undefined
    if (!hostname) return true
    return (
      (label.includes("opencode.ai") && !isAllowedWebHostname(hostname, "opencode.ai")) ||
      (label.includes("openctrlc.ai") && !isAllowedWebHostname(hostname, "openctrlc.ai"))
    )
  })
  if (mismatch) return [`${file}:1:external-link-mismatch`]
  return source.split("\n").flatMap((line, index) => {
    const matches = [...line.matchAll(productTokens)]
    const contractRanges = strictExternal ? findContractRanges(line, file) : []
    const externalRanges = [...externalTokens, ...(strictExternal ? [] : [externalContext])].flatMap((pattern) =>
      [...line.matchAll(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`))].map((match) => [
        match.index ?? 0,
        (match.index ?? 0) + match[0].length,
      ]),
    )
    externalRanges.push(...contractRanges)
    return matches
      .filter((match) => !isAllowedExternalMatch(line, match.index ?? 0, match[0], externalRanges))
      .map((match) => `${file}:${index + 1}:${match[0]}`)
  })
}

export function scanProductSource(source: string, file: string) {
  const violations = scanText(source, file, true)
  violations.push(...findBareUrlMismatches(source, file))
  if (/^packages\/app\/src\/i18n\/[^/]+\.ts$/.test(file)) {
    return [...new Set(violations)].filter((violation) => !isAllowedAppI18nViolation(violation, source, file))
  }
  if (file === "packages/opencode/src/server/mdns.ts") {
    violations.push(
      ...source
        .split("\n")
        .flatMap((line, index) =>
          [...line.matchAll(/opencode\.local|opencode-\$\{port\}/g)].map((match) => `${file}:${index + 1}:${match[0]}`),
        ),
    )
  }
  if (file === "packages/opencode/src/tool/webfetch.ts") {
    violations.push(
      ...source
        .split("\n")
        .flatMap((line, index) =>
          [...line.matchAll(/["'`]User-Agent["'`]\s*:\s*["'`]opencode(?:\/[^"'`]+)?["'`]/g)].map(
            (match) => `${file}:${index + 1}:${match[0]}`,
          ),
        ),
    )
  }
  if (file === "packages/core/src/oauth/page.ts") {
    violations.push(
      ...source
        .split("\n")
        .flatMap((line, index) => [...line.matchAll(/OpenCode/g)].map((match) => `${file}:${index + 1}:${match[0]}`)),
    )
  }
  return [...new Set(violations)]
}

function isAllowedAppI18nViolation(violation: string, source: string, file: string) {
  if (!/^packages\/app\/src\/i18n\/[^/]+\.ts$/.test(file)) return false
  const line = Number(violation.match(/:(\d+):/)?.[1])
  const lines = source.split("\n")
  return /"(?:dialog\.provider\.opencode|provider\.connect\.opencodeZen)[^"]*"\s*:/.test(lines[line - 2] ?? "")
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
      if (
        ignored.has(file) ||
        !auditedScopes.some((scope) => file.startsWith(scope)) ||
        !/\.(md|mdx|ts|tsx|json|jsonc)$/.test(file)
      )
        return []
      if (
        file.startsWith("packages/core/src/") ||
        file.startsWith("packages/opencode/src/") ||
        file.startsWith("packages/app/src/") ||
        file.startsWith("packages/desktop/src/")
      ) {
        return scanProductSource(await Bun.file(path.join(root, file)).text(), file)
      }
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

function findContractRanges(line: string, file: string) {
  const tokenMatches = [...line.matchAll(productTokens)]
  return productContractAllowlist
    .filter((rule) => rule.file.test(file))
    .flatMap((rule) =>
      [...line.matchAll(new RegExp(rule.line.source, `${rule.line.flags.replace("g", "")}g`))].flatMap((match) => {
        const start = match.index ?? 0
        return [...line.slice(start, start + match[0].length).matchAll(productTokens)].flatMap((tokenMatch) => {
          const token = tokenMatch[0]
          if (!isContractToken(line, start + (tokenMatch.index ?? 0), token, tokenMatches.length)) return []
          const tokenStart = start + (tokenMatch.index ?? 0)
          return [[tokenStart, tokenStart + token.length]]
        })
      }),
    )
}

function isContractToken(line: string, offset: number, token: string, tokenCount: number) {
  if (token.startsWith("@opencode-ai/") || token.startsWith("OPENCODE_") || token.startsWith(".opencode")) return true
  if (token === "opencode.json" || token === "opencode.jsonc") return true
  if (token === "opencode-go") return /["'`]opencode-go["'`]|opencode-go\//.test(line)
  if (token === "OpenCode") {
    return (
      /OpenCode\s+Zen/.test(line) ||
      (tokenCount === 1 && !isAppI18nFile(line) && !/https?:\/\/[^\s)`"]*opencode(?:\.ai|\/)/.test(line)) ||
      /@opencode-ai\//.test(line) ||
      /(?:dialog\.provider\.opencode|provider\.connect\.opencodeZen)/.test(line) ||
      /provider:\s*\{[^\n]*name:\s*["'`]OpenCode["'`]/.test(line)
    )
  }
  if (token !== "opencode") return false
  if (tokenCount === 1) return true
  if (/customize-opencode/.test(line) || /opencode["'`)]/.test(line) || /opencode session/.test(line)) return true
  if (/https?:\/\/[^\s)`"]*opencode(?:\.ai|\/)/.test(line)) return true
  const before = line.slice(Math.max(0, offset - 80), offset)
  const after = line.slice(offset + token.length, offset + token.length + 80)
  return (
    /(?:User-Agent|X-Title|X-Source|X-BILLING|originator|providerID|provider\.id|Integration|provider|id)\s*[^\n]*["'`]opencode["'`]/.test(
      line,
    ) ||
    /["'`]opencode["'`]|opencode\//.test(before + token + after)
  )
}

function isAppI18nFile(line: string) {
  return line.includes("provider.connect.opencodeZen") || line.includes("dialog.provider.opencode")
}

function fileIsHistoricalTool(line: string, token: string) {
  return token === "opencode" && /const repo = "opencode"/.test(line)
}

function isAllowedWebHostname(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

function findBareUrlMismatches(source: string, file: string) {
  return source.split("\n").flatMap((line, index) =>
    [...line.matchAll(/https?:\/\/[^\s)`"'<>]+/gi)].flatMap((match) => {
      const href = match[0]
      if (!href.toLowerCase().includes("opencode.ai")) return []
      if (!URL.canParse(href)) return `${file}:${index + 1}:external-url-mismatch`
      const hostname = new URL(href).hostname.toLowerCase()
      if (hostname === "opencode.ai" || hostname.endsWith(".opencode.ai")) return []
      return `${file}:${index + 1}:external-url-mismatch`
    }),
  )
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

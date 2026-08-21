import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const tracked = (await Bun.$`git ls-files -z`.cwd(root).text()).split("\0").filter(Boolean)
const ignored = new Set([
  "script/check-namespace.ts",
  "packages/sdk/openapi.json",
  ...tracked.filter((file) => file.startsWith("packages/app/vendor/") || file.startsWith("packages/client/src/generated/") || file.startsWith("packages/client/src/generated-effect/") || file.startsWith("packages/sdk/js/src/gen/") || file.startsWith("packages/sdk/js/src/v2/gen/")),
])
const scopes = [".openctrlc/", "packages/web/src/content/docs/", "packages/core/src/plugin/skill/", "packages/console/app/src/i18n/", "packages/console/support/src/"]
const productTokens = /OpenCode|opencode|OPENCODE_|\.opencode|opencode\.jsonc?|opencode\.json|@opencode-ai\/(?:app|cli|codemode|console-app|console-core|console-function|console-mail|console-resource|console-support|core|desktop|effect-drizzle-sqlite|effect-sqlite-node|enterprise|function|http-recorder|httpapi-codegen|llm|plugin|protocol|schema|script|sdk-next|server|session-ui|slack|stats-app|stats-core|stats-server|storybook|tui|ui|web)\b/
const external = [/https?:\/\/[^\s)`"]*opencode\.ai[^\s)`"]*/, /https?:\/\/[^\s)`"]*anomalyco\/opencode[^\s)`"]*/, /anomalyco\/opencode/, /@opencode-ai\/(?:sdk|plugin|client)\b/, /opencode-(?:agent|go|google-antigravity-auth|gitlab-auth|poe-auth|helicone-session|wakatime|gitlab-plugin)\b/, /opencode\/[A-Za-z0-9._-]+/, /\.well-known\/opencode/, /OPENCODE_API_KEY/, /OPENCODE_AUTH_JSON/, /GITLAB_TOKEN_OPENCODE/, /opencode-config/, /sst-dev/, /security@anoma\.ly/, /models\.dev/]
const violations: string[] = []

for (const file of tracked) {
  if (ignored.has(file) || !scopes.some((scope) => file.startsWith(scope)) || !/\.(md|mdx|ts|tsx|json|jsonc)$/.test(file)) continue
  const source = await Bun.file(path.join(root, file)).text()
  source.split("\n").forEach((line, index) => {
    if (!productTokens.test(line)) return
    productTokens.lastIndex = 0
    if (external.some((pattern) => pattern.test(line))) return
    if (file.startsWith("packages/web/src/content/docs/")) return
    if (file.startsWith(".openctrlc/tool/") && /const repo = "opencode"/.test(line)) return
    violations.push(`${file}:${index + 1}:${line}`)
  })
}

if (violations.length) {
  console.error(violations.join("\n"))
  process.exit(1)
}

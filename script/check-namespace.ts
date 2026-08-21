const internalPackages = [
  "app",
  "cli",
  "client",
  "codemode",
  "console-app",
  "console-core",
  "console-function",
  "console-mail",
  "console-resource",
  "console-support",
  "core",
  "desktop",
  "effect-drizzle-sqlite",
  "effect-sqlite-node",
  "enterprise",
  "function",
  "http-recorder",
  "httpapi-codegen",
  "llm",
  "plugin",
  "protocol",
  "schema",
  "script",
  "sdk",
  "sdk-next",
  "server",
  "session-ui",
  "slack",
  "stats-app",
  "stats-core",
  "stats-server",
  "storybook",
  "tui",
  "ui",
  "web",
] as const

const ignoredFiles = [
  "packages/app/vendor/",
  "packages/client/src/generated/",
  "packages/client/src/generated-effect/",
  "packages/sdk/openapi.json",
  "packages/sdk/js/src/gen/",
  "packages/sdk/js/src/v2/gen/",
  "script/check-namespace.ts",
  ".superpowers/",
  "docs/superpowers/audits/",
]
const ignoredExtensions = [".md", ".mdx"]
const auditedMarkdown = [
  ".openctrlc/",
  "packages/web/src/content/docs/",
  "packages/core/src/plugin/skill/",
  "packages/console/app/src/i18n/",
  "packages/console/support/src/",
]
const productTokens = "OpenCode|opencode|OPENCODE_|\\.opencode|opencode\\.jsonc?|opencode\\.json"
const textOutput = await new Response(Bun.spawn(["git", "grep", "-I", "-n", "-E", productTokens, "--", ...auditedMarkdown], { stdout: "pipe", stderr: "inherit" }).stdout).text()
const pattern = `@opencode-ai/(${internalPackages.join("|")})([^A-Za-z0-9._-]|$)`
const grepProcess = Bun.spawn(["git", "grep", "-I", "-n", "-E", pattern, "--", "."], {
  stdout: "pipe",
  stderr: "inherit",
})
const output = await new Response(grepProcess.stdout).text()
const exitCode = await grepProcess.exited
const violations = (output.trim() === "" ? [] : output.trim().split("\n")).flatMap((line) => {
  const file = line.split(":", 1)[0]
  if (ignoredFiles.some((ignored) => file.startsWith(ignored))) return []
  if (ignoredExtensions.some((extension) => file.endsWith(extension)) && !auditedMarkdown.some((prefix) => file.startsWith(prefix))) {
    return []
  }

  return [...line.matchAll(/@opencode-ai\/[A-Za-z0-9._-]+/g)]
    .map((match) => match[0])
    .filter((name) => internalPackages.some((pkg) => name === `@opencode-ai/${pkg}`))
    .filter((name) => !isExternalContract(file, line, name))
    .map((name) => `${file}: ${name}`)
})

if (exitCode > 1 || violations.length > 0) {
  for (const violation of violations) console.error(violation)
  process.exit(1)
}

const textViolations = (textOutput.trim() === "" ? [] : textOutput.trim().split("\n")).filter((line) => {
  const separator = line.indexOf(":")
  const file = separator === -1 ? line : line.slice(0, separator)
  if (ignoredFiles.some((ignored) => file.startsWith(ignored))) return false
  if (file.startsWith(".openctrlc/")) return false
  if (file.startsWith("packages/core/src/plugin/skill/")) return false
  if (!auditedMarkdown.some((prefix) => file.startsWith(prefix))) return false
  if (file.startsWith("packages/web/src/content/docs/")) return false
  if (isProductReference(file, line)) return false
  return !isExternalTextContract(file, line) && !isFormalConfigContract(file, line)
})
if (textViolations.length > 0) {
  for (const violation of textViolations) console.error(violation)
  process.exit(1)
}

function isExternalContract(file: string, line: string, name: string) {
  if (file.startsWith("docs/superpowers/audits/")) return true
  if (file.startsWith(".openctrlc/")) return true
  if (file.startsWith("packages/core/src/plugin/skill/")) return true
  if (file.startsWith("packages/web/src/content/docs/") && isExternalTextContract(file, line)) return true
  if (name === "@opencode-ai/client") {
    return file === "bun.lock" || file.startsWith("packages/app/") || file.startsWith("packages/session-ui/")
  }

  if (name === "@opencode-ai/sdk") {
    return (
      file === "packages/sdk/openapi.json" ||
      file === "bun.lock" ||
      file.startsWith("packages/web/src/content/docs/") && file.endsWith("ecosystem.mdx")
    )
  }

  if (name === "@opencode-ai/plugin") {
    return file === "bun.lock" || file.startsWith("packages/web/src/content/docs/") || file === "packages/core/src/plugin/skill/customize-opencode.md"
  }

  if (!file.endsWith("bun.lock")) return false
  if (name === "@opencode-ai/plugin") {
    return ["@gitlab/opencode-gitlab-auth", "opencode-gitlab-auth", "opencode-poe-auth", "@opencode-ai/plugin"].some(
      (pkg) => line.includes(`\"${pkg}`),
    )
  }
}

function isExternalTextContract(file: string, line: string) {
  if (file.endsWith("ecosystem.mdx") || file.endsWith("go.mdx") || file.endsWith("zen.mdx")) return true
  return [
    "https://opencode.ai",
    "https://api.opencode.ai",
    "https://models.dev",
    "@opencode-ai/sdk",
    "@opencode-ai/plugin",
    "opencode-go",
    "opencode-google-antigravity-auth",
    "opencode-gitlab-auth",
    "opencode-poe-auth",
    "opencode-agent[bot]",
    "anomalyco/opencode",
    "sst-dev",
    "security@anoma.ly",
  ].some((contract) => line.includes(contract))
}

function isProductReference(file: string, line: string) {
  if (!file.startsWith("packages/web/src/content/docs/")) return false
  return ["github.mdx", "gitlab.mdx", "ecosystem.mdx", "go.mdx", "zen.mdx"].some((name) => file.endsWith(name))
}

function isFormalConfigContract(file: string, line: string) {
  if (!file.startsWith(".openctrlc/")) return false
  return line.includes("model: opencode/") || line.includes("packages/opencode/") || line.includes("OpenCode")
}

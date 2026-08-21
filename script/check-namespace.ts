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
]
const ignoredExtensions = [".md", ".mdx"]
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
  if (ignoredExtensions.some((extension) => file.endsWith(extension))) return []

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

function isExternalContract(file: string, line: string, name: string) {
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

  if (!file.endsWith("bun.lock")) return false
  if (name === "@opencode-ai/plugin") {
    return ["@gitlab/opencode-gitlab-auth", "opencode-gitlab-auth", "opencode-poe-auth", "@opencode-ai/plugin"].some(
      (pkg) => line.includes(`\"${pkg}`),
    )
  }
}

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

const externalAllowlist = [
  "@opencode-ai/ai",
  "@opencode-ai/docs",
  "@opencode-ai/client@",
  "@opencode-ai/plugin@",
] as const
const ignoredFiles = [
  ".opencode/",
  "packages/app/vendor/",
  "packages/client/src/generated/",
  "packages/client/src/generated-effect/",
  "packages/sdk/openapi.json",
  "packages/sdk/js/src/gen/",
  "packages/sdk/js/src/v2/gen/",
]
const ignoredExtensions = [".md", ".mdx"]
const ignoredLockfilePrefixes = ["@gitlab/opencode-gitlab-auth", "opencode-gitlab-auth", "opencode-poe-auth"]
const pattern = `@opencode-ai/(${internalPackages.join("|")})([^A-Za-z0-9._-]|$)`
const grepProcess = Bun.spawn(["git", "grep", "-I", "-n", "-E", pattern, "--", "."], {
  stdout: "pipe",
  stderr: "inherit",
})
const output = await new Response(grepProcess.stdout).text()
const exitCode = await grepProcess.exited
const violations = (output.trim() === "" ? [] : output.trim().split("\n")).filter(
  (line) => {
    const file = line.split(":", 1)[0]
    return (
      !ignoredFiles.some((ignored) => file.startsWith(ignored)) &&
      !ignoredExtensions.some((extension) => file.endsWith(extension)) &&
      !externalAllowlist.some((name) => line.includes(name)) &&
      !(file.endsWith("bun.lock") && ignoredLockfilePrefixes.some((name) => line.includes(`"${name}`)))
    )
  },
)

if (exitCode > 1 || violations.length > 0) {
  for (const violation of violations) console.error(violation)
  process.exit(1)
}

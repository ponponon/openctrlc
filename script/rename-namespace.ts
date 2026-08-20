const packageNames = [
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

const replacements = new Map(packageNames.map((name) => [`@opencode-ai/${name}`, `@openctrlc/${name}`]))
const ignoredFiles = [
  ".opencode/",
  "packages/app/vendor/",
  "packages/client/src/generated/",
  "packages/client/src/generated-effect/",
  "packages/sdk/openapi.json",
  "packages/sdk/js/src/gen/",
  "packages/sdk/js/src/v2/gen/",
]
const files = new TextDecoder()
  .decode(Bun.spawnSync(["git", "grep", "-I", "-l", "-e", "@opencode-ai/", "--", "."]).stdout)
  .split("\n")
  .filter((file) => file && !ignoredFiles.some((ignored) => file.startsWith(ignored)))

for (const file of files) {
  const original = await Bun.file(file).text()
  const updated = original.replace(/@opencode-ai\/[A-Za-z0-9._-]+/g, (name) => replacements.get(name) ?? name)
  if (updated !== original) await Bun.write(file, updated)
}

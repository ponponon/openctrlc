#!/usr/bin/env bun

import path from "node:path"
import { parse } from "yaml"

const Brand = {
  name: "OpenCtrlC",
  cli: "openctrlc",
} as const
const ProductPackageName = "openctrlc-ai"
const ProductBinaryName = "openctrlc.exe"

const root = path.resolve(import.meta.dirname, "..")
const failures: string[] = []

const read = async (relative: string) => Bun.file(path.resolve(root, relative)).text()
const json = async (relative: string) => Bun.file(path.resolve(root, relative)).json() as Promise<Record<string, unknown>>

const packageJson = await json("packages/opencode/package.json")
if (packageJson.name !== Brand.cli) failures.push(`packages/opencode/package.json must be named ${Brand.cli}`)
const bin = packageJson.bin
if (JSON.stringify(bin) !== JSON.stringify({ [Brand.cli]: `./bin/${Brand.cli}` })) {
  failures.push(`packages/opencode/package.json must expose only ${Brand.cli}`)
}

const contract = await read("packages/opencode/script/package-contract.ts")
if (!contract.includes("ProductPackageName = `${Brand.cli}-ai`")) {
  failures.push(`the product package must be ${ProductPackageName}`)
}
if (!contract.includes("ProductBinaryName = `${Brand.cli}.exe`")) {
  failures.push(`the postinstall target must be ${ProductBinaryName}`)
}

const required: Array<[string, string[]]> = [
  ["packages/opencode/script/build.ts", [`outfile: \`dist/\${name}/bin/\${Brand.cli}\``, `releaseTag(Script.channel, Script.version)`, `OPENCTRLC_VERSION`]],
  ["packages/opencode/script/postinstall.mjs", ["openctrlc-${platform}-${arch}", '"openctrlc.exe"']],
  ["packages/desktop/src/main/background-cli.ts", ["Brand.cli"]],
  ["nix/opencode.nix", ['pname = "openctrlc"', 'mainProgram = "openctrlc"']],
  ["nix/desktop.nix", ['pname = "openctrlc-desktop"', 'mainProgram = "openctrlc-desktop"']],
  [".github/workflows/publish.yml", ["name: openctrlc-cli", "name: openctrlc-desktop-"]],
  ["install", ["APP=openctrlc", "OPENCTRLC_INSTALL_DIR", "ponponon/openctrlc", "openctrlc_path", "openctrlc"]],
  ["packages/console/app/src/routes/download/[channel]/[platform].ts", ["ponponon/openctrlc", "openctrlc-linux-x64.deb", "openctrlc-linux-arm64.deb", "OpenCtrlC"]],
  ["packages/desktop/electron-builder.config.ts", ["owner: \"ponponon\"", "repo: \"openctrlc\"", "artifactName: \"openctrlc-"]],
  ["packages/opencode/script/publish.ts", ["ghcr.io/ponponon/openctrlc", "github.com/ponponon/openctrlc", "ponponon/homebrew-tap"]],
  ["nix/opencode.nix", ["OPENCTRLC_DISABLE_MODELS_FETCH"]],
  ["github/action.yml", ["https://openctrlc.quniv.cn/install", "| OPENCTRLC_INSTALL_DIR=\"$HOME/.openctrlc/bin\" bash", "run: openctrlc github run"]],
  ["github/README.md", ["openctrlc github install", "ponponon/openctrlc/github@latest", "ponponon/openctrlc/issues"]],
  ["packages/opencode/src/cli/cmd/github.handler.ts", ["ponponon/openctrlc/github@latest", "/openctrlc,/oc"]],
  ["script/version.ts", ["const repo = process.env.GH_REPO ?? \"ponponon/openctrlc\"", "const tag = Script.channel === \"beta\" ? \"beta\"", "--repo ${repo}"]],
  ["script/changelog.ts", ['const cmd = ["openctrlc", "run"]']],
  ["packages/script/src/index.ts", ["registry.npmjs.org/openctrlc-ai/latest"]],
]

const workflows = [".github/workflows/publish.yml", ".github/workflows/deploy.yml", ".github/workflows/stats.yml"]
for (const relative of workflows) {
  const source = await read(relative)
  try {
    const document = parse(source)
    if (typeof document !== "object" || document === null || typeof document.jobs !== "object") {
      failures.push(`${relative} does not contain a valid workflow document`)
    }
  } catch (error) {
    failures.push(`${relative} is not valid YAML: ${String(error)}`)
  }
}
try {
  const action = parse(await read("github/action.yml"))
  const runs = typeof action === "object" && action !== null && typeof action.runs === "object" && action.runs !== null ? action.runs as { using?: unknown; steps?: unknown } : undefined
  if (runs?.using !== "composite" || !Array.isArray(runs.steps) || runs.steps.length === 0) {
    failures.push("github/action.yml does not contain a valid action document")
  }
  for (const [index, step] of (runs?.steps ?? []).entries()) {
    if (typeof step !== "object" || step === null) {
      failures.push(`github/action.yml step ${index} is not an object`)
      continue
    }
    const item = step as { run?: unknown; uses?: unknown; shell?: unknown }
    if (typeof item.run !== "string" && typeof item.uses !== "string") failures.push(`github/action.yml step ${index} must have run or uses`)
    if (typeof item.run === "string" && typeof item.shell !== "string") failures.push(`github/action.yml run step ${index} must declare shell`)
  }
} catch (error) {
  failures.push(`github/action.yml is not valid YAML: ${String(error)}`)
}

for (const [relative, needles] of required) {
  const source = await read(relative)
  for (const needle of needles) {
    if (!source.includes(needle)) failures.push(`${relative} is missing ${needle}`)
  }
}

const generated = ["packages/client/src/generated", "packages/client/src/generated-effect"]
for (const directory of generated) {
  for await (const relative of new Bun.Glob("**/*.ts").scan({ cwd: path.join(root, directory) })) {
    const source = await read(path.relative(root, path.join(root, directory, relative)))
    if (source.includes("@opencode-ai/")) failures.push(`${path.join(directory, relative)} contains stale internal imports`)
  }
}

const forbidden = /\b(?:lildax|opencode2|opencode-cli)\b/g
const audited = [
  "packages/opencode/script",
  "packages/cli/script",
  "packages/desktop/scripts",
  ".github/workflows",
  "nix",
  "install",
]
for (const directory of audited) {
  const files = directory === "install" ? [directory] : await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: path.join(root, directory), absolute: true }))
  for (const relative of files) {
    const file = directory === "install" ? path.join(root, relative) : relative
    if (!(await Bun.file(file).exists())) continue
    const source = await Bun.file(file).text()
    if (forbidden.test(source)) failures.push(`${path.relative(root, file)} contains a forbidden product CLI name`)
    forbidden.lastIndex = 0
  }
}

const readmes = [
  ...(await Array.fromAsync(new Bun.Glob("README*.md").scan({ cwd: root, absolute: true }))),
  path.join(root, "github", "README.md"),
]
const staleReleaseGuide = /opencode-ai|opencode-desktop|opencode-bin|OPENCODE_INSTALL_DIR|\.opencode\/bin|opencode\.ai\/(?:install|download)|nix run nixpkgs#opencode|github:anomalyco\/opencode(?:\/releases|\/actions)|openctrlc-desktop-(?:mac|win|linux)-/
for (const file of readmes) {
  const source = await Bun.file(file).text()
  const installation = source.match(/### (?:Installation|安装|安裝|インストール|설치|Установка|Installasjon|Instalação|Instalación|Installazione|Εγκατάσταση|การติดตั้ง|Інсталяція)[\s\S]*?(?=### |$)/)?.[0] ?? source
  if (staleReleaseGuide.test(installation)) failures.push(`${path.relative(root, file)} contains stale product release guidance`)
  if (source.includes("img.shields.io/github/actions/workflow/status/anomalyco/opencode/")) failures.push(`${path.relative(root, file)} contains an upstream workflow badge`)
  const fenced = [...source.matchAll(/```(?:yaml|yml)\n([\s\S]*?)```/g)].map((match) => match[1])
  for (const [index, block] of fenced.entries()) {
    try {
      const parsed = parse(block)
      if (typeof parsed !== "object" || parsed === null) failures.push(`${path.relative(root, file)} fence ${index} is not a YAML object`)
    } catch (error) {
      failures.push(`${path.relative(root, file)} fence ${index} is invalid YAML: ${String(error)}`)
    }
  }
}

if (failures.length > 0) {
  console.error(["Distribution contract failed:", ...failures.map((failure) => `- ${failure}`)].join("\n"))
  process.exit(1)
}

console.log(`Distribution contract passed for ${Brand.name} (${Brand.cli})`)

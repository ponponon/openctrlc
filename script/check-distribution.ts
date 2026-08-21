#!/usr/bin/env bun

import path from "node:path"

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
  ["packages/opencode/script/build.ts", [`outfile: \`dist/\${name}/bin/\${Brand.cli}\``, `OPENCTRLC_VERSION`]],
  ["packages/opencode/script/postinstall.mjs", ["openctrlc-${platform}-${arch}", '"openctrlc.exe"']],
  ["packages/desktop/src/main/background-cli.ts", ["Brand.cli"]],
  ["nix/opencode.nix", ['pname = "openctrlc"', 'mainProgram = "openctrlc"']],
  ["nix/desktop.nix", ['pname = "openctrlc-desktop"', 'mainProgram = "openctrlc-desktop"']],
  [".github/workflows/publish.yml", ["name: openctrlc-cli", "name: openctrlc-desktop-"]],
  ["install", ["APP=openctrlc", "OPENCTRLC_INSTALL_DIR", "ponponon/openctrlc", "command -v openctrlc", "openctrlc"]],
  ["packages/console/app/src/routes/download/[channel]/[platform].ts", ["ponponon/openctrlc", "openctrlc-linux-x64.deb", "openctrlc-linux-arm64.deb", "OpenCtrlC"]],
  ["packages/desktop/electron-builder.config.ts", ["owner: \"ponponon\"", "repo: \"openctrlc\"", "artifactName: \"openctrlc-"]],
  ["packages/opencode/script/publish.ts", ["ghcr.io/ponponon/openctrlc", "github.com/ponponon/openctrlc", "ponponon/homebrew-tap"]],
  ["nix/opencode.nix", ["OPENCTRLC_DISABLE_MODELS_FETCH"]],
]

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

if (failures.length > 0) {
  console.error(["Distribution contract failed:", ...failures.map((failure) => `- ${failure}`)].join("\n"))
  process.exit(1)
}

console.log(`Distribution contract passed for ${Brand.name} (${Brand.cli})`)

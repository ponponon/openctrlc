import { expect, test } from "bun:test"
import path from "node:path"

const opencodeRoot = path.resolve(import.meta.dir, "../..")
const workspaceRoot = path.resolve(opencodeRoot, "../..")

test("product CLI package manifests expose only openctrlc", async () => {
  const opencodePackage = await Bun.file(path.join(opencodeRoot, "package.json")).json()
  const cliPackage = await Bun.file(path.join(workspaceRoot, "packages/cli/package.json")).json()

  expect(opencodePackage.bin).toEqual({ openctrlc: "./bin/openctrlc" })
  expect(cliPackage.bin).toEqual({ openctrlc: "./bin/openctrlc.cjs" })
})

test("CLI wrappers use the OpenCtrlC binary override", async () => {
  const wrapperSources = await Promise.all([
    Bun.file(path.join(opencodeRoot, "bin/openctrlc")).text(),
    Bun.file(path.join(workspaceRoot, "packages/cli/bin/openctrlc.cjs")).text(),
  ])

  for (const source of wrapperSources) {
    expect(source).toContain("process.env.OPENCTRLC_BIN_PATH")
    expect(source).not.toContain("process.env.OPENCODE_BIN_PATH")
  }
})

test("the yargs parser uses the product CLI name", async () => {
  const child = Bun.spawn(["bun", "run", "--conditions=browser", "src/index.ts", "--help"], {
    cwd: opencodeRoot,
    env: { ...process.env, OPENCTRLC_PURE: "1" },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])

  expect(exitCode).toBe(0)
  expect(stderr).toContain("openctrlc")
  expect(stderr).not.toContain("opencode --help")
})

test("the built current-platform binary responds to --version", async () => {
  const target = `${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`
  const binary = path.join(
    opencodeRoot,
    "dist",
    `openctrlc-${target}`,
    "bin",
    process.platform === "win32" ? "openctrlc.exe" : "openctrlc",
  )
  const child = Bun.spawn([binary, "--version"], { stdout: "pipe", stderr: "pipe" })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])

  expect(exitCode).toBe(0)
  expect(`${stdout}${stderr}`.trim()).not.toBe("")
})

test("the built current-platform binary serves both help contracts", async () => {
  const target = `${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`
  const binary = path.join(
    opencodeRoot,
    "dist",
    `openctrlc-${target}`,
    "bin",
    process.platform === "win32" ? "openctrlc.exe" : "openctrlc",
  )

  for (const args of [["--help"], ["serve", "--help"]]) {
    const child = Bun.spawn([binary, ...args], { stdout: "pipe", stderr: "pipe" })
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    const output = `${stdout}${stderr}`

    expect(exitCode).toBe(0)
    expect(output).toContain("openctrlc")
    expect(output).not.toContain("opencode --")
  }
})

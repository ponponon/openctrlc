import { expect, test } from "bun:test"
import { parse } from "yaml"

const root = import.meta.dirname.replace(/\/script$/, "")
const read = (relative: string) => Bun.file(`${root}/${relative}`).text()

type Workflow = {
  on?: { push?: unknown; workflow_dispatch?: unknown }
  jobs?: Record<
    string,
    { "runs-on"?: unknown; needs?: unknown; if?: string; strategy?: unknown; steps?: Array<Record<string, unknown>> }
  >
}

test("GitHub release workflow is manual and publishes CLI plus Desktop", async () => {
  const source = await read(".github/workflows/publish.yml")
  const workflow = parse(source) as Workflow

  expect(workflow.on?.push).toBeUndefined()
  expect(workflow.on?.workflow_dispatch).toBeDefined()
  expect(Object.keys(workflow.jobs ?? {})).toEqual([
    "version",
    "ensure-tag",
    "build-cli",
    "sign-cli-macos",
    "check-desktop-icons",
    "build-desktop-macos",
    "build-desktop-windows",
    "build-desktop-linux",
    "publish",
    "sync-downloads",
  ])

  for (const name of ["version", "ensure-tag", "build-cli", "publish"]) {
    expect(workflow.jobs?.[name]?.["runs-on"]).toBe("ubuntu-24.04")
  }
  expect(workflow.jobs?.["build-desktop-macos"]?.["runs-on"]).toBe("macos-14")
  expect(workflow.jobs?.["sign-cli-macos"]?.["runs-on"]).toBe("macos-14")

  for (const name of ["build-desktop-windows", "build-desktop-linux"]) {
    expect(workflow.jobs?.[name]?.strategy).toEqual({
      "fail-fast": false,
      matrix: { arch: ["x64", "arm64"] },
    })
  }

  const lower = source.toLowerCase()
  for (const forbidden of [
    "blacksmith",
    "docker",
    "aur",
    "homebrew",
    "script/publish.ts",
    "npm publish",
    "sign-cli-windows",
    "build-electron",
  ]) {
    expect(lower).not.toContain(forbidden)
  }

  const build = workflow.jobs?.["build-cli"]
  const buildSource = JSON.stringify(build?.steps ?? [])
  expect(buildSource).toContain("packages/opencode/script/build.ts")
  expect(buildSource).not.toContain("packages/cli/script/build.ts")
  expect(buildSource).toContain("OPENCTRLC_RELEASE")
  expect(buildSource).toContain("actions/upload-artifact")
  expect(buildSource).toContain("packages/opencode/dist/*.zip")
  expect(buildSource).toContain("packages/opencode/dist/*.tar.gz")

  const ensureTag = workflow.jobs?.["ensure-tag"]
  expect(ensureTag?.needs).toEqual("version")
  expect(ensureTag?.["runs-on"]).toBe("ubuntu-24.04")
  const ensureTagSource = JSON.stringify(ensureTag?.steps ?? [])
  expect(ensureTagSource).toContain("git fetch origin --tags --force")
  expect(ensureTagSource).toContain("git rev-parse")
  expect(ensureTagSource).toContain("git tag -a")
  expect(ensureTagSource).toContain("git push origin")
  expect(ensureTagSource).toContain("TARGET")
  expect(ensureTagSource).toContain("git config user.name")
  expect(ensureTagSource).toContain("github-actions[bot]")
  expect(ensureTagSource).toContain("gh release view")
  expect(ensureTagSource).toContain("git push --force origin")

  const publish = workflow.jobs?.publish
  const publishSource = JSON.stringify(publish?.steps ?? [])
  expect(publishSource).toContain("actions/download-artifact")
  expect(publishSource).toContain("gh release upload")
  expect(publishSource).toContain("needs.version.outputs.tag")
  expect(publishSource).toContain("needs.version.outputs.repo")

  const versionSource = JSON.stringify(workflow.jobs?.version?.steps ?? [])
  expect(versionSource).toContain("Make source CLI available")
  expect(versionSource).toContain("OPENCTRLC_CHANGELOG_MODE")

  const desktopSource = JSON.stringify(workflow.jobs?.["build-desktop-macos"]?.steps ?? [])
  expect(desktopSource).toContain("NODE_OPTIONS")
  expect(desktopSource).toContain("--publish never")

  const windowsSource = JSON.stringify(workflow.jobs?.["build-desktop-windows"]?.steps ?? [])
  expect(windowsSource).toContain("--${{ matrix.arch }}")
  expect(windowsSource).toContain("openctrlc-win-${{ matrix.arch }}.exe")

  const linuxSource = (workflow.jobs?.["build-desktop-linux"]?.steps ?? [])
    .map((step) => (typeof step.run === "string" ? step.run : ""))
    .join("\n")
  expect(linuxSource).toContain("--${{ matrix.arch }}")
  expect(linuxSource).toContain("openctrlc-linux-${{ matrix.arch }}")
  expect(linuxSource).toContain('[ "$source" != "$target" ]')
})

test("macOS CLI signing gates publication and replaces unsigned archives", async () => {
  const workflow = parse(await read(".github/workflows/publish.yml")) as Workflow
  const signing = workflow.jobs?.["sign-cli-macos"]
  const steps = signing?.steps ?? []
  expect(signing?.needs).toEqual(["version", "build-cli"])
  expect(signing?.if).toBe("github.repository == 'ponponon/openctrlc'")

  const certificate = steps.find((step) => step.name === "Import CLI Developer ID certificate")
  expect(certificate?.env).toEqual({
    MACOS_CERTIFICATE_BASE64: "${{ secrets.MACOS_DEVELOPER_ID_P12_BASE64 }}",
    MACOS_CERTIFICATE_PASSWORD: "${{ secrets.MACOS_DEVELOPER_ID_P12_PASSWORD }}",
  })

  const sign = steps.find((step) => step.name === "Sign and repack macOS CLI archives")
  const source = typeof sign?.run === "string" ? sign.run : ""
  expect(source).toContain("set -euo pipefail")
  expect(source).toContain("Developer ID Application")
  expect(source).toContain("for name in openctrlc-darwin-arm64 openctrlc-darwin-x64 openctrlc-darwin-x64-baseline;")
  expect(source).toContain('unzip -q "packages/opencode/dist/$name.zip"')
  expect(source).toContain("--timestamp")
  expect(source).toContain("--options runtime")
  expect(source).toContain("--entitlements packages/opencode/script/entitlements.plist")
  expect(source).toContain('codesign --verify --deep --strict --verbose=4 "$file"')
  expect(source.indexOf("zip -r")).toBeGreaterThan(source.indexOf("codesign --verify"))
  expect(source).toContain('mv "packages/opencode/dist/$name-signed.zip" "packages/opencode/dist/$name.zip"')

  const smoke = steps.findIndex((step) => step.name === "Smoke test signed CLI on the runner architecture")
  const artifact = steps.findIndex((step) => JSON.stringify(step.with ?? {}).includes("openctrlc-cli-signed-macos"))
  expect(smoke).toBeGreaterThan(steps.indexOf(sign!))
  expect(artifact).toBeGreaterThan(smoke)
  expect(steps[artifact].with).toEqual({
    name: "openctrlc-cli-signed-macos",
    path:
      "packages/opencode/dist/openctrlc-darwin-arm64.zip\n" +
      "packages/opencode/dist/openctrlc-darwin-x64.zip\n" +
      "packages/opencode/dist/openctrlc-darwin-x64-baseline.zip\n",
    "if-no-files-found": "error",
  })

  const cleanup = steps.find((step) => step.name === "Remove temporary CLI signing credentials")
  expect(cleanup?.if).toBe("always()")
  expect(cleanup?.run).toContain('security delete-keychain "$RUNNER_TEMP/openctrlc-cli.keychain-db"')
  expect(cleanup?.run).toContain('rm -f "$RUNNER_TEMP/openctrlc-cli-developer-id.p12"')

  for (const step of steps) {
    if (typeof step.run !== "string") continue
    const result = Bun.spawnSync(["bash", "-n"], { stdin: Buffer.from(step.run) })
    expect(result.stderr.toString()).toBe("")
    expect(result.exitCode).toBe(0)
  }

  const publish = workflow.jobs?.publish
  expect(publish?.needs).toContain("sign-cli-macos")
  expect(publish?.if).not.toContain("always()")
  const publishing = publish?.steps ?? []
  const unsigned = publishing.findIndex((step) => JSON.stringify(step.with ?? {}).includes('"openctrlc-cli"'))
  const signed = publishing.findIndex((step) => JSON.stringify(step.with ?? {}).includes("openctrlc-cli-signed-macos"))
  const upload = publishing.findIndex((step) => step.name === "Upload CLI release assets")
  const release = publishing.findIndex((step) => step.name === "Publish GitHub Release")
  expect(unsigned).toBeGreaterThanOrEqual(0)
  expect(signed).toBeGreaterThan(unsigned)
  expect(upload).toBeGreaterThan(signed)
  expect(release).toBeGreaterThan(upload)
  expect(publishing[signed].with).toEqual({ name: "openctrlc-cli-signed-macos", path: "packages/opencode/dist" })
})

test("local macOS compilation repairs the ad-hoc signature before execution", async () => {
  const source = await read("packages/opencode/script/build.ts")
  const compile = source.indexOf("await Bun.build(")
  const signing = source.indexOf("codesign --force --sign - dist/${name}/bin/${Brand.cli}")
  const smoke = source.indexOf("// Smoke test:")
  expect(source).toContain('if (item.os === "darwin" && process.platform === "darwin")')
  expect(compile).toBeGreaterThanOrEqual(0)
  expect(signing).toBeGreaterThan(compile)
  expect(smoke).toBeGreaterThan(signing)
})

test("stable versioning reuses an existing GitHub release", async () => {
  const source = await read("script/version.ts")
  const existing = source.indexOf("gh release view ${tag} --json tagName,databaseId --repo ${repo}")
  const create = source.indexOf("gh release create ${tag}")

  expect(existing).toBeGreaterThanOrEqual(0)
  expect(create).toBeGreaterThan(existing)
  expect(source).toContain("if (existing.exitCode !== 0)")
  expect(source).toContain("const output = [`version=${Script.version}`]")
  expect(source).toContain("output.push(`release=${release.databaseId}`)")
  expect(source).toContain("output.push(`tag=${release.tagName}`)")
  expect(source).toContain("output.push(`repo=${repo}`)")
})

test("CLI release uploads use the shared release tag contract", async () => {
  const source = await read("packages/opencode/script/build.ts")

  expect(source).toContain("releaseTag(Script.channel, Script.version)")
  expect(source).toContain("gh release upload ${releaseTag(Script.channel, Script.version)}")
})

test("local tag sync persists all-tag fetch behavior", async () => {
  const source = await read("script/sync-tags")

  expect(source).toContain('git remote get-url "$remote"')
  expect(source).toContain('git config --local "remote.${remote}.tagOpt" --tags')
  expect(source).toContain('git fetch "$remote" --tags --force')
  expect(source).toContain('git rev-parse "${tag}^{commit}"')
})

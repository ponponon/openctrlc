import { expect, test } from "bun:test"
import { parse } from "yaml"

const root = import.meta.dirname.replace(/\/script$/, "")
const read = (relative: string) => Bun.file(`${root}/${relative}`).text()

test("GitHub release workflow is manual and publishes CLI plus Desktop", async () => {
  const source = await read(".github/workflows/publish.yml")
  const workflow = parse(source) as {
    on?: { push?: unknown; workflow_dispatch?: unknown }
    jobs?: Record<string, { "runs-on"?: unknown; needs?: unknown; steps?: Array<Record<string, unknown>> }>
  }

  expect(workflow.on?.push).toBeUndefined()
  expect(workflow.on?.workflow_dispatch).toBeDefined()
  expect(Object.keys(workflow.jobs ?? {})).toEqual(["version", "ensure-tag", "build-cli", "build-desktop-macos", "publish"])

  for (const name of ["version", "ensure-tag", "build-cli", "publish"]) {
    expect(workflow.jobs?.[name]?.["runs-on"]).toBe("ubuntu-24.04")
  }
  expect(workflow.jobs?.["build-desktop-macos"]?.["runs-on"]).toBe("macos-14")

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

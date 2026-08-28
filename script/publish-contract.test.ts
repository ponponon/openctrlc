import { expect, test } from "bun:test"
import { parse } from "yaml"

const root = import.meta.dirname.replace(/\/script$/, "")
const read = (relative: string) => Bun.file(`${root}/${relative}`).text()

test("GitHub release workflow is manual and CLI-only", async () => {
  const source = await read(".github/workflows/publish.yml")
  const workflow = parse(source) as {
    on?: { push?: unknown; workflow_dispatch?: unknown }
    jobs?: Record<string, { "runs-on"?: unknown; needs?: unknown; steps?: Array<Record<string, unknown>> }>
  }

  expect(workflow.on?.push).toBeUndefined()
  expect(workflow.on?.workflow_dispatch).toBeDefined()
  expect(Object.keys(workflow.jobs ?? {})).toEqual(["version", "build-cli", "publish"])

  for (const job of Object.values(workflow.jobs ?? {})) {
    expect(job["runs-on"]).toBe("ubuntu-24.04")
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

  const publish = workflow.jobs?.publish
  const publishSource = JSON.stringify(publish?.steps ?? [])
  expect(publishSource).toContain("actions/download-artifact")
  expect(publishSource).toContain("gh release upload")
  expect(publishSource).toContain("needs.version.outputs.tag")
  expect(publishSource).toContain("needs.version.outputs.repo")
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

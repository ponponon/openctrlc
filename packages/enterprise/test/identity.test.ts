import { expect, test } from "bun:test"

const read = (path: string) => Bun.file(path).text()

test("enterprise runtime and deployment contracts use OpenCtrlC environment names", async () => {
  const storage = await read("./src/core/storage.ts")
  const vite = await read("./vite.config.ts")
  const manifest = await read("./package.json")
  const infrastructure = await read("../../infra/enterprise.ts")

  for (const source of [storage, vite, manifest, infrastructure]) {
    expect(source).not.toContain("OPENCODE_STORAGE_")
    expect(source).not.toContain("OPENCODE_DEPLOYMENT_TARGET")
    expect(source).not.toContain("OPENCODE_BASE_URL")
  }

  expect(storage).toContain("OPENCTRLC_STORAGE_")
  expect(vite).toContain("OPENCTRLC_DEPLOYMENT_TARGET")
  expect(vite).toContain("OPENCTRLC_BASE_URL")
  expect(manifest).toContain("OPENCTRLC_DEPLOYMENT_TARGET=cloudflare")
  expect(infrastructure).toContain("OPENCTRLC_STORAGE_ADAPTER")
})

import { expect, test } from "bun:test"

const pkg = await Bun.file(new URL("./package.json", import.meta.url)).json()
const config = (await import("./electron.vite.config.ts")).default

test("bundles remote-relay into the main process instead of loading TypeScript sources", () => {
  expect(config.main?.build?.externalizeDeps).toMatchObject({
    exclude: expect.arrayContaining(["@openctrlc/remote-relay"]),
  })
})

test("bundles remote-relay into the preload instead of loading TypeScript sources", () => {
  expect(config.preload?.build?.externalizeDeps).toMatchObject({
    exclude: expect.arrayContaining(["@openctrlc/remote-relay"]),
  })
})

test("keeps remote-relay out of packaged runtime dependencies", () => {
  expect(pkg.dependencies).not.toHaveProperty("@openctrlc/remote-relay")
  expect(pkg.devDependencies).toHaveProperty("@openctrlc/remote-relay")
})

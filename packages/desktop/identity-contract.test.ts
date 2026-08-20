import { expect, test } from "bun:test"

const read = (path: string) => Bun.file(path).text()

test("keeps OpenCtrlC CI, artifact, and channel contracts aligned", async () => {
  const workflow = await read("../../.github/workflows/publish.yml")
  const builder = await read("./electron-builder.config.ts")
  const finalizeJson = await read("./scripts/finalize-latest-json.ts")
  const finalizeYml = await read("./scripts/finalize-latest-yml.ts")

  expect(workflow).toContain("OPENCTRLC_VERSION")
  expect(workflow).toContain("OPENCTRLC_CHANNEL")
  expect(workflow).toContain("openctrlc-preview-cli")
  expect(workflow).not.toContain("OPENCODE_VERSION")
  expect(workflow).not.toContain("OPENCODE_CHANNEL")
  expect(workflow).not.toContain("opencode-desktop")
  expect(workflow).not.toContain("opencode-cli")
  expect(builder).toContain("process.env.OPENCTRLC_CHANNEL")
  expect(builder).toContain('artifactName: "openctrlc-')
  expect(finalizeJson).toContain("process.env.OPENCTRLC_VERSION")
  expect(finalizeJson).toContain("process.env.OPENCTRLC_RELEASE")
  expect(finalizeYml).toContain("process.env.OPENCTRLC_VERSION")
})

test("keeps renderer deep links and channel declarations on OpenCtrlC names", async () => {
  const renderer = await read("./src/renderer/index.tsx")
  const rendererEnv = await read("./src/renderer/env.d.ts")
  const appDeepLinks = await read("../app/src/pages/layout/deep-links.ts")

  expect(renderer).toContain('const deepLinkEvent = "openctrlc:deep-link"')
  expect(renderer).toContain("window.__OPENCTRLC__")
  expect(renderer).toContain("import.meta.env.VITE_OPENCTRLC_CHANNEL")
  expect(rendererEnv).toContain("__OPENCTRLC__")
  expect(appDeepLinks).toContain('`${Brand.cli}:deep-link`')
  expect(appDeepLinks).toContain("Brand.urlScheme")
})

test("keeps sidecar auth, updater persistence, and WSL CLI consumers product-owned", async () => {
  const sidecar = await read("./src/main/sidecar.ts")
  const server = await read("./src/main/server.ts")
  const updater = await read("./src/main/updater.ts")
  const wslRuntime = await read("./src/main/wsl/runtime.ts")
  const wslIpc = await read("./src/main/wsl/ipc.ts")
  const preload = await read("./src/preload/index.ts")

  expect(sidecar).toContain("OPENCTRLC_SERVER_USERNAME")
  expect(sidecar).toContain("Brand.cli")
  expect(server).toContain("Buffer.from(`${Brand.cli}:${password}`)")
  expect(updater).toContain('getStore("openctrlc.updater")')
  expect(updater).not.toContain("opencode.updater")
  expect(wslRuntime).toContain("openctrlc.quniv.cn/install")
  expect(wslRuntime).toContain(".openctrlc/bin/openctrlc")
  expect(wslIpc).toContain("wsl-servers-install-openctrlc")
  expect(preload).toContain("installOpenctrlc")
  expect(preload).not.toContain("installOpencode")
})

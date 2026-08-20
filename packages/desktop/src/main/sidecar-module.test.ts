import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { SIDECAR_SERVER_MODULE } from "./sidecar-module"

test("uses one OpenCtrlC sidecar virtual module name", async () => {
  const env = await readFile(fileURLToPath(new URL("./env.d.ts", import.meta.url)), "utf8")
  const sidecar = await readFile(fileURLToPath(new URL("./sidecar.ts", import.meta.url)), "utf8")
  const vite = await readFile(fileURLToPath(new URL("../../electron.vite.config.ts", import.meta.url)), "utf8")

  expect(SIDECAR_SERVER_MODULE).toBe("virtual:openctrlc-server")
  expect(env).toContain(`declare module "${SIDECAR_SERVER_MODULE}"`)
  expect(sidecar).toContain(`import("${SIDECAR_SERVER_MODULE}")`)
  expect(vite).toContain(`id === SIDECAR_SERVER_MODULE`)
})

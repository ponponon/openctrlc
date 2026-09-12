import { afterEach, expect, test } from "bun:test"
import { chmod, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Brand } from "@openctrlc/identity"
import {
  createProductPackageManifest,
  npmPublishTag,
  ProductBinaryName,
  ProductPackageName,
  releaseTag,
} from "../../script/package-contract"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

test("the published root package manifest points to openctrlc", () => {
  const manifest = createProductPackageManifest({
    version: "1.2.3",
    license: "MIT",
    optionalDependencies: {
      "openctrlc-darwin-arm64": "1.2.3",
      "openctrlc-linux-x64-baseline": "1.2.3",
    },
  })

  expect(manifest.name).toBe(ProductPackageName)
  expect(manifest.bin).toEqual({ [Brand.cli]: `./bin/${ProductBinaryName}` })
  expect(manifest.optionalDependencies).toEqual({
    "openctrlc-darwin-arm64": "1.2.3",
    "openctrlc-linux-x64-baseline": "1.2.3",
  })
  expect(JSON.stringify(manifest)).not.toContain("opencode")
})

test("postinstall resolves and installs the openctrlc platform binary", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openctrlc-postinstall-"))
  temporaryDirectories.push(root)

  const platformPackage = "openctrlc-darwin-arm64"
  const platformDirectory = path.join(root, "node_modules", platformPackage)
  const platformBinary = path.join(platformDirectory, "bin", Brand.cli)
  await Bun.write(
    path.join(root, "package.json"),
    JSON.stringify({
      name: ProductPackageName,
      optionalDependencies: { [platformPackage]: "1.2.3" },
    }),
  )
  await Bun.write(
    path.join(platformDirectory, "package.json"),
    JSON.stringify({ name: platformPackage, version: "1.2.3" }),
  )
  await Bun.write(platformBinary, "#!/bin/sh\nexit 0\n")
  await chmod(platformBinary, 0o755)
  await Bun.write(
    path.join(root, "postinstall.mjs"),
    await Bun.file(path.join(import.meta.dir, "../../script/postinstall.mjs")).text(),
  )

  const child = Bun.spawn(["node", "postinstall.mjs"], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])

  expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" })
  expect(stderr).not.toContain("opencode")
  expect(await Bun.file(path.join(root, "bin", ProductBinaryName)).exists()).toBe(true)
})

test("postinstall source uses only the openctrlc executable contract", async () => {
  const source = await Bun.file(path.join(import.meta.dir, "../../script/postinstall.mjs")).text()

  expect(source).toContain("const base = `openctrlc-${platform}-${arch}`")
  expect(source).toContain('"openctrlc.exe"')
  expect(source).not.toContain("opencode.exe")
  expect(source).not.toContain('"opencode"')
})

test("release tags distinguish beta from stable builds", () => {
  expect(releaseTag("beta", "1.2.3")).toBe("beta")
  expect(releaseTag("latest", "1.2.3")).toBe("v1.2.3")
  expect(releaseTag("prod", "1.2.3")).toBe("v1.2.3")
})

test("npm-only publishing uses the latest tag for production releases", () => {
  expect(npmPublishTag("latest")).toBe("latest")
  expect(npmPublishTag("beta")).toBe("beta")
})

test("the root package is not an optional dependency of itself", () => {
  const manifest = createProductPackageManifest({
    version: "0.1.0",
    license: "MIT",
    optionalDependencies: {
      "openctrlc-darwin-arm64": "0.1.0",
    },
  })

  expect(manifest.optionalDependencies).not.toHaveProperty(ProductPackageName)
})

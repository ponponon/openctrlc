#!/usr/bin/env bun
import { Script } from "@openctrlc/script"
import { resolveChannel } from "./utils"

if (resolveChannel() === "prod" && !process.env.OPENCTRLC_VERSION) {
  console.warn(
    [
      "WARNING: OPENCTRLC_CHANNEL=prod without OPENCTRLC_VERSION.",
      `The build will embed ${Script.version} (derived from npm latest +1), not the intended release version.`,
      "Set OPENCTRLC_VERSION before packaging a publishable build (CI sets it automatically).",
    ].join("\n"),
  )
}

await import("./prebuild")

const pkg = await Bun.file("./package.json").json()
pkg.version = Script.version
await Bun.write("./package.json", JSON.stringify(pkg, null, 2) + "\n")
console.log(`Updated package.json version to ${Script.version}`)

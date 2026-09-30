#!/usr/bin/env bun

import { Script } from "@openctrlc/script"
import { createEmbeddedWebUIBundle } from "./embed-web-ui"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

const generated = await import("./generate.ts")
const embeddedFileMap = await createEmbeddedWebUIBundle(Script.channel)

await Bun.build({
  target: "node",
  entrypoints: ["./src/node.ts"],
  outdir: "./dist/node",
  format: "esm",
  sourcemap: "linked",
  external: ["jsonc-parser", "@lydell/node-pty"],
  define: {
    OPENCTRLC_MODELS_DEV: generated.modelsData,
    OPENCTRLC_VERSION: `'${Script.version}'`,
    OPENCTRLC_CHANNEL: `'${Script.channel}'`,
  },
  files: { "openctrlc-web-ui.gen.ts": embeddedFileMap },
})

console.log("Build complete")

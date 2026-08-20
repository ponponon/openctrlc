import { expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"

test("SDK server helpers inject OpenCtrlC config content", async () => {
  const files = [path.join(import.meta.dir, "../src/server.ts"), path.join(import.meta.dir, "../src/v2/server.ts")]
  for (const file of files) {
    const source = await fs.readFile(file, "utf8")
    expect(source).toContain("OPENCTRLC_CONFIG_CONTENT")
    expect(source).not.toContain("OPENCODE_CONFIG_CONTENT")
  }
})

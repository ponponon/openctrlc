import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { Global } from "@openctrlc/core/global"
import { Brand } from "@openctrlc/identity"

describe("global paths", () => {
  test("uses the OpenCtrlC runtime namespace", () => {
    expect(Global.Path.tmp).toBe(path.join(os.tmpdir(), Brand.runtimeDirectory))
    expect(
      Object.values(Global.Path)
        .filter((value) => value !== Global.Path.home)
        .every((value) => value.includes(Brand.runtimeDirectory)),
    ).toBe(true)
    expect(Object.values(Global.Path).every((value) => !value.includes("opencode"))).toBe(true)
    expect(Global.make().tmp).toBe(Global.Path.tmp)
  })

  test("tmp path is created on module load", async () => {
    expect((await fs.stat(Global.Path.tmp)).isDirectory()).toBe(true)
  })
})

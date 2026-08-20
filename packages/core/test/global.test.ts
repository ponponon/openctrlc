import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { Global } from "@openctrlc/core/global"
import { Database } from "@openctrlc/core/database/database"
import { Flag } from "@openctrlc/core/flag/flag"
import { Flock } from "@openctrlc/core/util/flock"
import { Brand } from "@openctrlc/identity"

describe("global paths", () => {
  test("uses the OpenCtrlC runtime namespace", () => {
    expect({
      data: Global.Path.data,
      cache: Global.Path.cache,
      config: Global.Path.config,
      state: Global.Path.state,
      tmp: Global.Path.tmp,
      log: Global.Path.log,
      repos: Global.Path.repos,
      bin: Global.Path.bin,
    }).toEqual({
      data: path.join(process.env.XDG_DATA_HOME!, Brand.runtimeDirectory),
      cache: path.join(process.env.XDG_CACHE_HOME!, Brand.runtimeDirectory),
      config: path.join(process.env.XDG_CONFIG_HOME!, Brand.runtimeDirectory),
      state: path.join(process.env.XDG_STATE_HOME!, Brand.runtimeDirectory),
      tmp: path.join(os.tmpdir(), Brand.runtimeDirectory),
      bin: path.join(process.env.XDG_CACHE_HOME!, Brand.runtimeDirectory, "bin"),
      log: path.join(process.env.XDG_DATA_HOME!, Brand.runtimeDirectory, "log"),
      repos: path.join(process.env.XDG_DATA_HOME!, Brand.runtimeDirectory, "repos"),
    })
    expect(Object.values(Global.Path).every((value) => !value.includes("opencode"))).toBe(true)
    expect(Global.make().tmp).toBe(Global.Path.tmp)
  })

  test("tmp path is created on module load", async () => {
    expect((await fs.stat(Global.Path.tmp)).isDirectory()).toBe(true)
  })

  test("downstream runtime paths stay in the OpenCtrlC namespace", async () => {
    const originalDatabase = Flag.OPENCTRLC_DB
    const originalChannelDatabase = process.env.OPENCTRLC_DISABLE_CHANNEL_DB
    Flag.OPENCTRLC_DB = undefined
    process.env.OPENCTRLC_DISABLE_CHANNEL_DB = "true"
    expect(Database.path()).toBe(path.join(Global.Path.data, `${Brand.runtimeDirectory}.db`))
    Flag.OPENCTRLC_DB = originalDatabase
    if (originalChannelDatabase === undefined) delete process.env.OPENCTRLC_DISABLE_CHANNEL_DB
    else process.env.OPENCTRLC_DISABLE_CHANNEL_DB = originalChannelDatabase

    await using lock = await Flock.acquire("global-runtime-path-test")
    const entries = await fs.readdir(path.join(Global.Path.state, "locks"))
    expect(entries.some((entry) => entry.endsWith(".lock"))).toBe(true)
  })
})

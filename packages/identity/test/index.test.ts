import { describe, expect, test } from "bun:test"
import { Brand } from "@openctrlc/identity"

describe("OpenCtrlC identity", () => {
  test("exposes the independent product namespace", () => {
    expect(Brand.name).toBe("OpenCtrlC")
    expect(Brand.cli).toBe("openctrlc")
    expect(Brand.runtimeDirectory).toBe("openctrlc")
    expect(Brand.projectDirectory).toBe(".openctrlc")
    expect(Brand.configFile).toBe("openctrlc.json")
    expect(Brand.configFileJsonc).toBe("openctrlc.jsonc")
    expect(Brand.envPrefix).toBe("OPENCTRLC_")
    expect(Brand.urlScheme).toBe("openctrlc")
    expect(Brand.desktopAppId).toBe("cn.quniv.openctrlc")
  })
})

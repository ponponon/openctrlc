import { expect, test } from "bun:test"
import type { Configuration } from "electron-builder"

const channels = [
  { channel: "dev", appId: "cn.quniv.openctrlc.dev", productName: "OpenCtrlC" },
  { channel: "beta", appId: "cn.quniv.openctrlc.beta", productName: "OpenCtrlC" },
  { channel: "prod", appId: "cn.quniv.openctrlc", productName: "OpenCtrlC" },
] as const

for (const channel of channels) {
  test(`uses one Linux desktop identity for ${channel.channel}`, async () => {
    const previous = process.env.OPENCTRLC_CHANNEL
    process.env.OPENCTRLC_CHANNEL = channel.channel

    const module = await import(`./electron-builder.config.ts?channel=${channel.channel}`)
    const config = module.default as Configuration

    if (previous === undefined) delete process.env.OPENCTRLC_CHANNEL
    else process.env.OPENCTRLC_CHANNEL = previous

    expect(config.appId).toBe(channel.appId)
    expect(config.productName).toBe(channel.productName)
    expect(config.protocols?.schemes).toEqual(["openctrlc"])
    expect(config.artifactName).toContain("openctrlc")
    expect(config.extraMetadata?.desktopName).toBe(`${channel.appId}.desktop`)
    expect(config.linux?.executableName).toBe(channel.appId)
    expect(config.linux?.desktop?.entry?.StartupWMClass).toBe(channel.appId)
    expect(config.deb?.fpm).toContainEqual(expect.stringContaining(`/usr/share/metainfo/${channel.appId}.metainfo.xml`))
    expect(config.rpm?.fpm).toContainEqual(expect.stringContaining(`/usr/share/metainfo/${channel.appId}.metainfo.xml`))
  })
}

test("bundles the CLI outside the dev app archive", async () => {
  const previous = process.env.OPENCTRLC_CHANNEL
  process.env.OPENCTRLC_CHANNEL = "dev"
  const module = await import("./electron-builder.config.ts?cli-resource")
  const config = module.default as Configuration
  if (previous === undefined) delete process.env.OPENCTRLC_CHANNEL
  else process.env.OPENCTRLC_CHANNEL = previous

  expect(config.files).toContain("!resources/openctrlc*")
  expect(config.extraResources).toContainEqual({
    from: "resources/",
    to: "",
    filter: ["openctrlc*"],
  })
})

for (const channel of ["beta", "prod"] as const) {
  test(`does not bundle the CLI in ${channel} builds`, async () => {
    const previous = process.env.OPENCTRLC_CHANNEL
    process.env.OPENCTRLC_CHANNEL = channel
    const module = await import(`./electron-builder.config.ts?no-cli-resource=${channel}`)
    const config = module.default as Configuration
    if (previous === undefined) delete process.env.OPENCTRLC_CHANNEL
    else process.env.OPENCTRLC_CHANNEL = previous

    expect(config.extraResources).not.toContainEqual({
      from: "resources/",
      to: "",
      filter: ["openctrlc*"],
    })
  })
}

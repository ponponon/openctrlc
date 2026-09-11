import { resolveChannel } from "./utils"
import { Brand } from "@openctrlc/identity"

const arg = process.argv[2]
const channel = arg === "dev" || arg === "beta" || arg === "prod" ? arg : resolveChannel()

const appId = channel === "prod" ? Brand.desktopAppId : `${Brand.desktopAppId}.${channel}`
const productName = Brand.name
const summary = `Open source AI coding agent${channel !== "prod" ? ` (${channel})` : ""}`

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>${appId}</id>

  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MIT</project_license>

  <name>${productName}</name>
  <summary>${summary}</summary>

  <developer id="cn.quniv">
    <name>OpenCtrlC</name>
  </developer>

  <description>
    <p>
      ${Brand.name} is an open source agent that helps you write and run code with any AI model.
    </p>
  </description>

  <launchable type="desktop-id">${appId}.desktop</launchable>

  <content_rating type="oars-1.1" />

  <url type="bugtracker">https://github.com/ponponon/openctrlc/issues</url>
  <url type="homepage">https://openctrlc.pages.dev</url>
  <url type="vcs-browser">https://github.com/ponponon/openctrlc</url>

  <screenshots>
    <screenshot type="default">
      <image>https://raw.githubusercontent.com/ponponon/openctrlc/dev/packages/web/src/assets/lander/screenshot.png</image>
    </screenshot>
  </screenshots>
</component>
`

await Bun.write(`resources/${appId}.metainfo.xml`, xml)
console.log(`Generated metainfo for ${channel} at resources/${appId}.metainfo.xml`)

#!/usr/bin/env bun
import { $ } from "bun"

import { downloadCliToResources, resolveChannel } from "./utils"

const channel = resolveChannel()
process.env.OPENCTRLC_CHANNEL = channel
await $`bun ./scripts/copy-icons.ts ${channel}`
await $`bun ./scripts/copy-metainfo.ts ${channel}`

await $`cd ../plugin && bun run build`
await $`cd ../opencode && bun script/build-node.ts`
if (channel === "dev") await downloadCliToResources()

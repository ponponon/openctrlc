import { $ } from "bun"
import { downloadCliToResources, resolveChannel } from "./utils"

const channel = resolveChannel()
process.env.OPENCTRLC_CHANNEL = channel

await $`bun run install-electron`

await $`bun ./scripts/copy-icons.ts ${channel}`

await $`cd ../plugin && bun run build`
await $`cd ../opencode && bun script/build-node.ts`
await downloadCliToResources()

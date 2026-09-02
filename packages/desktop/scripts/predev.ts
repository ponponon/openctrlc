import { $ } from "bun"
import { downloadCliToResources } from "./utils"

await $`bun run install-electron`

await $`bun ./scripts/copy-icons.ts ${process.env.OPENCTRLC_CHANNEL ?? "dev"}`

await $`cd ../plugin && bun run build`
await $`cd ../opencode && bun script/build-node.ts`
await downloadCliToResources()

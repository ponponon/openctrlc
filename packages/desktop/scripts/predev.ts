import { $ } from "bun"
import { stat } from "node:fs/promises"
import { join } from "node:path"
import {
  downloadCliToResources,
  getCurrentCli,
  isCliResourceCurrent,
  newestModifiedAt,
  resolveChannel,
  resolveCliVersion,
  windowsify,
} from "./utils"

const channel = resolveChannel()
process.env.OPENCTRLC_CHANNEL = channel

const force = process.env.OPENCTRLC_PREDEV_FORCE === "1"
const desktopDir = import.meta.dir + "/.."
const repoRoot = join(desktopDir, "..")

/**
 * The documented local backend port (4096) must not already be held: a stale
 * `serve` process from an earlier session keeps answering with an outdated
 * embedded UI (or the upstream OpenCode shell fallback), so remote pages load
 * a half-broken bundle while the new run silently loses the port. Fail fast
 * with the owner instead. Set OPENCTRLC_SKIP_PORT_CHECK=1 for intentional
 * listeners (e.g. the app dev backend running next to dev:desktop).
 */
async function assertDevPortFree() {
  if (process.env.OPENCTRLC_SKIP_PORT_CHECK === "1") return
  const port = Number(process.env.OPENCTRLC_DEV_PORT ?? 4096)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return
  try {
    const probe = Bun.listen({ hostname: "127.0.0.1", port, socket: { data() {} } })
    probe.stop(true)
    return
  } catch {
    // Port already in use — report the owner below.
  }
  let owner = ""
  if (process.platform !== "win32") {
    try {
      const result = await $`lsof -nP -iTCP:${String(port)} -sTCP:LISTEN`.quiet()
      owner = result.stdout.toString().trim()
    } catch {
      // lsof may be missing or exit non-zero when the owner vanished; keep going.
    }
  }
  throw new Error(
    [
      `predev: port ${port} is already in use, likely by a stale sidecar from an earlier session.`,
      "A stale serve process keeps answering with outdated or upstream-fallback UI and breaks remote pages.",
      owner ? `Current listener:\n${owner}` : "",
      `Stop that process (kill <pid>) or rerun with OPENCTRLC_SKIP_PORT_CHECK=1 if the listener is intentional.`,
    ]
      .filter(Boolean)
      .join("\n"),
  )
}

async function mtime(path: string) {
  try {
    const info = await stat(path)
    return info.isFile() ? info.mtimeMs : 0
  } catch {
    return 0
  }
}

/**
 * Desktop dev serves the renderer from Vite. The embedded web UI + node bundle
 * are only needed for the sidecar process; rebuilding them every `dev:desktop`
 * costs ~10s of full app production builds. Skip when outputs are already newer
 * than the sources that feed them. OPENCTRLC_PREDEV_FORCE=1 always rebuilds.
 */
async function shouldBuildNode() {
  if (force) return true
  const serverDist = join(repoRoot, "opencode/dist/node")
  const out = await mtime(join(serverDist, "node.js"))
  const appDist = join(repoRoot, "app/dist")
  if (!out || !(await mtime(join(appDist, "index.html")))) return true
  if ((await newestModifiedAt([appDist])) > out) return true
  const hasEmbeddedIndex = (await Array.fromAsync(new Bun.Glob("index-*.html").scan({ cwd: serverDist }))).length > 0
  if (!hasEmbeddedIndex) return true
  const sources = await newestModifiedAt([
    join(repoRoot, "opencode/src"),
    join(repoRoot, "opencode/script"),
    join(repoRoot, "core/src"),
    join(repoRoot, "schema/src"),
    join(repoRoot, "protocol/src"),
    join(repoRoot, "server/src"),
    join(repoRoot, "app/src"),
    join(repoRoot, "app/public"),
    join(repoRoot, "ui/src"),
    join(repoRoot, "identity/src"),
    join(repoRoot, "plugin/src"),
    join(repoRoot, "remote-relay/src"),
    join(repoRoot, "sdk/src"),
    join(repoRoot, "session-ui/src"),
    join(repoRoot, "llm/src"),
    join(repoRoot, "codemode/src"),
    join(repoRoot, "client/src"),
    join(repoRoot, "opencode/package.json"),
    join(repoRoot, "opencode/tsconfig.json"),
    join(repoRoot, "app/package.json"),
    join(repoRoot, "app/tsconfig.json"),
    join(repoRoot, "app/vite.config.ts"),
    join(repoRoot, "ui/package.json"),
    join(repoRoot, "ui/tsconfig.json"),
    join(repoRoot, "ui/vite.config.ts"),
    join(repoRoot, "identity/package.json"),
    join(repoRoot, "../package.json"),
    join(repoRoot, "../bun.lock"),
  ])
  return sources > out
}

async function shouldBuildPlugin() {
  if (force) return true
  if (!(await mtime(join(repoRoot, "plugin/dist/index.js")))) return true
  const out = await newestModifiedAt([join(repoRoot, "plugin/dist")])
  if (!out) return true
  return (
    (await newestModifiedAt([
      join(repoRoot, "plugin/src"),
      join(repoRoot, "sdk/src"),
      join(repoRoot, "schema/src"),
      join(repoRoot, "plugin/package.json"),
      join(repoRoot, "plugin/tsconfig.json"),
      join(repoRoot, "../bun.lock"),
    ])) > out
  )
}

async function shouldDownloadCli() {
  if (force) return true
  const binary = join(desktopDir, "resources", windowsify("openctrlc"))
  const metadataPath = join(desktopDir, "resources", "openctrlc.meta.json")
  try {
    const info = await stat(binary)
    if (!info.isFile()) return true
    if (process.platform !== "win32" && (info.mode & 0o111) === 0) return true
    const metadata: unknown = JSON.parse(await Bun.file(metadataPath).text())
    return !isCliResourceCurrent(metadata, {
      version: resolveCliVersion(Bun.env),
      target: getCurrentCli().rustTarget,
      size: info.size,
      mtimeMs: info.mtimeMs,
    })
  } catch {
    return true
  }
}

await assertDevPortFree()

await $`bun run install-electron`

await $`bun ./scripts/copy-icons.ts ${channel}`

if (await shouldBuildPlugin()) {
  await $`cd ../plugin && bun run build`
} else {
  console.log("predev: plugin build up to date, skipping")
}

if (await shouldBuildNode()) {
  await $`cd ../opencode && bun script/build-node.ts`
} else {
  console.log("predev: embedded server bundle up to date, skipping")
}

if (await shouldDownloadCli()) {
  await downloadCliToResources()
} else {
  console.log("predev: CLI binary already present, skipping download")
}

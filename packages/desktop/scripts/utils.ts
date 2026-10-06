import { $ } from "bun"
import { chmod, copyFile, mkdtemp, readdir, rename, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

export type Channel = "dev" | "beta" | "prod"

export function resolveCliVersion(env: Record<string, string | undefined>) {
  return env.OPENCTRLC_CLI_VERSION ?? "0.1.2"
}

export function isCliResourceCurrent(
  metadata: unknown,
  expected: { version: string; target: string; size: number; mtimeMs: number },
) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false
  const value = metadata as Record<string, unknown>
  return (
    value.version === expected.version &&
    value.target === expected.target &&
    value.size === expected.size &&
    value.mtimeMs === expected.mtimeMs
  )
}

export async function newestModifiedAt(paths: string[]) {
  const latest = async (path: string): Promise<number> => {
    try {
      const info = await stat(path)
      if (info.isFile()) return info.mtimeMs
      if (!info.isDirectory()) return 0
      const entries = await readdir(path, { withFileTypes: true })
      return Math.max(
        info.mtimeMs,
        ...(await Promise.all(
          entries.map((entry) => {
            const child = join(path, entry.name)
            if (entry.isDirectory()) return latest(child)
            if (entry.isFile()) return stat(child).then((value) => value.mtimeMs).catch(() => 0)
            return 0
          }),
        )),
      )
    } catch {
      return 0
    }
  }
  return Math.max(0, ...(await Promise.all(paths.map(latest))))
}

export function resolveChannel(): Channel {
  const raw = Bun.env.OPENCTRLC_CHANNEL
  if (raw === "latest") return "prod"
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
}

export const CLI_BINARIES: Array<{ rustTarget: string; package: string; os: string; cpu: string }> = [
  {
    rustTarget: "aarch64-apple-darwin",
    package: "openctrlc-darwin-arm64",
    os: "darwin",
    cpu: "arm64",
  },
  {
    rustTarget: "x86_64-apple-darwin",
    package: "openctrlc-darwin-x64-baseline",
    os: "darwin",
    cpu: "x64",
  },
  {
    rustTarget: "aarch64-pc-windows-msvc",
    package: "openctrlc-windows-arm64",
    os: "win32",
    cpu: "arm64",
  },
  {
    rustTarget: "x86_64-pc-windows-msvc",
    package: "openctrlc-windows-x64-baseline",
    os: "win32",
    cpu: "x64",
  },
  {
    rustTarget: "x86_64-unknown-linux-gnu",
    package: "openctrlc-linux-x64-baseline",
    os: "linux",
    cpu: "x64",
  },
  {
    rustTarget: "aarch64-unknown-linux-gnu",
    package: "openctrlc-linux-arm64",
    os: "linux",
    cpu: "arm64",
  },
]

export const RUST_TARGET = Bun.env.RUST_TARGET

function nativeTarget() {
  const { platform, arch } = process
  if (platform === "darwin") return arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin"
  if (platform === "win32") return arch === "arm64" ? "aarch64-pc-windows-msvc" : "x86_64-pc-windows-msvc"
  if (platform === "linux") return arch === "arm64" ? "aarch64-unknown-linux-gnu" : "x86_64-unknown-linux-gnu"
  throw new Error(`Unsupported platform: ${platform}/${arch}`)
}

export function getCurrentCli(target = RUST_TARGET ?? nativeTarget()) {
  const binaryConfig = CLI_BINARIES.find((item) => item.rustTarget === target)
  if (!binaryConfig) throw new Error(`CLI configuration not available for target '${target}'`)

  return binaryConfig
}

export async function downloadCliToResources() {
  const cli = getCurrentCli()
  const cliVersion = resolveCliVersion(Bun.env)
  const directory = await mkdtemp(join(tmpdir(), "openctrlc-cli-"))
  const dest = windowsify("resources/openctrlc")
  const metadata = "resources/openctrlc.meta.json"
  const temporaryMetadata = `${metadata}.${process.pid}.tmp`
  try {
    await $`bun install --no-save --cwd ${directory} ${`${cli.package}@${cliVersion}`} ${`--os=${cli.os}`} ${`--cpu=${cli.cpu}`}`
    await copyFile(
      join(directory, "node_modules", cli.package, "bin", cli.os === "win32" ? "openctrlc.exe" : "openctrlc"),
      dest,
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
  if (process.platform !== "win32") await chmod(dest, 0o755)
  if (process.platform === "win32" && process.env.GITHUB_ACTIONS === "true") {
    await $`pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File ../../script/sign-windows.ps1 ${dest}`
  }
  if (process.platform === "darwin") await $`codesign --force --sign - ${dest}`
  const info = await stat(dest)
  await Bun.write(
    temporaryMetadata,
    JSON.stringify({ version: cliVersion, target: cli.rustTarget, size: info.size, mtimeMs: info.mtimeMs }),
  )
  await rename(temporaryMetadata, metadata)

  console.log(`Copied ${cli.package} to ${dest}`)
}

export function windowsify(path: string) {
  if (path.endsWith(".exe")) return path
  return `${path}${process.platform === "win32" ? ".exe" : ""}`
}

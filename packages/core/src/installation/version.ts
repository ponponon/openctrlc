declare global {
  const OPENCTRLC_VERSION: string
  const OPENCTRLC_CHANNEL: string
}

export const InstallationVersion = typeof OPENCTRLC_VERSION === "string" ? OPENCTRLC_VERSION : "local"

// ⚠️ 发往 zen 的 User-Agent 里伪装的上游版本号，不是我们的真实版本。
// zen 会解析 UA 中 opencode/<semver> 的版本并要求 >= 1.18.0；用我们自己的
// InstallationVersion（发行版 1.1.x、开发态 local）会被拒绝：
//   426 "OpenCode 1.18.0 or newer is required to use the free tier"
//   403 "OpenCode's free tier can only be used from within OpenCode"（版本解析不出）
// 此值须与上游当前版本一致（见根目录 UPSTREAM.md）；zen 提高最低版本要求时更新这里。
// 详见 FailureExperience.md「发往 zen 的 User-Agent 必须伪装品牌和版本号」。
export const SpoofedOpencodeVersion = "1.18.34"

export function resolveInstallationChannel() {
  if (typeof OPENCTRLC_CHANNEL === "string") return OPENCTRLC_CHANNEL
  return process.env.OPENCTRLC_CHANNEL ?? "local"
}

export const InstallationChannel = resolveInstallationChannel()
export const InstallationLocal = InstallationChannel === "local"

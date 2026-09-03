declare global {
  const OPENCTRLC_VERSION: string
  const OPENCTRLC_CHANNEL: string
}

export const InstallationVersion = typeof OPENCTRLC_VERSION === "string" ? OPENCTRLC_VERSION : "local"

export function resolveInstallationChannel() {
  if (typeof OPENCTRLC_CHANNEL === "string") return OPENCTRLC_CHANNEL
  return process.env.OPENCTRLC_CHANNEL ?? "local"
}

export const InstallationChannel = resolveInstallationChannel()
export const InstallationLocal = InstallationChannel === "local"

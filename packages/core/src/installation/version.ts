declare global {
  const OPENCTRLC_VERSION: string
  const OPENCTRLC_CHANNEL: string
}

export const InstallationVersion = typeof OPENCTRLC_VERSION === "string" ? OPENCTRLC_VERSION : "local"
export const InstallationChannel = typeof OPENCTRLC_CHANNEL === "string" ? OPENCTRLC_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"

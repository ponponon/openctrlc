type NetworkInformation = {
  saveData?: boolean
  effectiveType?: string
}

/** Metered or slow link — prefer placeholders over eager media. */
export function isLiteNetwork() {
  const info = (navigator as Navigator & { connection?: NetworkInformation }).connection
  if (!info) return false
  return (
    info.saveData === true ||
    info.effectiveType === "slow-2g" ||
    info.effectiveType === "2g" ||
    info.effectiveType === "3g"
  )
}

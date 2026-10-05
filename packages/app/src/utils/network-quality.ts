export type NetworkQuality = {
  lite: boolean
  saveData: boolean
  effectiveType?: string
}

type NetworkInformation = {
  saveData?: boolean
  effectiveType?: string
  addEventListener?: (type: "change", listener: () => void) => void
  removeEventListener?: (type: "change", listener: () => void) => void
}

function connection(): NetworkInformation | undefined {
  const nav = navigator as Navigator & { connection?: NetworkInformation }
  return nav.connection
}

/**
 * True on metered/slow links (5Mbps home uplink, 2G/3G, or browser data-saver).
 * Callers should drop non-critical prefetch and heavy previews when this is set.
 */
export function readNetworkQuality(): NetworkQuality {
  const info = connection()
  const saveData = info?.saveData === true
  const effectiveType = info?.effectiveType
  const lite = saveData || effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g"
  return { lite, saveData, effectiveType }
}

export function onNetworkQualityChange(listener: (quality: NetworkQuality) => void) {
  const info = connection()
  if (!info?.addEventListener) return () => {}
  const handler = () => listener(readNetworkQuality())
  info.addEventListener("change", handler)
  return () => info.removeEventListener?.("change", handler)
}

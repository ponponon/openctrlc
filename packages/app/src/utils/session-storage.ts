const KILOBYTE = 1024
const MEGABYTE = KILOBYTE * 1024

/**
 * Disk footprint of a Session's projected transcript: 195 KB, 748 KB, 15.8 MB.
 * Matches the units the session list already used for sizes.
 */
export function formatStorageBytes(bytes?: number) {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) return ""
  if (bytes < KILOBYTE) return `${Math.round(bytes)} B`
  if (bytes < MEGABYTE) return `${Math.round(bytes / KILOBYTE)} KB`
  return `${(bytes / MEGABYTE).toFixed(1)} MB`
}

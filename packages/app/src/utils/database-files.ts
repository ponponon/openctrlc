import type { DesktopDatabaseFile } from "@/context/platform"

export const databasePurposeOrder = ["openctrlc", "drafts", "unknown"] as const

export const databasePurposeTitle = {
  drafts: "settings.general.database.group.drafts",
  openctrlc: "settings.general.database.group.openctrlc",
  unknown: "settings.general.database.group.unknown",
} as const

export const databasePurposeDescription = {
  drafts: "settings.general.database.description.drafts",
  openctrlc: "settings.general.database.description.openctrlc",
  unknown: "settings.general.database.description.unknown",
} as const

export function groupDatabaseFiles(files: DesktopDatabaseFile[]) {
  return databasePurposeOrder.flatMap((purpose) => {
    const databases = files.filter((database) => database.purpose === purpose)
    if (databases.length === 0) return []
    return [{ purpose, databases }]
  })
}

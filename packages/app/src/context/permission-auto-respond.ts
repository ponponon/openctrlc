import { base64Decode, base64Encode } from "@openctrlc/core/util/encode"

export function acceptKey(sessionID: string, directory?: string) {
  if (!directory) return sessionID
  return `${base64Encode(directory)}/${sessionID}`
}

export function directoryAcceptKey(directory: string) {
  return `${base64Encode(directory)}/*`
}

export function autoAcceptDirectories(autoAccept: Record<string, boolean>) {
  const directories = new Set<string>()

  for (const [key, enabled] of Object.entries(autoAccept)) {
    if (!enabled) continue
    const separator = key.indexOf("/")
    if (separator <= 0) continue

    try {
      const encoded = key.slice(0, separator)
      const directory = base64Decode(encoded)
      if (base64Encode(directory) !== encoded) continue
      directories.add(directory)
    } catch {
      // Ignore legacy or malformed keys. The active directory is reconciled separately.
    }
  }

  return directories
}

function accepted(autoAccept: Record<string, boolean>, sessionID: string, directory?: string) {
  const key = acceptKey(sessionID, directory)
  return autoAccept[key] ?? autoAccept[sessionID]
}

export function isDirectoryAutoAccepting(autoAccept: Record<string, boolean>, directory: string) {
  const key = directoryAcceptKey(directory)
  return autoAccept[key] ?? true
}

export function convergeAutoAccept(
  autoAccept: Record<string, boolean>,
  sessionID: string | undefined,
  directory: string,
  enabled: boolean,
  sessions: { id: string; parentID?: string }[],
) {
  const next = { ...autoAccept, [directoryAcceptKey(directory)]: enabled }
  if (!sessionID) return next
  delete next[acceptKey(sessionID, directory)]
  delete next[sessionID]
  const lineage = sessionLineage(sessions, sessionID)
  const inherited = lineage.ids
    .slice(1)
    .map((id) => accepted(autoAccept, id, directory))
    .find((item): item is boolean => item !== undefined)
  if ((inherited !== undefined && inherited !== enabled) || (inherited === undefined && !lineage.complete)) {
    next[acceptKey(sessionID, directory)] = enabled
  }
  return next
}

function sessionLineage(session: { id: string; parentID?: string }[], sessionID: string) {
  const byID = new Map(session.map((item) => [item.id, item]))
  const seen = new Set([sessionID])
  const ids = [sessionID]

  for (const id of ids) {
    const parentID = byID.get(id)?.parentID
    if (!parentID || seen.has(parentID)) continue
    seen.add(parentID)
    ids.push(parentID)
  }

  return { ids, complete: ids.every((id) => byID.has(id)) }
}

export function autoRespondsPermission(
  autoAccept: Record<string, boolean>,
  session: { id: string; parentID?: string }[],
  permission: { sessionID: string },
  directory?: string,
) {
  const value = sessionAutoAccept(autoAccept, session, permission, directory)
  if (value !== undefined) return value
  return directory ? isDirectoryAutoAccepting(autoAccept, directory) : false
}

export function sessionAutoAccept(
  autoAccept: Record<string, boolean>,
  session: { id: string; parentID?: string }[],
  permission: { sessionID: string },
  directory?: string,
) {
  return sessionLineage(session, permission.sessionID)
    .ids.map((id) => accepted(autoAccept, id, directory))
    .find((item): item is boolean => item !== undefined)
}

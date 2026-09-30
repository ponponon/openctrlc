import type { RemoteWorkspaceSnapshot } from "@/context/platform"

const storageKey = "openctrlc.remote-workspace"
const hostNameKey = "openctrlc.remote-host-name"
const maxProjects = 128
const maxSessions = 128
const maxPathLength = 4096
const maxSessionIDLength = 200

let cachedHostName: string | undefined

export function parseRemoteWorkspaceSnapshot(value: unknown): RemoteWorkspaceSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  const input = value as Record<string, unknown>
  if (!Array.isArray(input.projects) || input.projects.length > maxProjects) return
  if (!Array.isArray(input.sessionIDs) || input.sessionIDs.length > maxSessions) return
  const projects = input.projects.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const project = item as Record<string, unknown>
    if (typeof project.worktree !== "string" || project.worktree.length > maxPathLength) return []
    return [{ worktree: project.worktree, expanded: project.expanded === true }]
  })
  if (projects.length !== input.projects.length) return
  const sessionIDs = input.sessionIDs.filter(
    (sessionID): sessionID is string =>
      typeof sessionID === "string" && sessionID.length > 0 && sessionID.length <= maxSessionIDLength,
  )
  if (sessionIDs.length !== input.sessionIDs.length) return
  if (
    input.lastProject !== undefined &&
    (typeof input.lastProject !== "string" || input.lastProject.length > maxPathLength)
  )
    return
  if (
    input.activeSessionID !== undefined &&
    (typeof input.activeSessionID !== "string" ||
      input.activeSessionID.length === 0 ||
      input.activeSessionID.length > maxSessionIDLength)
  )
    return
  if (input.hostName !== undefined && (typeof input.hostName !== "string" || input.hostName.length > 120)) return
  return {
    projects,
    ...(typeof input.lastProject === "string" ? { lastProject: input.lastProject } : {}),
    sessionIDs,
    ...(typeof input.activeSessionID === "string" ? { activeSessionID: input.activeSessionID } : {}),
    ...(typeof input.hostName === "string" ? { hostName: input.hostName } : {}),
  }
}

export function takeRemoteWorkspaceSnapshot() {
  if (typeof sessionStorage === "undefined" && typeof localStorage === "undefined") return
  let value: string | null = null
  try {
    value = sessionStorage.getItem(storageKey)
    sessionStorage.removeItem(storageKey)
  } catch {}
  // New tabs share the boot cookie with the first tab but not sessionStorage;
  // keep a localStorage fallback so they still restore the desktop workspace.
  if (!value) {
    try {
      value = localStorage.getItem(storageKey)
    } catch {}
  }
  if (!value || value.length > 64 * 1024) return
  try {
    const parsed = parseRemoteWorkspaceSnapshot(JSON.parse(value))
    const name = parsed?.hostName
    if (name) {
      cachedHostName = name
      try {
        localStorage.setItem(hostNameKey, name)
      } catch {}
    }
    const relaySession =
      readCookie("oc_active") ??
      readCookie("__Host-oc_active") ??
      (parsed?.activeSessionID ? `ses-${parsed.activeSessionID.slice(-12)}` : undefined)
    if (relaySession && name) rememberRemoteDesktop(relaySession, name)
    return parsed
  } catch {
    return
  }
}

function readCookie(name: string) {
  const hit = document.cookie.split(";").find((part) => part.trim().startsWith(`${name}=`))
  return hit?.slice(hit.indexOf("=") + 1).trim()
}

export function remoteHostName() {
  if (cachedHostName) return cachedHostName
  try {
    cachedHostName = localStorage.getItem(hostNameKey) ?? undefined
  } catch {}
  return cachedHostName
}

const desktopsKey = "openctrlc.remote-desktops"

export type RemoteDesktopRef = { sessionID: string; hostName: string }

export function rememberRemoteDesktop(sessionID: string, hostName: string | undefined) {
  if (!sessionID || !hostName) return
  try {
    const raw = localStorage.getItem(desktopsKey)
    const list: RemoteDesktopRef[] = raw ? JSON.parse(raw) : []
    const next = [{ sessionID, hostName }, ...list.filter((item) => item.sessionID !== sessionID)].slice(0, 8)
    localStorage.setItem(desktopsKey, JSON.stringify(next))
    localStorage.setItem(`${desktopsKey}.active`, sessionID)
  } catch {}
}

export function listRemoteDesktops(): RemoteDesktopRef[] {
  try {
    const raw = localStorage.getItem(desktopsKey)
    return raw ? (JSON.parse(raw) as RemoteDesktopRef[]) : []
  } catch {
    return []
  }
}

export function activeRemoteSessionID() {
  try {
    return localStorage.getItem(`${desktopsKey}.active`) ?? undefined
  } catch {
    return undefined
  }
}

/** Switch which desktop session this browser talks to; token cookies stay per-session. */
export function switchRemoteDesktop(sessionID: string) {
  document.cookie = `oc_active=${sessionID}; Path=/; Secure; SameSite=Strict; max-age=${60 * 60 * 24 * 30}`
  try {
    localStorage.setItem(`${desktopsKey}.active`, sessionID)
  } catch {}
  location.reload()
}

export function remoteWorkspaceStorageKey() {
  return storageKey
}

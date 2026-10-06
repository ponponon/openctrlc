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
  const sessionIDSet = new Set(sessionIDs)
  if (input.sessionInfo !== undefined && (!Array.isArray(input.sessionInfo) || input.sessionInfo.length > maxSessions))
    return
  const sessionInfo = (input.sessionInfo as unknown[] | undefined)?.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const info = item as Record<string, unknown>
    if (typeof info.sessionID !== "string" || !sessionIDSet.has(info.sessionID)) return []
    if (info.title !== undefined && (typeof info.title !== "string" || info.title.length > 200)) return []
    if (info.protocol !== undefined && info.protocol !== "v1" && info.protocol !== "v2") return []
    if (info.title === undefined && info.protocol === undefined) return []
    const protocol: "v1" | "v2" | undefined =
      info.protocol === "v1" || info.protocol === "v2" ? info.protocol : undefined
    return [
      {
        sessionID: info.sessionID,
        ...(typeof info.title === "string" ? { title: info.title } : {}),
        ...(protocol ? { protocol } : {}),
      },
    ]
  })
  if (sessionInfo && input.sessionInfo && sessionInfo.length !== input.sessionInfo.length) return
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
    ...(sessionInfo ? { sessionInfo } : {}),
    ...(typeof input.activeSessionID === "string" ? { activeSessionID: input.activeSessionID } : {}),
    ...(typeof input.hostName === "string" ? { hostName: input.hostName } : {}),
  }
}

export function remoteSessionProtocols(snapshot?: RemoteWorkspaceSnapshot) {
  return new Map(
    snapshot?.sessionInfo?.flatMap((item) => (item.protocol ? [[item.sessionID, item.protocol] as const] : [])) ?? [],
  )
}

export function takeRemoteWorkspaceSnapshot(sessionID?: string) {
  if (typeof sessionStorage === "undefined" && typeof localStorage === "undefined") return
  const key = remoteWorkspaceStorageKey(sessionID)
  let value: string | null = null
  try {
    value = sessionStorage.getItem(key)
    sessionStorage.removeItem(key)
  } catch {}
  // New tabs share the boot cookie with the first tab but not sessionStorage;
  // keep a localStorage fallback so they still restore the desktop workspace.
  if (!value) {
    try {
      value = localStorage.getItem(key)
    } catch {}
  }
  if (!value || value.length > 64 * 1024) return
  try {
    const parsed = parseRemoteWorkspaceSnapshot(JSON.parse(value))
    const name = parsed?.hostName
    if (name) {
      cachedHostName = name
      try {
        localStorage.setItem(remoteHostNameStorageKey(sessionID), name)
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

export function remoteHostName(sessionID = currentRemoteSessionID()) {
  if (cachedHostName) return cachedHostName
  try {
    cachedHostName = localStorage.getItem(remoteHostNameStorageKey(sessionID)) ?? undefined
  } catch {}
  return cachedHostName
}

export function currentRemoteSessionID() {
  const active = readCookie("oc_active") ?? readCookie("__Host-oc_active")
  return active && /^[A-Za-z0-9_-]{16}$/.test(active) ? active : undefined
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

export function remoteWorkspaceStorageKey(sessionID?: string) {
  return sessionID ? `${storageKey}:${sessionID}` : storageKey
}

function remoteHostNameStorageKey(sessionID?: string) {
  return sessionID ? `${hostNameKey}:${sessionID}` : hostNameKey
}

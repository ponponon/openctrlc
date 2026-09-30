import type { RemoteWorkspaceSnapshot } from "@/context/platform"

const storageKey = "openctrlc.remote-workspace"
const maxProjects = 128
const maxSessions = 128
const maxPathLength = 4096
const maxSessionIDLength = 200

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
  return {
    projects,
    ...(typeof input.lastProject === "string" ? { lastProject: input.lastProject } : {}),
    sessionIDs,
    ...(typeof input.activeSessionID === "string" ? { activeSessionID: input.activeSessionID } : {}),
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
    return parseRemoteWorkspaceSnapshot(JSON.parse(value))
  } catch {
    return
  }
}

export function remoteWorkspaceStorageKey() {
  return storageKey
}

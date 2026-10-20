export function createPromptPermissionController(input: {
  directory: () => string
  sessionID: () => string | undefined
  isAutoAccepting: (sessionID: string, directory: string) => boolean
  isAutoAcceptingDirectory: (directory: string) => boolean
  setAutoAccept: (sessionID: string | undefined, directory: string, enabled: boolean) => void
}) {
  const enabled = () => {
    const directory = input.directory()
    const sessionID = input.sessionID()
    if (!sessionID) return input.isAutoAcceptingDirectory(directory)
    return input.isAutoAccepting(sessionID, directory)
  }
  const toggle = () => input.setAutoAccept(input.sessionID(), input.directory(), !enabled())

  return { enabled, toggle }
}

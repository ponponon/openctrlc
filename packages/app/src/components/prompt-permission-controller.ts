export function createPromptPermissionController(input: {
  directory: string
  isAutoAcceptingDirectory: (directory: string) => boolean
  enableAutoAcceptDirectory: (directory: string) => void
  disableAutoAcceptDirectory: (directory: string) => void
}) {
  const enabled = () => input.isAutoAcceptingDirectory(input.directory)
  const toggle = () => {
    if (enabled()) {
      input.disableAutoAcceptDirectory(input.directory)
      return
    }
    input.enableAutoAcceptDirectory(input.directory)
  }

  return { enabled, toggle }
}

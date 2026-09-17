import type { Platform } from "@/context/platform"
import { formatServerError } from "./server-errors"
import { showToast } from "./toast"

type Translate = (key: string, vars?: Record<string, string | number>) => string

type DiagnosticPlatform = Pick<Platform, "openDebugLogs" | "exportDebugLogs">

export function showProjectReloadError(input: {
  project: string
  error: unknown
  translate: Translate
  platform: DiagnosticPlatform
  retry?: () => void
}) {
  const actions = [
    input.platform.openDebugLogs
      ? {
          label: input.translate("toast.project.reloadFailed.action.viewLogs"),
          onClick: () => {
            void input.platform.openDebugLogs?.().catch((error) => {
              console.error("Failed to open diagnostic logs", error)
              void input.platform.exportDebugLogs?.().catch(() => undefined)
            })
          },
        }
      : undefined,
    input.retry
      ? {
          label: input.translate("settings.skills.action.retry"),
          onClick: input.retry,
        }
      : undefined,
    input.platform.exportDebugLogs
      ? {
          label: input.translate("command.logs.export"),
          onClick: () => {
            void input.platform.exportDebugLogs?.().catch((error) => {
              console.error("Failed to export diagnostic logs", error)
            })
          },
        }
      : undefined,
  ].filter((action): action is { label: string; onClick: () => void } => action !== undefined)

  showToast({
    persistent: true,
    icon: "warning",
    variant: "error",
    title: input.translate("toast.project.reloadFailed.title", { project: input.project }),
    description: formatServerError(input.error, input.translate),
    actions,
  })
}

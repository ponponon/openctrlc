import type { useDialog } from "@openctrlc/ui/context/dialog"
import type { useLanguage } from "@/context/language"
import type { usePlatform } from "@/context/platform"
import type { useServerSync } from "@/context/server-sync"
import type { useTabs } from "@/context/tabs"
import type { ServerConnection } from "@/context/server"

export type OpenCodeImportDialogContext = {
  dialog: ReturnType<typeof useDialog>
  language: ReturnType<typeof useLanguage>
  openProject: (directory: string) => void
  platform: ReturnType<typeof usePlatform>
  serverKey: ServerConnection.Key
  serverSync: ReturnType<typeof useServerSync>
  tabs: ReturnType<typeof useTabs>
  touchProject: (directory: string) => void
}

export function showOpenCodeImportDialog(props: OpenCodeImportDialogContext & { directory: string }) {
  void import("@/components/dialog-import-opencode-session").then(({ DialogImportOpenCodeSession }) => {
    void props.dialog.show(() => <DialogImportOpenCodeSession {...props} />)
  })
}

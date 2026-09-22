import { app, Menu, Tray } from "electron"
import { join } from "node:path"

import { sendMenuCommand } from "./ipc"
import { nativeT } from "./native-translations"
import { setCloseToTrayEnabled, showLastFocusedWindow } from "./windows"

type DesktopTrayDeps = {
  checkForUpdates: () => void
  quit: () => void
  logger: { warn: (message: string, error?: unknown) => void }
}

let desktopTray: Tray | undefined
let rebuildDesktopTrayMenu: (() => void) | undefined

export function createDesktopTray(deps: DesktopTrayDeps) {
  if (process.platform !== "win32" || desktopTray) return

  try {
    desktopTray = new Tray(resolveTrayIconPath())
  } catch (error) {
    deps.logger.warn("failed to create desktop tray", error)
    return
  }

  const showWindow = () => {
    showLastFocusedWindow()
  }
  const runCommand = (command: string) => {
    const window = showLastFocusedWindow()
    if (window) sendMenuCommand(window, command)
  }
  const rebuild = () => {
    if (!desktopTray) return
    desktopTray.setToolTip(nativeT("desktop.menu.app"))
    desktopTray.setContextMenu(
      Menu.buildFromTemplate([
        { label: nativeT("desktop.menu.app"), click: showWindow },
        { type: "separator" },
        { label: nativeT("desktop.menu.newSession"), click: () => runCommand("session.new") },
        { label: nativeT("desktop.menu.openProject"), click: () => runCommand("project.open") },
        { label: nativeT("desktop.menu.settings"), click: () => runCommand("settings.open") },
        { label: nativeT("desktop.menu.exportLogs"), click: () => runCommand("logs.export") },
        { label: nativeT("desktop.menu.checkForUpdates"), click: deps.checkForUpdates },
        { type: "separator" },
        { label: nativeT("desktop.recovery.action.quit"), click: deps.quit },
      ]),
    )
  }

  rebuildDesktopTrayMenu = rebuild
  desktopTray.on("click", showWindow)
  desktopTray.on("double-click", showWindow)
  rebuild()
  setCloseToTrayEnabled(true)
}

export function updateDesktopTrayMenu() {
  rebuildDesktopTrayMenu?.()
}

export function destroyDesktopTray() {
  rebuildDesktopTrayMenu = undefined
  desktopTray?.destroy()
  desktopTray = undefined
  setCloseToTrayEnabled(false)
}

function resolveTrayIconPath() {
  return app.isPackaged
    ? join(process.resourcesPath, "icons", "icon.ico")
    : join(import.meta.dirname, "../../resources/icons/icon.ico")
}

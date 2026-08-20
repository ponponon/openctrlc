import { app } from "electron"
import { resolveChannel } from "./channel"

export { resolveChannel } from "./channel"

export const CHANNEL = resolveChannel(import.meta.env.VITE_OPENCTRLC_CHANNEL)

export const UPDATER_ENABLED = app.isPackaged && CHANNEL !== "dev"

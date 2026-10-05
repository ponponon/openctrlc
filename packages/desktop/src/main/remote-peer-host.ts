import { app, BrowserWindow, ipcMain } from "electron"
import { join } from "node:path"
import { isPeerRouteBytes, isPeerSignal, type PeerIceServer, type PeerRoute, type PeerSignal } from "@openctrlc/remote-relay/protocol"
import type { RemoteAccessService } from "./remote-access"

const peerIDPattern = /^[A-Za-z0-9_-]{16}$/
const maxQueuedPeerBytes = 8 * 1024 * 1024
type PeerHostEvent =
  | { type: "open"; iceServers: PeerIceServer[] }
  | { type: "close" }
  | { type: "signal"; signal: PeerSignal }
  | { type: "send"; data: string | ArrayBuffer; bytes: number }

export function registerRemotePeerHost(remoteAccess: RemoteAccessService) {
  let window: BrowserWindow | undefined
  let ready = false
  const peers = new Set<string>()
  const queued = new Map<string, PeerHostEvent[]>()
  const queuedPeerBytes = new Map<string, number>()
  let totalQueuedBytes = 0

  const clearQueued = (peerID: string) => {
    totalQueuedBytes -= queuedPeerBytes.get(peerID) ?? 0
    queuedPeerBytes.delete(peerID)
    queued.delete(peerID)
  }

  const dispatch = (peerID: string, event: PeerHostEvent) => {
    if (!window || window.isDestroyed()) return
    if (ready) {
      window.webContents.send("remote-peer:event", { ...event, peerID })
      return
    }
    const list = queued.get(peerID) ?? []
    const bytes = event.type === "send"
      ? event.bytes
      : event.type === "signal"
        ? new TextEncoder().encode(JSON.stringify(event.signal)).byteLength
        : 0
    if (list.length >= 256 || totalQueuedBytes + bytes > maxQueuedPeerBytes) {
      remoteAccess.receivePeerClosed(peerID)
      return
    }
    list.push(event)
    queued.set(peerID, list)
    queuedPeerBytes.set(peerID, (queuedPeerBytes.get(peerID) ?? 0) + bytes)
    totalQueuedBytes += bytes
  }

  const belongsToPeerWindow = (event: Electron.IpcMainEvent, peerID: unknown): peerID is string =>
    !!window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame &&
    typeof peerID === "string" && peerIDPattern.test(peerID) && peers.has(peerID)

  const onReady = (event: Electron.IpcMainEvent, peerID: unknown) => {
    if (!belongsToPeerWindow(event, peerID)) return
    remoteAccess.receivePeerReady(peerID)
  }
  const onRoute = (event: Electron.IpcMainEvent, peerID: unknown, route: unknown, bytes: unknown) => {
    if (!belongsToPeerWindow(event, peerID) || (route !== "direct" && route !== "turn") || !isPeerRouteBytes(bytes))
      return
    remoteAccess.reportPeerRoute(peerID, route as PeerRoute, bytes)
  }
  const onMessage = (event: Electron.IpcMainEvent, peerID: unknown, data: unknown) => {
    if (!belongsToPeerWindow(event, peerID)) return
    if (typeof data !== "string" && !(data instanceof ArrayBuffer)) return
    remoteAccess.receivePeerMessage(peerID, data)
  }
  const onSignal = (event: Electron.IpcMainEvent, peerID: unknown, signal: unknown) => {
    if (!belongsToPeerWindow(event, peerID) || !isPeerSignal(signal)) return
    remoteAccess.sendPeerSignal(peerID, signal)
  }
  const onClosed = (event: Electron.IpcMainEvent, peerID: unknown) => {
    if (!belongsToPeerWindow(event, peerID)) return
    peers.delete(peerID)
    clearQueued(peerID)
    remoteAccess.receivePeerClosed(peerID)
  }
  const onDrained = (event: Electron.IpcMainEvent, peerID: unknown, bytes: unknown, sent: unknown) => {
    if (!belongsToPeerWindow(event, peerID)) return
    if (typeof bytes !== "number" || typeof sent !== "boolean") return
    remoteAccess.receivePeerDrained(peerID, bytes, sent)
  }
  ipcMain.on("remote-peer:ready", onReady)
  ipcMain.on("remote-peer:route", onRoute)
  ipcMain.on("remote-peer:signal", onSignal)
  ipcMain.on("remote-peer:message", onMessage)
  ipcMain.on("remote-peer:closed", onClosed)
  ipcMain.on("remote-peer:drained", onDrained)

  remoteAccess.attachPeerTransport({
    open(peerID, iceServers) {
      if (!peerIDPattern.test(peerID)) return
      peers.add(peerID)
      if (!window || window.isDestroyed()) {
        const peerWindow = new BrowserWindow({
          width: 320,
          height: 240,
          show: false,
          webPreferences: {
            preload: join(__dirname, "../preload/remote-peer.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        })
        window = peerWindow
        dispatch(peerID, { type: "open", iceServers })
        peerWindow.on("closed", () => {
          if (window !== peerWindow) return
          ready = false
          window = undefined
          for (const id of peers) remoteAccess.receivePeerClosed(id)
          peers.clear()
          queued.clear()
          queuedPeerBytes.clear()
          totalQueuedBytes = 0
        })
        peerWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
        peerWindow.webContents.on("will-navigate", (event) => event.preventDefault())
        void peerWindow.loadFile(join(__dirname, "../renderer/peer.html")).then(() => {
          if (window !== peerWindow || peerWindow.isDestroyed()) return
          ready = true
          for (const [id, events] of queued)
            for (const item of events) peerWindow.webContents.send("remote-peer:event", { ...item, peerID: id })
          queued.clear()
          queuedPeerBytes.clear()
          totalQueuedBytes = 0
        }).catch(() => {
          if (window !== peerWindow) return
          ready = false
          window = undefined
          for (const id of peers) remoteAccess.receivePeerClosed(id)
          peers.clear()
          queued.clear()
          queuedPeerBytes.clear()
          totalQueuedBytes = 0
          if (!peerWindow.isDestroyed()) peerWindow.destroy()
        })
        return
      }
      dispatch(peerID, { type: "open", iceServers })
    },
    signal(peerID, signal) {
      if (peers.has(peerID)) dispatch(peerID, { type: "signal", signal })
    },
    send(peerID, data) {
      if (!peers.has(peerID)) return
      const bytes = typeof data === "string" ? new TextEncoder().encode(data).byteLength : data.byteLength
      dispatch(peerID, { type: "send", data, bytes })
    },
    close(peerID) {
      if (!peers.delete(peerID)) return
      clearQueued(peerID)
      dispatch(peerID, { type: "close" })
    },
  })

  app.once("will-quit", () => {
    ipcMain.removeListener("remote-peer:ready", onReady)
    ipcMain.removeListener("remote-peer:route", onRoute)
    ipcMain.removeListener("remote-peer:signal", onSignal)
    ipcMain.removeListener("remote-peer:message", onMessage)
    ipcMain.removeListener("remote-peer:closed", onClosed)
    ipcMain.removeListener("remote-peer:drained", onDrained)
    queued.clear()
    queuedPeerBytes.clear()
    totalQueuedBytes = 0
    window?.destroy()
  })
}

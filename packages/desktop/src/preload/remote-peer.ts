import { contextBridge, ipcRenderer } from "electron"
import type { PeerIceServer, PeerRoute, PeerRouteBytes, PeerSignal } from "@openctrlc/remote-relay/protocol"

type RemotePeerEvent =
  | { type: "open"; peerID: string; iceServers: PeerIceServer[] }
  | { type: "close"; peerID: string }
  | { type: "signal"; peerID: string; signal: PeerSignal }
  | { type: "send"; peerID: string; data: string | ArrayBuffer; bytes: number }

const api = {
  subscribe(callback: (event: RemotePeerEvent) => void) {
    const handler = (_: unknown, event: RemotePeerEvent) => callback(event)
    ipcRenderer.on("remote-peer:event", handler)
    return () => ipcRenderer.removeListener("remote-peer:event", handler)
  },
  ready(peerID: string) {
    ipcRenderer.send("remote-peer:ready", peerID)
  },
  route(peerID: string, route: PeerRoute, bytes: PeerRouteBytes) {
    ipcRenderer.send("remote-peer:route", peerID, route, bytes)
  },
  signal(peerID: string, signal: PeerSignal) {
    ipcRenderer.send("remote-peer:signal", peerID, signal)
  },
  send(peerID: string, data: string | ArrayBuffer) {
    ipcRenderer.send("remote-peer:message", peerID, data)
  },
  drained(peerID: string, bytes: number, sent: boolean) {
    ipcRenderer.send("remote-peer:drained", peerID, bytes, sent)
  },
  closed(peerID: string) {
    ipcRenderer.send("remote-peer:closed", peerID)
  },
}

contextBridge.exposeInMainWorld("remotePeerHost", api)

declare global {
  interface Window {
    remotePeerHost: typeof api
  }
}

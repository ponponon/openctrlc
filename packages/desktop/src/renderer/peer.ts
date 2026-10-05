import { PeerChannel } from "@openctrlc/remote-relay/peer"
import type { PeerRouteBytes, PeerSignal } from "@openctrlc/remote-relay/protocol"

const peers = new Map<string, PeerChannel>()
window.remotePeerHost.subscribe((event) => {
  if (event.type === "close") {
    peers.get(event.peerID)?.close()
    peers.delete(event.peerID)
    return
  }
  if (event.type === "signal") {
    peers.get(event.peerID)?.receiveSignal(event.signal)
    return
  }
  if (event.type === "send") {
    const peer = peers.get(event.peerID)
    if (!peer) return window.remotePeerHost.drained(event.peerID, event.bytes, false)
    void peer
      .send(typeof event.data === "string" ? event.data : new Uint8Array(event.data))
      .then((sent) => window.remotePeerHost.drained(event.peerID, event.bytes, sent))
    return
  }
  peers.get(event.peerID)?.close()
  const peer = new PeerChannel({
    offer: true,
    iceServers: event.iceServers,
    signal: (signal: PeerSignal) => window.remotePeerHost.signal(event.peerID, signal),
    message: (data) => {
      if (typeof data === "string") return window.remotePeerHost.send(event.peerID, data)
      const copy = new Uint8Array(data.byteLength)
      copy.set(data)
      window.remotePeerHost.send(event.peerID, copy.buffer)
    },
    ready: () => window.remotePeerHost.ready(event.peerID),
    route: (route, bytes: PeerRouteBytes) => window.remotePeerHost.route(event.peerID, route, bytes),
    closed: () => {
      peers.delete(event.peerID)
      window.remotePeerHost.closed(event.peerID)
    },
  })
  peers.set(event.peerID, peer)
})

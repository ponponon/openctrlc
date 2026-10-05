import { isPeerSignal, type PeerIceServer, type PeerRouteBytes, type PeerSignal } from "./protocol"

const maxMessageBytes = 2 * 1024 * 1024
const maxQueuedBytes = 4 * 1024 * 1024
const chunkBytes = 16 * 1024
export const PEER_NEGOTIATION_TIMEOUT_MS = 12_000

/** Candidate-pair payload counters are endpoint estimates, not server NIC or billing totals. */
export function selectedPeerRouteReport(stats: RTCStatsReport) {
  const reports = [...stats.values()]
  const selectedPairID = reports.find((report) => report.type === "transport")?.selectedCandidatePairId
  const pair =
    (selectedPairID ? stats.get(selectedPairID) : undefined) ??
    reports.find((report) => report.type === "candidate-pair" && report.selected === true)
  if (pair?.type !== "candidate-pair" || pair.state !== "succeeded") return
  const local = stats.get(pair.localCandidateId)
  const remote = stats.get(pair.remoteCandidateId)
  if (local?.type !== "local-candidate" || remote?.type !== "remote-candidate") return
  const counters = pair as unknown as Record<string, unknown>
  const bytesSent = Number.isSafeInteger(counters.bytesSent) && (counters.bytesSent as number) >= 0
    ? counters.bytesSent as number
    : undefined
  const bytesReceived = Number.isSafeInteger(counters.bytesReceived) && (counters.bytesReceived as number) >= 0
    ? counters.bytesReceived as number
    : undefined
  return {
    route: local.candidateType === "relay" || remote.candidateType === "relay" ? "turn" : "direct",
    pairID: pair.id,
    bytesSent,
    bytesReceived,
  } as const
}

export function selectedPeerRoute(stats: RTCStatsReport) {
  return selectedPeerRouteReport(stats)?.route
}

/** Reliable ordered transport shared by the browser and Electron's isolated preload. */
export class PeerChannel {
  #connection: RTCPeerConnection
  #channel?: RTCDataChannel
  #closed = false
  #timer: ReturnType<typeof setTimeout>
  #routeTimer?: ReturnType<typeof setInterval>
  #signals = Promise.resolve()
  #writes = Promise.resolve(true)
  #queuedBytes = 0
  #incoming?: { binary: boolean; bytes: Uint8Array; offset: number }
  #candidates: RTCIceCandidateInit[] = []
  #pairCounters = new Map<string, { bytesSent: number; bytesReceived: number }>()
  #routeBytes: PeerRouteBytes = { directBytes: 0, turnBytes: 0 }

  constructor(private readonly options: {
    offer: boolean
    signal: (signal: PeerSignal) => void
    message: (data: string | Uint8Array) => void
    ready: () => void
    closed: () => void
    route?: (route: "direct" | "turn", bytes: PeerRouteBytes) => void
    iceServers?: PeerIceServer[]
  }) {
    this.#connection = new RTCPeerConnection({
      iceServers: options.iceServers ?? [],
    })
    this.#timer = setTimeout(() => this.close(), PEER_NEGOTIATION_TIMEOUT_MS)
    this.#connection.onicecandidate = (event) => {
      if (!event.candidate || this.#closed) return
      options.signal({ type: "candidate", candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid, sdpMLineIndex: event.candidate.sdpMLineIndex })
    }
    this.#connection.onconnectionstatechange = () => {
      if (this.#connection.connectionState === "failed" || this.#connection.connectionState === "closed") this.close()
    }
    this.#connection.ondatachannel = (event) => {
      if (options.offer || this.#channel || event.channel.label !== "openctrlc-v1") {
        event.channel.close()
        return
      }
      this.#attach(event.channel)
    }
    if (!options.offer) return
    this.#attach(this.#connection.createDataChannel("openctrlc-v1", { ordered: true }))
    this.#signals = this.#connection.createOffer().then(async (description) => {
      if (this.#closed) return
      await this.#connection.setLocalDescription(description)
      options.signal({ type: "offer", sdp: description.sdp! })
    }).catch(() => this.close())
  }

  get ready() { return !this.#closed && this.#channel?.readyState === "open" }

  receiveSignal(signal: unknown) {
    if (!isPeerSignal(signal) || this.#closed) return this.close()
    this.#signals = this.#signals.then(async () => {
      if (this.#closed) return
      if (signal.type === "candidate") {
        if (!this.#connection.remoteDescription) {
          if (this.#candidates.length >= 128) return this.close()
          this.#candidates.push(signal)
          return
        }
        await this.#connection.addIceCandidate(signal)
        return
      }
      if ((this.options.offer && signal.type !== "answer") || (!this.options.offer && signal.type !== "offer"))
        return this.close()
      await this.#connection.setRemoteDescription(signal)
      for (const candidate of this.#candidates.splice(0)) await this.#connection.addIceCandidate(candidate)
      if (signal.type !== "offer") return
      const answer = await this.#connection.createAnswer()
      await this.#connection.setLocalDescription(answer)
      this.options.signal({ type: "answer", sdp: answer.sdp! })
    }).catch(() => this.close())
  }

  send(data: string | Uint8Array): Promise<boolean> {
    if (!this.ready) return Promise.resolve(false)
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data
    if (bytes.byteLength > maxMessageBytes || this.#queuedBytes + bytes.byteLength > maxQueuedBytes) {
      this.close()
      return Promise.resolve(false)
    }
    // Each message gets a length prefix; fragments stay below SCTP message limits.
    const frame = new Uint8Array(5 + bytes.byteLength)
    frame[0] = typeof data === "string" ? 0 : 1
    new DataView(frame.buffer).setUint32(1, bytes.byteLength)
    frame.set(bytes, 5)
    this.#queuedBytes += bytes.byteLength
    const write = this.#writes.then(async () => {
      for (let offset = 0; offset < frame.length; offset += chunkBytes) {
        const channel = this.#channel
        if (!channel || !this.ready) return false
        if (channel.bufferedAmount > 256 * 1024 && !await this.#drain(channel)) return false
        channel.send(frame.slice(offset, offset + chunkBytes).buffer)
      }
      return true
    }).catch(() => { this.close(); return false }).finally(() => { this.#queuedBytes -= bytes.byteLength })
    this.#writes = write
    return write
  }

  close() {
    if (this.#closed) return
    this.#closed = true
    clearTimeout(this.#timer)
    this.#incoming = undefined
    this.#candidates = []
    this.#pairCounters.clear()
    if (this.#routeTimer) clearInterval(this.#routeTimer)
    this.#routeTimer = undefined
    this.#channel?.close()
    this.#connection.close()
    this.options.closed()
  }

  #attach(channel: RTCDataChannel) {
    this.#channel = channel
    channel.binaryType = "arraybuffer"
    channel.bufferedAmountLowThreshold = 128 * 1024
    channel.onopen = () => {
      clearTimeout(this.#timer)
      this.options.ready()
      this.#reportRoute()
      this.#routeTimer = setInterval(() => this.#reportRoute(), 15_000)
    }
    channel.onclose = () => this.close()
    channel.onerror = () => this.close()
    channel.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return this.close()
      const bytes = new Uint8Array(event.data)
      if (!this.#incoming) {
        if (bytes.length < 5 || bytes[0] > 1) return this.close()
        const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(1)
        if (length > maxMessageBytes) return this.close()
        this.#incoming = { binary: bytes[0] === 1, bytes: new Uint8Array(length), offset: 0 }
        this.#append(bytes.subarray(5))
        return
      }
      this.#append(bytes)
    }
  }

  #append(bytes: Uint8Array) {
    const incoming = this.#incoming!
    if (incoming.offset + bytes.length > incoming.bytes.length) return this.close()
    incoming.bytes.set(bytes, incoming.offset)
    incoming.offset += bytes.length
    if (incoming.offset !== incoming.bytes.length) return
    this.#incoming = undefined
    this.options.message(incoming.binary ? incoming.bytes : new TextDecoder().decode(incoming.bytes))
  }

  #drain(channel: RTCDataChannel) {
    return new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => {
        clearTimeout(timer)
        channel.removeEventListener("bufferedamountlow", drained)
        channel.removeEventListener("close", closed)
        resolve(ok)
      }
      const drained = () => done(this.ready)
      const closed = () => done(false)
      const timer = setTimeout(() => { this.close(); done(false) }, 10_000)
      channel.addEventListener("bufferedamountlow", drained, { once: true })
      channel.addEventListener("close", closed, { once: true })
      if (channel.bufferedAmount <= channel.bufferedAmountLowThreshold) done(this.ready)
    })
  }

  #reportRoute() {
    const route = this.options.route
    if (this.#closed || this.#channel?.readyState !== "open" || !route) return
    void this.#connection.getStats().then((stats) => {
      if (this.#closed || this.#channel?.readyState !== "open") return
      const selected = selectedPeerRouteReport(stats)
      if (!selected) return
      if (selected.bytesSent !== undefined && selected.bytesReceived !== undefined) {
        const previous = this.#pairCounters.get(selected.pairID) ?? { bytesSent: 0, bytesReceived: 0 }
        const bytesSent = selected.bytesSent >= previous.bytesSent
          ? selected.bytesSent - previous.bytesSent
          : selected.bytesSent
        const bytesReceived = selected.bytesReceived >= previous.bytesReceived
          ? selected.bytesReceived - previous.bytesReceived
          : selected.bytesReceived
        const key = selected.route === "direct" ? "directBytes" : "turnBytes"
        this.#routeBytes[key] += bytesSent + bytesReceived
        this.#pairCounters.set(selected.pairID, {
          bytesSent: selected.bytesSent,
          bytesReceived: selected.bytesReceived,
        })
      }
      route(selected.route, { ...this.#routeBytes })
    }).catch(() => undefined)
  }
}

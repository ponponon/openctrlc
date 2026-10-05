import { createHmac } from "node:crypto"
import { isPeerIceServers, type PeerIceServer } from "./protocol"

const turnCredentialLifetimeSeconds = 12 * 60 * 60
const turnCredentialCacheSafetyMs = 5 * 60 * 1000
const maxTurnCredentialCacheEntries = 10_000

type TurnCredentialEntry = { iceServers: PeerIceServer[]; expiresAt: number }
type TurnCredentialRequest = { promise: Promise<PeerIceServer[] | undefined>; invalidated: boolean }

const stunURLs = readICEURLs("OPENCTRLC_STUN_URLS", /^(stun|stuns):/i)
const turnURLs = readICEURLs("OPENCTRLC_TURN_URLS", /^turns?:/i)
const turnSharedSecret = process.env.OPENCTRLC_TURN_SHARED_SECRET?.trim()

/** Keeps temporary coturn credentials private to one Relay session and coalesces reconnects. */
export function createTurnIceServerCache(
  generate: (sessionID: string) => Promise<PeerIceServer[] | undefined>,
  now = Date.now,
) {
  const entries = new Map<string, TurnCredentialEntry>()
  const requests = new Map<string, TurnCredentialRequest>()
  const retryAfter = new Map<string, number>()

  return {
    get(sessionID: string) {
      const entry = entries.get(sessionID)
      if (entry && entry.expiresAt > now()) {
        entries.delete(sessionID)
        entries.set(sessionID, entry)
        return Promise.resolve(entry.iceServers)
      }
      entries.delete(sessionID)

      const pending = requests.get(sessionID)
      if (pending) return pending.promise

      if ((retryAfter.get(sessionID) ?? 0) > now()) return Promise.resolve(undefined)
      retryAfter.delete(sessionID)

      const request: TurnCredentialRequest = { promise: Promise.resolve(undefined), invalidated: false }
      request.promise = Promise.resolve()
        .then(() => generate(sessionID))
        .then(
          (iceServers) => {
            if (request.invalidated) return undefined
            if (!iceServers) {
              retryAfter.set(sessionID, now() + 30_000)
              return undefined
            }
            retryAfter.delete(sessionID)
            entries.set(sessionID, {
              iceServers,
              expiresAt: now() + turnCredentialLifetimeSeconds * 1000 - turnCredentialCacheSafetyMs,
            })
            while (entries.size > maxTurnCredentialCacheEntries) {
              const oldest = entries.keys().next().value
              if (!oldest) break
              entries.delete(oldest)
            }
            return iceServers
          },
          () => {
            if (!request.invalidated) retryAfter.set(sessionID, now() + 30_000)
            return undefined
          },
        )
        .finally(() => {
          if (requests.get(sessionID) === request) requests.delete(sessionID)
        })
      requests.set(sessionID, request)
      return request.promise
    },
    delete(sessionID: string) {
      entries.delete(sessionID)
      retryAfter.delete(sessionID)
      const pending = requests.get(sessionID)
      if (!pending) return
      pending.invalidated = true
      if (requests.get(sessionID) === pending) requests.delete(sessionID)
    },
  }
}

export function createCoturnIceServers(
  sessionID: string,
  urls: string[],
  sharedSecret: string,
  now = Date.now(),
) {
  if (!sessionID || !urls.length || sharedSecret.length < 32) return
  const username = `${Math.floor(now / 1000) + turnCredentialLifetimeSeconds}:${sessionID}`
  const credential = createHmac("sha1", sharedSecret).update(username).digest("base64")
  const iceServers: PeerIceServer[] = [{ urls, username, credential }]
  if (!isPeerIceServers(iceServers)) return
  return iceServers
}

export function turnCredentialsConfigured() {
  return !!turnURLs.length && !!turnSharedSecret && turnSharedSecret.length >= 32
}

export function stunServersConfigured() {
  return stunURLs.length > 0
}

const turnIceServerCache = createTurnIceServerCache(async (sessionID) =>
  createCoturnIceServers(sessionID, turnURLs, turnSharedSecret ?? ""),
)

export async function createPeerIceServers(sessionID: string) {
  const stun = stunURLs.length ? [{ urls: stunURLs }] : []
  if (!turnCredentialsConfigured()) return stun
  return [...stun, ...((await turnIceServerCache.get(sessionID)) ?? [])]
}

export function removeTurnIceServers(sessionID: string) {
  turnIceServerCache.delete(sessionID)
}

function readICEURLs(name: string, scheme: RegExp) {
  const value = process.env[name]?.trim()
  if (!value) return []
  const urls = [...new Set(value.split(",").map((url) => url.trim()).filter(Boolean))]
  if (urls.length > 8 || urls.some((url) => url.length > 512 || !scheme.test(url))) return []
  return urls
}

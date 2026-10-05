import { describe, expect, test } from "bun:test"
import { peerRouteCounts, recordPeerRoute } from "./peer-usage"
import type { PeerRouteState } from "./peer-usage"

describe("remote peer usage", () => {
  test("counts the latest route once per peer", () => {
    const routes = new Map<string, PeerRouteState>()
    recordPeerRoute(routes, "peer_1", "direct", 100, 50)
    recordPeerRoute(routes, "peer_2", "turn", 0, 75)
    recordPeerRoute(routes, "peer_1", "turn", 150, 100)

    expect(peerRouteCounts(routes.values())).toEqual({ direct: 0, turn: 2 })
  })

  test("ignores invalid route reports", () => {
    const routes = new Map<string, PeerRouteState>()

    expect(recordPeerRoute(routes, "peer_1", "relay", 10, 20)).toBeUndefined()
    expect(recordPeerRoute(routes, "peer_1", "direct", -1, 20)).toBeUndefined()
    expect(recordPeerRoute(routes, "peer_1", "direct", Number.NaN, 20)).toBeUndefined()
    expect(recordPeerRoute(routes, "peer_1", "direct", Number.MAX_SAFE_INTEGER + 1, 20)).toBeUndefined()
    expect(peerRouteCounts(routes.values())).toEqual({ direct: 0, turn: 0 })
  })

  test("returns nondecreasing byte deltas for path totals", () => {
    const routes = new Map<string, PeerRouteState>()

    expect(recordPeerRoute(routes, "peer_1", "direct", 120, 0)).toEqual({ directBytes: 120, turnBytes: 0 })
    expect(recordPeerRoute(routes, "peer_1", "turn", 120, 80)).toEqual({ directBytes: 0, turnBytes: 80 })
    expect(recordPeerRoute(routes, "peer_1", "direct", 100, 60)).toEqual({ directBytes: 0, turnBytes: 0 })
    expect(routes.get("peer_1")).toEqual({ route: "direct", directBytes: 120, turnBytes: 80 })
  })
})

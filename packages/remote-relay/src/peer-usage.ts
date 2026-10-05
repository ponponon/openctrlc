import type { PeerRoute } from "./protocol"

export type PeerRouteState = { route: PeerRoute; directBytes: number; turnBytes: number }

export function recordPeerRoute(
  routes: Map<string, PeerRouteState>,
  peerID: string,
  route: unknown,
  directBytes: unknown,
  turnBytes: unknown,
) {
  if (
    (route !== "direct" && route !== "turn") ||
    !Number.isSafeInteger(directBytes) || (directBytes as number) < 0 ||
    !Number.isSafeInteger(turnBytes) || (turnBytes as number) < 0
  ) return
  const previous = routes.get(peerID)
  const next: PeerRouteState = {
    route: route === "direct" ? "direct" : "turn",
    directBytes: Math.max(previous?.directBytes ?? 0, directBytes as number),
    turnBytes: Math.max(previous?.turnBytes ?? 0, turnBytes as number),
  }
  routes.set(peerID, next)
  return {
    directBytes: next.directBytes - (previous?.directBytes ?? 0),
    turnBytes: next.turnBytes - (previous?.turnBytes ?? 0),
  }
}

export function peerRouteCounts(routes: Iterable<PeerRouteState>) {
  let direct = 0
  let turn = 0
  for (const route of routes) {
    if (route.route === "direct") direct += 1
    if (route.route === "turn") turn += 1
  }
  return { direct, turn }
}

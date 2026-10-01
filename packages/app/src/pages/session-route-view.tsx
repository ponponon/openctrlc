import type { ServerConnection } from "@/context/server"
import { SessionPage, SessionRouteErrorBoundary, TargetSessionRouteContent } from "./session"

export function SessionRouteView(props: { sessionID?: string; serverKey?: ServerConnection.Key }) {
  return (
    <SessionRouteErrorBoundary sessionID={props.sessionID} serverKey={props.serverKey}>
      <SessionPage />
    </SessionRouteErrorBoundary>
  )
}

export function TargetSessionRouteView() {
  return <TargetSessionRouteContent />
}

export function SessionBoundary(props: {
  sessionID?: string
  serverKey?: ServerConnection.Key
  children: Parameters<typeof SessionRouteErrorBoundary>[0]["children"]
}) {
  return (
    <SessionRouteErrorBoundary sessionID={props.sessionID} serverKey={props.serverKey}>
      {props.children}
    </SessionRouteErrorBoundary>
  )
}

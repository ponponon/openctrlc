# OpenCtrlC Remote Relay

OpenCtrlC Desktop connects outbound to this relay over WSS. A phone scans a short-lived pairing link, the desktop owner approves it, and the relay forwards the browser's HTTP and WebSocket traffic to the desktop's loopback server.

## Security model

- The desktop keeps an in-memory session open while its relay WebSocket remains connected. It sends an application heartbeat every 30 seconds and closes a connection after 90 seconds without a matching pong; heartbeat checks pause during system suspend and resume immediately when the desktop wakes. After an unexpected disconnect, the relay retains the session for up to three minutes while the desktop retries the existing session; active browser tunnels and pending pairing attempts are closed during recovery. Each approved browser expires after 30 days without use; authenticated HTTP and WebSocket activity renews the grant. Stopping mobile access, closing the desktop, exhausting the reconnect window, or restarting the relay ends the session and revokes all grants.
- The QR code contains a one-time pairing secret in the URL fragment, which browsers do not send in the initial HTTP request or the `Referer` header.
- Every new browser receives access only after an explicit desktop approval. A session allows at most three approved browsers. Rotating the QR code cancels pending approvals; stopping access revokes all approved browsers.
- The desktop can list and revoke one approved browser without stopping other grants. The relay sends the desktop a random authorization ID and a User-Agent-derived browser hint, never the bearer token; the hint can be spoofed and does not identify a physical device. Revocation removes that grant and closes its active WebSockets.
- Viewer access uses a random bearer cookie marked `HttpOnly`, `Secure`, `SameSite=Strict`, and `__Host-`. The relay does not forward that cookie or browser authorization headers to the desktop server.
- The desktop-to-relay and phone-to-relay network hops use TLS. TLS terminates at the relay, so the relay operator can technically inspect traffic while forwarding it. The relay keeps session state in memory and does not intentionally persist workspace traffic.
- The desktop sends an in-memory workspace index containing open project paths, open session IDs, and the active session. The relay returns this index only after browser authorization so a fresh phone browser can restore the desktop's current workspace. The index excludes prompts, drafts, and message bodies; project paths and session IDs are still sensitive metadata and remain visible to the relay operator while the session is active.
- No inbound connection to the desktop is required. The relay restricts forwarded paths to the desktop's local server origin, limits payloads and concurrent requests, and applies pairing and session limits.

This is a relay, not end-to-end encryption. Operators must disclose that boundary and protect the relay host accordingly.

## Run locally

```bash
bun run --cwd packages/remote-relay start
```

The relay listens on `0.0.0.0:4097` by default. Set `OPENCTRLC_REMOTE_PUBLIC_URL` to the public HTTPS origin when generating pairing links.

## Deploy

The production example under [`infra/remote-relay`](../../infra/remote-relay) runs the relay in an isolated container, binds its port to host loopback only, and adds a dedicated OpenResty virtual host for `openctrlc-remote.quniv.cn`. The OpenResty instance must have a valid certificate for the hostname and forward WebSocket upgrades, long-lived streams, and the client's actual IP to the relay. See its [deployment guide](../../infra/remote-relay/README.md) for the host-specific script and operational checks.

For another domain, change `OPENCTRLC_REMOTE_PUBLIC_URL`, the OpenResty `server_name`, and the certificate paths together. Desktop clients can override the relay URL with `OPENCTRLC_REMOTE_RELAY_URL` when testing another deployment.

## Operational limits

All session state is process-local; this version is a single relay instance and does not support horizontal scaling or session failover. A relay restart disconnects all desktops and viewers. Set production capacity and regions based on measured traffic, and do not describe one small instance as global high-availability service.

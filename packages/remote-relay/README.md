# OpenCtrlC Remote Relay

OpenCtrlC Desktop connects outbound to this relay over WSS. A phone scans a short-lived pairing link, the desktop owner approves it, and the relay forwards the browser's HTTP and WebSocket traffic to the desktop's loopback server.

## Security model

- The desktop sends an application heartbeat every 30 seconds and closes a connection after 90 seconds without a matching pong; heartbeat checks pause during system suspend and resume immediately when the desktop wakes. After a disconnect, sessions with approved browsers remain resumable for up to 30 days, and sessions without approved browsers for up to one hour. Active browser tunnels and pending pairing attempts close during recovery. Approved browsers expire after 30 days without use; authenticated HTTP and WebSocket activity renews the grant. Desktop exit detaches the connection and preserves resume credentials; explicitly stopping mobile access revokes the session and grants.
- The QR code contains a one-time pairing secret in the URL fragment, which browsers do not send in the initial HTTP request or the `Referer` header.
- Every new browser receives access only after an explicit desktop approval. New desktop versions allow 10 approved browsers by default and let the user configure a limit from 1 to 100; older clients that do not send a limit keep the legacy limit of three. Lowering a limit does not revoke existing grants, but blocks additional pairings until capacity is available. Rotating the QR code cancels pending approvals; stopping access revokes all approved browsers.
- The desktop can list and revoke one approved browser without stopping other grants. The relay sends the desktop a random authorization ID and a User-Agent-derived browser hint, never the bearer token; the hint can be spoofed and does not identify a physical device. Revocation removes that grant and closes its active WebSockets.
- Viewer access uses a random bearer cookie marked `HttpOnly`, `Secure`, `SameSite=Strict`, and `__Host-`. The relay does not forward that cookie or browser authorization headers to the desktop server.
- The desktop-to-relay and phone-to-relay network hops use TLS. TLS terminates at the relay, so the relay operator can technically inspect traffic while forwarding it. Setting `OPENCTRLC_REMOTE_DATA_DIR` enables persistence of session resume credentials, browser bearer grants, and workspace metadata in `remote-sessions.json`; the production compose file mounts this directory. The deploy script restricts the directory to the service account, and the Relay writes the state file with mode `0600`. Protect the data directory and its backups as credentials. Without persistence, a relay restart loses grants. The relay does not intentionally persist message bodies or forwarded workspace traffic.
- The desktop sends a workspace index containing open project paths, open session IDs, and the active session. The relay returns this index only after browser authorization so a fresh phone browser can restore the desktop's current workspace. The index excludes prompts, drafts, and message bodies; project paths and session IDs are sensitive metadata, visible to the relay operator and included in persisted state when enabled.
- Dynamic API responses are forwarded to the authorized desktop without a shared relay cache and default to `no-store`. Successful content-hashed Web UI assets can use browser long-term caching; these responses do not refresh or embed viewer authorization cookies. Error responses and HTML fallbacks never receive the immutable asset policy.
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

The relay accepts at most 10,000 in-memory sessions and at most 60 session creations per source IP in a rolling hour. These are abuse/capacity guards, not a benchmark or a promise that one instance can serve that many active users. New desktop clients allow 10 authorized browsers per session by default (configurable from 1 to 100); the relay separately allows at most 32 active viewer WebSocket tunnels per session.

The 10,000-session guard counts retained sessions, including disconnected desktops. A session with approved browser grants can remain resumable for up to 30 days, so a full set of dormant sessions can reject new session creation even when fewer than 10,000 desktops are currently online. `/healthz` reports retained records in `sessions` and live desktop connections in `usage.connectedDesktops`. Before public scale, set separate active-connection and retained-session policies; do not silently evict a still-valid 30-day browser grant to free a slot.

Active connections are process-local; this version is a single relay instance and does not support horizontal scaling or session failover. A relay restart disconnects desktops and viewers, while a configured data directory restores saved sessions and unexpired browser grants so desktops can reconnect. Set production capacity and regions based on measured traffic, and do not describe one small instance as global high-availability service. The working tree contains an unreleased WebRTC transport with optional self-hosted Coturn credentials; it has not been deployed or verified end to end, so production still uses the HTTPS/WebSocket relay path. See the [low-cost service plan](../../docs/remote-service-economics.md) for hosting, quotas, and revenue options.

The health endpoint is private and is intentionally blocked by the public OpenResty virtual host. On the relay host, inspect a live snapshot with:

```bash
curl -fsS http://127.0.0.1:4097/healthz | jq '{sessions, usage, traffic}'
```

`usage.connectedDesktops` counts currently connected desktop clients; `usage.authorizedBrowsers` counts grants that can reconnect, not browsers currently online; `usage.activeViewerSockets` counts open HTTP-relay WebSocket tunnels; `usage.activePeerSignalingSockets` counts authorized WebRTC signaling sockets, including negotiation attempts. `usage.activeP2PDirectPeers` and `usage.activeP2PTurnPeers` count peers whose connected desktop most recently reported the selected ICE route from WebRTC stats (route reports refresh every 15 seconds). `traffic.p2pDirectBytes` and `traffic.p2pTurnBytes` accumulate the desktop's `bytesSent + bytesReceived` candidate-pair payload counters, split by route. WebRTC defines those counters to exclude packet headers, padding, and ICE connectivity checks, so they understate network-interface traffic. They are endpoint-side estimates, not Relay/TURN server NIC totals, unique people, or billing metrics. Peers still negotiating may not appear in either route count. `usage.pendingViewerRequests` and `usage.pendingPairings` count in-flight work. There is no account or physical-device identity, so the relay cannot report an exact number of people currently using it. The monitoring scripts retain hourly snapshots under `/home/pon/openctrlc-remote/logs/`.

The traffic snapshot sums only retained sessions and resets after a process restart. `viewerOut` counts response payload before optional gzip compression. `p2pDirectBytes` and `p2pTurnBytes` are desktop-reported WebRTC candidate-pair payload estimates; the TURN figure covers only the desktop's endpoint view, while a TURN server forwards packets on both client and peer legs. The WebRTC counters exclude packet headers, padding, and ICE checks. Treat all these values as diagnostics, not authoritative network-egress or billing totals. Use server network-interface counters and provider billing data for actual egress.

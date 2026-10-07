# Public relay deployment

This production example deploys one OpenCtrlC Remote Relay instance behind the existing OpenResty installation. The relay container binds to `127.0.0.1:4097`; only the HTTPS virtual host is exposed publicly. It assumes the `openctrlc-remote.quniv.cn` DNS record points to this host and that the 1Panel certificate at `/www/sites/quniv.cn/ssl/` covers that hostname.

## Deploy

Run these commands on the relay host from a checkout containing this directory:

```bash
sh infra/remote-relay/deploy.sh
```

A full deployment checks the currently running Relay before replacing it. If it reports retained sessions, deployment proceeds only when the Relay confirms persistence is enabled, there is no pending or failed save, and the on-disk versioned snapshot timestamp, session count, session credentials, and browser grant count match the live state. Otherwise deployment stops so browser grants are not silently lost. Wait until those sessions end, or—only after notifying affected users and accepting that they must pair again—run `sh infra/remote-relay/deploy.sh --allow-session-reset`. A managed OpenResty-only change can use `--config-only`; that mode does not restart the Relay.

The full deployment requires Docker Compose, `curl`, and `jq`. The script checks that the expected OpenResty container and certificate are present, refuses to replace an unrelated container or virtual host, builds the isolated relay container, validates its local health and persistence plus the peer-capability endpoint, validates the Nginx configuration, then reloads OpenResty. It does not restart other containers. On a new install, the Relay uses the invoking non-root account's numeric UID/GID. On an existing install, it preserves the data directory's current numeric owner so a previously hardened `0700` directory remains writable across upgrades. A short-lived root helper using the built image applies ownership and mode `0700` to the data directory and `0600` to `remote-sessions.json`; the Relay itself still runs unprivileged. The managed files live under `/home/pon/openctrlc-remote` and `/usr/local/openresty/nginx/conf/conf.d/openctrlc-remote.quniv.cn.conf`.

For a managed virtual-host change that must preserve active in-memory sessions, run `sh infra/remote-relay/deploy.sh --config-only`. This validates the existing managed configuration and certificate, installs only `openresty.conf`, runs `nginx -t`, and gracefully reloads OpenResty with rollback on failure. It does not validate or alter Relay session state because it does not rebuild or restart the Relay container.

If an already-authorized browser still shows an old project list, open `https://openctrlc-remote.quniv.cn/_remote/refresh-workspace` in that browser. The route clears only the short-lived workspace bootstrap cookie; it preserves the browser grant and reloads the latest snapshot from the Relay.

## Optional independent P2P Relay endpoint

This target creates a second Relay endpoint at `openctrlc-p2p.quniv.cn`. It does **not** change the desktop client's default, which remains `openctrlc-remote.quniv.cn`; existing sessions always resume through their saved Relay URL. To send only newly created sessions to the independent endpoint, launch the desktop process with `OPENCTRLC_REMOTE_RELAY_URL=wss://openctrlc-p2p.quniv.cn/v1/host`. The pairing link then points browsers at the same P2P Relay origin. This environment variable is a deployment/operator setting, not a user-facing preference in the desktop app.

If the goal is to add ICE discovery to the existing default endpoint, keep its HTTPS/WSS origin unchanged and configure the **primary Relay** with `OPENCTRLC_STUN_URLS=stun:openctrlc-p2p.quniv.cn:3478`. The primary Relay will advertise that ICE server while browser signaling and HTTPS fallback continue through `openctrlc-remote.quniv.cn`. Deploying the primary Relay this way restarts its process and disconnects active transports; use the full deploy's state checks and coordinate the reconnect window. In both designs, first create an `A` record for `openctrlc-p2p.quniv.cn` in the domain's currently authoritative DNS provider, pointing to this host. If that DNS provider offers an HTTP proxy toggle, keep this record DNS-only because HTTP proxying does not carry STUN UDP traffic. Then allow inbound UDP 3478 in the cloud security group and host firewall. Deploy the independent P2P instance with:

```bash
OPENCTRLC_RELAY_INSTANCE=p2p sh infra/remote-relay/deploy.sh
```

This target uses `/home/pon/openctrlc-remote-p2p`, a separate persistent session store, loopback TCP port 4098, and the `openctrlc-p2p.quniv.cn` HTTPS virtual host. Its Coturn container provides STUN on UDP 3478; STUN only helps peers discover candidate addresses and does not carry workspace traffic. Coturn drops all capabilities except `NET_BIND_SERVICE`, which its upstream binary requires to start. Compose invokes the binary directly (the image entrypoint expands `-n` incorrectly) and binds it to `0.0.0.0` to avoid scanning every Docker bridge interface. The deploy script waits up to 15 seconds for the UDP socket before reloading OpenResty. It does not verify that the cloud firewall permits UDP; verify from an external Mainland China and US network before relying on direct P2P. HTTP/WebSocket Relay remains the fallback.

The P2P instance is upgraded independently with the same command. It has its own retained sessions and browser grants; the deploy script refuses to restart it when active state cannot be verified from a persistent snapshot. `OPENCTRLC_RELAY_INSTANCE=p2p sh infra/remote-relay/deploy.sh --config-only` updates only the P2P virtual host and leaves both Relay processes running. Updating this secondary endpoint does not switch the default; the default deployment target remains the original `openctrlc-remote.quniv.cn` instance.

For another host, edit `compose.yaml` (`OPENCTRLC_REMOTE_PUBLIC_URL`), `openresty.conf` (`server_name` and certificate paths), and `deploy.sh` (host-specific paths and OpenResty container name) before deployment. Provide a valid public TLS certificate and preserve the loopback-only relay port binding.

## Operations

- Check status: `docker compose --project-name openctrlc-remote --project-directory /home/pon/openctrlc-remote -f /home/pon/openctrlc-remote/infra/remote-relay/compose.yaml ps`
- Check health: `curl --fail https://openctrlc-remote.quniv.cn/healthz` returns 404 by design; the private host-only check is `curl http://127.0.0.1:4097/healthz`.
- Check the public peer protocol route after deployment: `sh infra/remote-relay/monitor/remote-smoke.sh --public https://openctrlc-remote.quniv.cn`. The smoke check requires an unauthenticated JSON response with `peerProtocol: 1` and a boolean `iceConfigured`; `iceConfigured: false` is valid and means clients immediately use the HTTPS Relay path.
- View current use from the server: `curl -fsS http://127.0.0.1:4097/healthz | jq '{retainedSessions: .sessions, usage: .usage, traffic: .traffic}'`. From your Mac: `ssh pon@111.228.41.233 'curl -fsS http://127.0.0.1:4097/healthz | jq "{retainedSessions: .sessions, usage: .usage, traffic: .traffic}"'`. `connectedDesktops` is online desktop connections; `authorizedBrowsers` is saved grants, not online people; `activeViewerSockets` counts Relay WebSocket tunnels and `activePeerSignalingSockets` counts Relay signaling sockets. Both are connection counts, may belong to the same browser, and do not equal unique people. New Relay builds expose `activeP2PDirectPeers` and `activeP2PTurnPeers` from the desktop's selected ICE candidate pair, plus `traffic.p2pDirectBytes` and `traffic.p2pTurnBytes` as endpoint-side WebRTC payload estimates. The WebRTC counters exclude packet headers, padding, and ICE checks; the TURN values cover only the desktop endpoint's view, not both legs at the TURN server. They are not server NIC totals or billing values; use host network counters and provider billing for actual egress. Older deployed Relay builds do not report these fields. `sessions` includes retained offline sessions.
- The hourly monitor writes aggregate `sessions`, `usage`, `traffic`, and `persistence` fields only. It omits the per-session `active` list so session IDs are not copied into monitoring logs. The monitor directory is mode `0700`; state, alert, and traffic files are mode `0600`.
- View relay process output: run `docker compose ... logs --tail=100 relay` with the same project and file arguments above. The reverse proxy disables access logs and sends its virtual-host error log to `/dev/null` to avoid persisting request URLs.
- Restarting the relay disconnects active transports. The deploy script restricts `/home/pon/openctrlc-remote/data` to the deployment account, and the Relay writes `remote-sessions.json` as mode `0600`; treat the directory and its backups as credentials. The file contains resume credentials, browser grants, and workspace metadata, including opened project paths, session IDs and titles, and session directories used to restore remote tabs without an extra session-detail request. It does not contain transcript messages. Saved sessions and unexpired grants are restored so desktops can reconnect. In-flight requests and WebSocket streams are not restored. Without the data volume, grants are lost on restart.

The public endpoint is one limited-capacity instance. It is suitable as an initial shared service, not a claim of worldwide low latency, high availability, or horizontal scaling.

## Capacity and bandwidth

The Relay's `maxSessions = 10,000` is an admission ceiling for retained session records, including temporarily offline sessions; it is not a benchmark or a promise of 10,000 connected users. The `60` session-creation limit is per source IP per rolling hour and is an abuse guard. The current container is separately capped at one CPU and 512 MiB RAM, and request/socket concurrency has its own limits. Measure realistic concurrent WebSockets, workspace loads, streams, CPU, memory, and egress before raising production capacity.

The current public host has a nominal 5 Mbit/s line. At continuous line-rate, that is at most about 54 GB/day or 1.62 TB per 30 days before protocol overhead and provider-specific billing rules; operating continuously at the limit leaves no burst headroom. At 50% average utilization, the theoretical 30-day transfer is about 810 GB. With 10,000 users sharing that evenly, this is only about 81 MB of Relay traffic per user per month. These are arithmetic ceilings, not a capacity test or a bill estimate.

For the full load assumptions, free-tier comparison, launch gates, and monetization options, see [the remote-service capacity and economics plan](../../docs/remote-service-economics.md).

WebRTC direct paths can keep workspace payload off the public Relay; signaling still uses the Relay. STUN helps discover direct candidates and normally carries no workspace payload. TURN and HTTPS fallback do carry user traffic and therefore still consume server bandwidth. Do not count configured P2P support as an egress reduction until the selected path and Relay traffic counters confirm it. This project uses its self-hosted Bun Relay for the remote data path; Cloudflare Workers or other Worker-hosted forwarding are not part of this design.

## Optional self-hosted WebRTC ICE/TURN

P2P uses ICE servers supplied by this Relay. There is no hard-coded public STUN provider and the Relay does not call an external TURN credential API. With no ICE server configured, clients skip P2P negotiation and use the existing HTTPS Relay immediately. After configuring ICE, a peer that has not become ready within 12 seconds falls back to HTTPS Relay. For cross-network direct connections, configure a reachable STUN service; for networks that block direct UDP, configure a Coturn TURN service as well. TURN carries encrypted WebRTC packets but still consumes the TURN server's bandwidth.

This Compose file includes an **opt-in, STUN-only** Coturn service. It is excluded from the normal Relay deployment and listens only on UDP 3478 using host networking; it does not allocate TURN relays or expose a TURN relay port range. The version-tagged upstream image currently used here is `coturn/coturn:4.18.0-r0`.

Before enabling it, confirm UDP 3478 is unused on the host and allow inbound UDP 3478 in the cloud security group and host firewall. Start it explicitly:

```bash
docker compose --project-name openctrlc-remote --project-directory /home/pon/openctrlc-remote --profile stun -f /home/pon/openctrlc-remote/infra/remote-relay/compose.yaml up -d stun
```

Then add this to `/home/pon/openctrlc-remote/.env` (mode `0600`) and redeploy the Relay so it publishes the ICE address to approved peers:

```dotenv
OPENCTRLC_STUN_URLS=stun:openctrlc-remote.quniv.cn:3478
```

The profile is deliberately opt-in: the current HTTPS Relay remains the fallback, and opening UDP is a separate operator decision. STUN only helps discover network candidates; it does not carry workspace traffic or guarantee that a direct path will succeed. The Coturn image and `stun-only` behavior are documented by the [upstream Coturn Docker guide](https://github.com/coturn/coturn/blob/master/docker/coturn/README.md) and [server options](https://github.com/coturn/coturn/blob/master/README.turnserver).

Disable the optional service without touching the Relay:

```bash
docker compose --project-name openctrlc-remote --project-directory /home/pon/openctrlc-remote --profile stun -f /home/pon/openctrlc-remote/infra/remote-relay/compose.yaml stop stun
```

The Relay supports Coturn's shared-secret REST authentication. Generate a long random secret and store it only in `/home/pon/openctrlc-remote/.env` with file mode `0600`. Configure Coturn with `use-auth-secret` and the same `static-auth-secret`. Use the public hostnames, ports, and relay port range configured in Coturn and the server firewall:

```dotenv
OPENCTRLC_STUN_URLS=stun:turn.example.net:3478
OPENCTRLC_TURN_URLS=turn:turn.example.net:3478?transport=udp,turns:turn.example.net:5349?transport=tcp
OPENCTRLC_TURN_SHARED_SECRET=replace-with-a-random-secret-of-at-least-32-characters
```

`OPENCTRLC_STUN_URLS` is optional and accepts up to eight comma-separated `stun:`/`stuns:` URLs. TURN requires both `OPENCTRLC_TURN_URLS` and a shared secret of at least 32 characters. The Relay mints a Coturn-compatible username and HMAC-SHA1 credential that expires after 12 hours, caches it per Relay session, and never sends the long-lived shared secret to either endpoint. Health reports whether ICE/TURN settings are present; it does not probe UDP reachability or guarantee that a firewall permits the configured ports. Keep HTTPS Relay fallback enabled and measure Mainland China, US, and mobile-carrier paths before relying on direct ICE or TURN.

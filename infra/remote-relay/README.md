# Public relay deployment

This production example deploys one OpenCtrlC Remote Relay instance behind the existing OpenResty installation. The relay container binds to `127.0.0.1:4097`; only the HTTPS virtual host is exposed publicly. It assumes the `openctrlc-remote.quniv.cn` DNS record points to this host and that the 1Panel certificate at `/www/sites/quniv.cn/ssl/` covers that hostname.

## Deploy

Run these commands on the relay host from a checkout containing this directory:

```bash
sh infra/remote-relay/deploy.sh
```

The full deployment requires Docker Compose, `curl`, and `jq`. The script checks that the expected OpenResty container and certificate are present, refuses to replace an unrelated container or virtual host, builds the isolated relay container, checks its local health endpoint including persistence, validates the Nginx configuration, then reloads OpenResty. It does not restart other containers. It runs the Relay container as the invoking non-root account's numeric UID/GID so the bind-mounted data directory remains writable without running the service as root. The managed files live under `/home/pon/openctrlc-remote` and `/usr/local/openresty/nginx/conf/conf.d/openctrlc-remote.quniv.cn.conf`.

For a managed virtual-host change that must preserve active in-memory sessions, run `sh infra/remote-relay/deploy.sh --config-only`. This validates the existing managed configuration and certificate, installs only `openresty.conf`, runs `nginx -t`, and gracefully reloads OpenResty with rollback on failure. It does not rebuild or restart the Relay container.

For another host, edit `compose.yaml` (`OPENCTRLC_REMOTE_PUBLIC_URL`), `openresty.conf` (`server_name` and certificate paths), and `deploy.sh` (host-specific paths and OpenResty container name) before deployment. Provide a valid public TLS certificate and preserve the loopback-only relay port binding.

## Operations

- Check status: `docker compose --project-name openctrlc-remote --project-directory /home/pon/openctrlc-remote -f /home/pon/openctrlc-remote/infra/remote-relay/compose.yaml ps`
- Check health: `curl --fail https://openctrlc-remote.quniv.cn/healthz` returns 404 by design; the private host-only check is `curl http://127.0.0.1:4097/healthz`.
- View current use from the server: `curl -fsS http://127.0.0.1:4097/healthz | jq '{retainedSessions: .sessions, usage: .usage, traffic: .traffic}'`. From your Mac: `ssh pon@111.228.41.233 'curl -fsS http://127.0.0.1:4097/healthz | jq "{retainedSessions: .sessions, usage: .usage, traffic: .traffic}"'`. `connectedDesktops` is online desktop connections; `authorizedBrowsers` is saved grants, not online people; `activeViewerSockets` counts Relay WebSocket tunnels and `activePeerSignalingSockets` counts Relay signaling sockets. Both are connection counts, may belong to the same browser, and do not equal unique people. New Relay builds expose `activeP2PDirectPeers` and `activeP2PTurnPeers` from the desktop's selected ICE candidate pair, plus `traffic.p2pDirectBytes` and `traffic.p2pTurnBytes` as endpoint-side WebRTC payload estimates. The WebRTC counters exclude packet headers, padding, and ICE checks; the TURN values cover only the desktop endpoint's view, not both legs at the TURN server. They are not server NIC totals or billing values; use host network counters and provider billing for actual egress. Older deployed Relay builds do not report these fields. `sessions` includes retained offline sessions.
- The hourly monitor writes aggregate `sessions`, `usage`, `traffic`, and `persistence` fields only. It omits the per-session `active` list so session IDs are not copied into monitoring logs. The monitor directory is mode `0700`; state, alert, and traffic files are mode `0600`.
- View relay process output: run `docker compose ... logs --tail=100 relay` with the same project and file arguments above. The reverse proxy disables access logs and sends its virtual-host error log to `/dev/null` to avoid persisting request URLs.
- Restarting the relay disconnects active transports. The deploy script restricts `/home/pon/openctrlc-remote/data` to the deployment account, and the Relay writes `remote-sessions.json` as mode `0600`; treat the directory and its backups as credentials. The file contains resume credentials, browser grants, and workspace metadata. Saved sessions and unexpired grants are restored so desktops can reconnect. In-flight requests and WebSocket streams are not restored. Without the data volume, grants are lost on restart.

The public endpoint is one limited-capacity instance. It is suitable as an initial shared service, not a claim of worldwide low latency, high availability, or horizontal scaling.

## Optional self-hosted WebRTC ICE/TURN

P2P uses ICE servers supplied by this Relay. There is no hard-coded public STUN provider and the Relay does not call an external TURN credential API. With no ICE server configured, it tries local network candidates, then falls back to the existing HTTPS Relay after 12 seconds. For cross-network direct connections, configure a reachable STUN service; for networks that block direct UDP, configure a Coturn TURN service as well. TURN carries encrypted WebRTC packets but still consumes the TURN server's bandwidth.

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

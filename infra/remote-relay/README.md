# Public relay deployment

This production example deploys one OpenCtrlC Remote Relay instance behind the existing OpenResty installation. The relay container binds to `127.0.0.1:4097`; only the HTTPS virtual host is exposed publicly. It assumes the `openctrlc-remote.quniv.cn` DNS record points to this host and that the 1Panel certificate at `/www/sites/quniv.cn/ssl/` covers that hostname.

## Deploy

Run these commands on the relay host from a checkout containing this directory:

```bash
sh infra/remote-relay/deploy.sh
```

The script checks that the expected OpenResty container and certificate are present, refuses to replace an unrelated container or virtual host, builds the isolated relay container, checks its local health endpoint, validates the Nginx configuration, then reloads OpenResty. It does not restart other containers. The managed files live under `/home/pon/openctrlc-remote` and `/usr/local/openresty/nginx/conf/conf.d/openctrlc-remote.quniv.cn.conf`.

For a managed virtual-host change that must preserve active in-memory sessions, run `sh infra/remote-relay/deploy.sh --config-only`. This validates the existing managed configuration and certificate, installs only `openresty.conf`, runs `nginx -t`, and gracefully reloads OpenResty with rollback on failure. It does not rebuild or restart the Relay container.

For another host, edit `compose.yaml` (`OPENCTRLC_REMOTE_PUBLIC_URL`), `openresty.conf` (`server_name` and certificate paths), and `deploy.sh` (host-specific paths and OpenResty container name) before deployment. Provide a valid public TLS certificate and preserve the loopback-only relay port binding.

## Operations

- Check status: `docker compose --project-name openctrlc-remote --project-directory /home/pon/openctrlc-remote -f /home/pon/openctrlc-remote/infra/remote-relay/compose.yaml ps`
- Check health: `curl --fail https://openctrlc-remote.quniv.cn/healthz` returns 404 by design; the private host-only check is `curl http://127.0.0.1:4097/healthz`.
- View relay process output: run `docker compose ... logs --tail=100 relay` with the same project and file arguments above. The reverse proxy disables access logs and sends its virtual-host error log to `/dev/null` to avoid persisting request URLs.
- Restarting the relay drops all active remote sessions; sessions are process-local and are not restored after restart.

The public endpoint is one limited-capacity instance. It is suitable as an initial shared service, not a claim of worldwide low latency, high availability, or horizontal scaling.

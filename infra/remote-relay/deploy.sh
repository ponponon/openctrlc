#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
mode=${1:-full}
host_conf=/usr/local/openresty/nginx/conf/conf.d/openctrlc-remote.quniv.cn.conf
relay=/home/pon/openctrlc-remote
compose=$relay/infra/remote-relay/compose.yaml
openresty=1Panel-openresty-vH9J
managed_marker=$relay/.managed-by-openctrlc-remote
temp=$(mktemp -d)
trap 'rm -rf "$temp"' EXIT HUP INT TERM

if [ ! -f "$root/infra/remote-relay/compose.yaml" ]; then
  echo "Repository root not found: $root" >&2
  exit 1
fi
if [ "$mode" != full ] && [ "$mode" != --config-only ]; then
  echo "Usage: sh infra/remote-relay/deploy.sh [--config-only]" >&2
  exit 2
fi
if [ "$mode" = --config-only ] && [ "$#" -ne 1 ]; then
  echo "Usage: sh infra/remote-relay/deploy.sh [--config-only]" >&2
  exit 2
fi
if [ "$mode" = full ] && ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to validate Relay persistence health during deployment" >&2
  exit 1
fi

if [ -e "$relay" ] && [ ! -f "$managed_marker" ]; then
  echo "Refusing to use an existing unmarked directory: $relay" >&2
  exit 1
fi

if docker inspect openctrlc-remote-relay >/dev/null 2>&1; then
  label=$(docker inspect openctrlc-remote-relay --format '{{ index .Config.Labels "com.docker.compose.project" }}')
  if [ "$label" != "openctrlc-remote" ]; then
    echo "Container name openctrlc-remote-relay is already owned by another deployment" >&2
    exit 1
  fi
fi

if ! docker exec "$openresty" true >/dev/null 2>&1; then
  echo "OpenResty container is not running: $openresty" >&2
  exit 1
fi
docker exec "$openresty" openssl x509 -in /www/sites/quniv.cn/ssl/fullchain.pem -noout -checkhost openctrlc-remote.quniv.cn >/dev/null

if docker exec "$openresty" test -e "$host_conf"; then
  docker cp "$openresty:$host_conf" "$temp/existing.conf"
  if ! grep -qF 'Managed by OpenCtrlC Remote Relay deployment.' "$temp/existing.conf"; then
    echo "Refusing to replace an unmanaged OpenResty config: $host_conf" >&2
    exit 1
  fi
fi

if [ "$mode" = --config-only ]; then
  if [ ! -f "$temp/existing.conf" ]; then
    echo "Refusing config-only deployment without an existing managed virtual host" >&2
    exit 1
  fi
  docker cp "$root/infra/remote-relay/openresty.conf" "$openresty:/tmp/openctrlc-remote.conf"
  docker exec -u root "$openresty" install -m 0644 /tmp/openctrlc-remote.conf "$host_conf"
  if ! docker exec -u root "$openresty" nginx -t; then
    docker cp "$temp/existing.conf" "$openresty:/tmp/openctrlc-remote.rollback.conf"
    docker exec -u root "$openresty" install -m 0644 /tmp/openctrlc-remote.rollback.conf "$host_conf"
    docker exec -u root "$openresty" nginx -t
    exit 1
  fi
  if ! docker exec -u root "$openresty" nginx -s reload; then
    docker cp "$temp/existing.conf" "$openresty:/tmp/openctrlc-remote.rollback.conf"
    docker exec -u root "$openresty" install -m 0644 /tmp/openctrlc-remote.rollback.conf "$host_conf"
    docker exec -u root "$openresty" nginx -t
    docker exec -u root "$openresty" nginx -s reload
    exit 1
  fi
  echo "OpenResty config reloaded without restarting the Relay process"
  exit 0
fi

deploy_uid=$(id -u)
deploy_gid=$(id -g)
if [ "$deploy_uid" -eq 0 ]; then
  echo "Run the Relay deployment as a non-root account so the container stays unprivileged" >&2
  exit 1
fi

install -d -m 0755 "$relay/packages" "$relay/infra/remote-relay"
if [ -L "$relay/data" ]; then
  echo "Refusing a symlinked Relay data directory: $relay/data" >&2
  exit 1
fi
if [ -d "$relay/data" ]; then
  relay_uid=$(stat -c %u "$relay/data")
  relay_gid=$(stat -c %g "$relay/data")
  if [ "$relay_uid" -eq 0 ]; then
    echo "Refusing to run the Relay container as root; migrate $relay/data to a non-root owner first" >&2
    exit 1
  fi
else
  install -d -m 0700 "$relay/data"
  relay_uid=$deploy_uid
  relay_gid=$deploy_gid
fi
export OPENCTRLC_RELAY_UID=$relay_uid
export OPENCTRLC_RELAY_GID=$relay_gid

printf '%s\n' 'Managed by OpenCtrlC Remote Relay deployment.' > "$managed_marker"
rm -rf "$relay/packages/remote-relay.next"
install -d -m 0755 "$relay/packages/remote-relay.next"
cp -R "$root/packages/remote-relay/." "$relay/packages/remote-relay.next/"
rm -rf "$relay/packages/remote-relay.previous"
if [ -d "$relay/packages/remote-relay" ]; then
  mv "$relay/packages/remote-relay" "$relay/packages/remote-relay.previous"
fi
mv "$relay/packages/remote-relay.next" "$relay/packages/remote-relay"
cp "$root/infra/remote-relay/compose.yaml" "$compose"
cp "$root/infra/remote-relay/openresty.conf" "$relay/infra/remote-relay/openresty.conf"
docker compose --project-name openctrlc-remote --project-directory "$relay" -f "$compose" build relay
docker run --rm --user 0:0 --volume "$relay/data:/data:rw" \
  --env "RELAY_UID=$relay_uid" --env "RELAY_GID=$relay_gid" \
  --entrypoint /bin/sh openctrlc/remote-relay:local -ec '
    chown "$RELAY_UID:$RELAY_GID" /data
    chmod 0700 /data
    if [ -L /data/remote-sessions.json ]; then
      echo "Refusing a symlinked Relay session state file" >&2
      exit 1
    fi
    if [ -f /data/remote-sessions.json ]; then
      chown "$RELAY_UID:$RELAY_GID" /data/remote-sessions.json
      chmod 0600 /data/remote-sessions.json
    fi
  '
docker compose --project-name openctrlc-remote --project-directory "$relay" -f "$compose" up -d --no-build

healthy=false
for attempt in $(seq 1 30); do
  health=$(curl --fail --silent http://127.0.0.1:4097/healthz || true)
  if [ -n "$health" ] && printf '%s' "$health" | jq -e '.ok == true and .persistence.enabled == true and .persistence.errors == 0' >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done
if [ "$healthy" != true ]; then
  echo "Relay did not become healthy; OpenResty was not reloaded" >&2
  docker compose --project-name openctrlc-remote --project-directory "$relay" -f "$compose" logs --tail=50 relay >&2
  exit 1
fi

peer_capabilities=$(curl --fail --silent --max-time 5 http://127.0.0.1:4097/_remote/capabilities || true)
if ! printf '%s' "$peer_capabilities" | jq -e '.peerProtocol == 1 and (.iceConfigured | type == "boolean")' >/dev/null; then
  echo "Relay peer capability endpoint did not report the expected protocol; OpenResty was not reloaded" >&2
  docker compose --project-name openctrlc-remote --project-directory "$relay" -f "$compose" logs --tail=50 relay >&2
  exit 1
fi

had_conf=false
if docker exec "$openresty" test -e "$host_conf"; then
  had_conf=true
  docker cp "$openresty:$host_conf" "$temp/rollback.conf"
fi
docker cp "$root/infra/remote-relay/openresty.conf" "$openresty:/tmp/openctrlc-remote.conf"
docker exec -u root "$openresty" install -m 0644 /tmp/openctrlc-remote.conf "$host_conf"
if ! docker exec -u root "$openresty" nginx -t; then
  if [ "$had_conf" = true ]; then
    docker cp "$temp/rollback.conf" "$openresty:/tmp/openctrlc-remote.rollback.conf"
    docker exec -u root "$openresty" install -m 0644 /tmp/openctrlc-remote.rollback.conf "$host_conf"
    docker exec -u root "$openresty" nginx -t
  else
    docker exec -u root "$openresty" rm -f "$host_conf"
  fi
  exit 1
fi
if ! docker exec -u root "$openresty" nginx -s reload; then
  if [ "$had_conf" = true ]; then
    docker cp "$temp/rollback.conf" "$openresty:/tmp/openctrlc-remote.rollback.conf"
    docker exec -u root "$openresty" install -m 0644 /tmp/openctrlc-remote.rollback.conf "$host_conf"
  else
    docker exec -u root "$openresty" rm -f "$host_conf"
  fi
  docker exec -u root "$openresty" nginx -t
  docker exec -u root "$openresty" nginx -s reload
  exit 1
fi

docker compose --project-name openctrlc-remote --project-directory "$relay" -f "$compose" ps
curl --fail --silent --show-error http://127.0.0.1:4097/healthz
rm -rf "$relay/packages/remote-relay.previous"

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

install -d -m 0755 "$relay/packages" "$relay/infra/remote-relay"
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
docker compose --project-name openctrlc-remote --project-directory "$relay" -f "$compose" up -d --no-build

healthy=false
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:4097/healthz >/dev/null; then
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

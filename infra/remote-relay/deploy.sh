#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
mode=${1:-full}
instance=${OPENCTRLC_RELAY_INSTANCE:-legacy}
if [ "$instance" = p2p ]; then
  host_conf=/usr/local/openresty/nginx/conf/conf.d/openctrlc-p2p.quniv.cn.conf
  relay=/home/pon/openctrlc-remote-p2p
  project=openctrlc-remote-p2p
  container=openctrlc-remote-p2p-relay
  host_port=4098
  hostname=openctrlc-p2p.quniv.cn
  image=openctrlc/remote-relay:p2p
  config_file=openresty-p2p.conf
  compose_file=compose-p2p.yaml
elif [ "$instance" = legacy ]; then
  host_conf=/usr/local/openresty/nginx/conf/conf.d/openctrlc-remote.quniv.cn.conf
  relay=/home/pon/openctrlc-remote
  project=openctrlc-remote
  container=openctrlc-remote-relay
  host_port=4097
  hostname=openctrlc-remote.quniv.cn
  image=openctrlc/remote-relay:local
  config_file=openresty.conf
  compose_file=compose.yaml
else
  echo "OPENCTRLC_RELAY_INSTANCE must be legacy or p2p" >&2
  exit 2
fi
compose=$relay/infra/remote-relay/compose.yaml
openresty=1Panel-openresty-vH9J
managed_marker=$relay/.managed-by-openctrlc-remote
temp=$(mktemp -d)
trap 'rm -rf "$temp"' EXIT HUP INT TERM

run_compose() {
  docker compose --project-name "$project" --project-directory "$relay" -f "$compose" "$@"
}

if [ ! -f "$root/infra/remote-relay/$compose_file" ] || [ ! -f "$root/infra/remote-relay/$config_file" ]; then
  echo "Repository root not found: $root" >&2
  exit 1
fi
if [ "$mode" != full ] && [ "$mode" != --config-only ] && [ "$mode" != --allow-session-reset ]; then
  echo "Usage: OPENCTRLC_RELAY_INSTANCE=legacy|p2p sh infra/remote-relay/deploy.sh [--config-only|--allow-session-reset]" >&2
  exit 2
fi
if [ "$mode" = --config-only ] && [ "$#" -ne 1 ]; then
  echo "Usage: sh infra/remote-relay/deploy.sh [--config-only]" >&2
  exit 2
fi
if [ "$mode" = --allow-session-reset ] && [ "$#" -ne 1 ]; then
  echo "Usage: sh infra/remote-relay/deploy.sh [--allow-session-reset]" >&2
  exit 2
fi
if [ "$instance" = p2p ] && [ "$mode" != --config-only ] && ! command -v ss >/dev/null 2>&1; then
  echo "ss is required to verify that the P2P listener ports are available" >&2
  exit 1
fi
if [ "$mode" = full ] && ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to validate Relay persistence health during deployment" >&2
  exit 1
fi

if [ -e "$relay" ] && [ ! -f "$managed_marker" ]; then
  echo "Refusing to use an existing unmarked directory: $relay" >&2
  exit 1
fi
if [ -L "$relay/data" ]; then
  echo "Refusing a symlinked Relay data directory: $relay/data" >&2
  exit 1
fi
if [ -L "$relay/data/remote-sessions.json" ]; then
  echo "Refusing a symlinked Relay session state file: $relay/data/remote-sessions.json" >&2
  exit 1
fi

if docker inspect "$container" >/dev/null 2>&1; then
  label=$(docker inspect "$container" --format '{{ index .Config.Labels "com.docker.compose.project" }}')
  if [ "$label" != "$project" ]; then
    echo "Container name $container is already owned by another deployment" >&2
    exit 1
  fi
  if [ "$mode" != --config-only ] && [ "$mode" != --allow-session-reset ] && [ "$(docker inspect "$container" --format '{{.State.Running}}')" = true ]; then
    current_health=$(curl --fail --silent --max-time 5 "http://127.0.0.1:$host_port/healthz" || true)
    if [ -z "$current_health" ]; then
      echo "Refusing full Relay deployment: the running Relay's session state cannot be verified. Inspect it or explicitly use --allow-session-reset after confirming the disruption." >&2
      exit 1
    fi
    if ! current_sessions=$(printf '%s' "$current_health" | jq -er 'select(.ok == true) | .sessions | select(type == "number")' 2>/dev/null); then
      echo "Refusing full Relay deployment: the running Relay returned an unrecognized health snapshot. Inspect it or explicitly use --allow-session-reset after confirming the disruption." >&2
      exit 1
    fi
    if [ "$current_sessions" -gt 0 ]; then
      persistence_ready=false
      if [ -f "$relay/data/remote-sessions.json" ] && [ -s "$relay/data/remote-sessions.json" ] && \
        printf '%s' "$current_health" | jq -e '.persistence.enabled == true and .persistence.errors == 0 and .persistence.pending == false' >/dev/null 2>&1; then
        last_saved_at=$(printf '%s' "$current_health" | jq -er '.persistence.lastSavedAt | select(type == "number" and . > 0)' 2>/dev/null || true)
        current_viewers=$(printf '%s' "$current_health" | jq -er '.usage.authorizedBrowsers | select(type == "number")' 2>/dev/null || true)
        if [ -n "$last_saved_at" ] && [ -n "$current_viewers" ] && \
          jq -e --argjson expected_sessions "$current_sessions" --argjson expected_viewers "$current_viewers" --argjson last_saved_at "$last_saved_at" '
            .version == 1 and
            .savedAt == $last_saved_at and
            (.sessions | type == "array" and length == $expected_sessions) and
            ([.sessions[].id] | unique | length == $expected_sessions) and
            ([.sessions[] | select(
              (.id | type == "string" and length > 0) and
              (.hostToken | type == "string" and length > 0) and
              (.joinToken | type == "string" and length > 0) and
              (.viewers | type == "array")
            )] | length == $expected_sessions) and
            ([.sessions[].viewers[]? | select(
              (.token | type == "string" and length > 0) and
              (.id | type == "string" and length > 0) and
              (.expiresAt | type == "number" and . > 0)
            )] | length == $expected_viewers)
            and ([.sessions[].viewers[]?.token] | unique | length == $expected_viewers)
          ' "$relay/data/remote-sessions.json" >/dev/null 2>&1; then
          persistence_ready=true
        fi
      fi
      if [ "$persistence_ready" != true ]; then
        echo "Refusing full Relay deployment: $current_sessions active session(s) have no verified persistent snapshot; restarting would lose their browser grants. Wait for the sessions to end or explicitly use --allow-session-reset after informing affected users." >&2
        exit 1
      fi
    fi
  fi
fi

if ! docker exec "$openresty" true >/dev/null 2>&1; then
  echo "OpenResty container is not running: $openresty" >&2
  exit 1
fi
docker exec "$openresty" openssl x509 -in /www/sites/quniv.cn/ssl/fullchain.pem -noout -checkhost "$hostname" >/dev/null

if [ "$mode" != --config-only ] && command -v ss >/dev/null 2>&1; then
  relay_running=false
  if docker inspect "$container" >/dev/null 2>&1 && [ "$(docker inspect "$container" --format '{{.State.Running}}')" = true ]; then
    relay_running=true
  fi
  if [ "$relay_running" != true ] && ss -H -ltn "sport = :$host_port" | grep -q .; then
    echo "Refusing deployment: TCP port $host_port is already in use on the host" >&2
    exit 1
  fi
  if [ "$instance" = p2p ]; then
    stun_running=$(docker ps --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=stun' --format '{{.ID}}')
    if [ -z "$stun_running" ] && ss -H -lun 'sport = :3478' | grep -q .; then
      echo "Refusing P2P deployment: UDP port 3478 is already in use on the host" >&2
      exit 1
    fi
  fi
fi

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
  docker cp "$root/infra/remote-relay/$config_file" "$openresty:/tmp/openctrlc-$instance.conf"
  docker exec -u root "$openresty" install -m 0644 "/tmp/openctrlc-$instance.conf" "$host_conf"
  if ! docker exec -u root "$openresty" nginx -t; then
    docker cp "$temp/existing.conf" "$openresty:/tmp/openctrlc-$instance.rollback.conf"
    docker exec -u root "$openresty" install -m 0644 "/tmp/openctrlc-$instance.rollback.conf" "$host_conf"
    docker exec -u root "$openresty" nginx -t
    exit 1
  fi
  if ! docker exec -u root "$openresty" nginx -s reload; then
    docker cp "$temp/existing.conf" "$openresty:/tmp/openctrlc-$instance.rollback.conf"
    docker exec -u root "$openresty" install -m 0644 "/tmp/openctrlc-$instance.rollback.conf" "$host_conf"
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
cp "$root/infra/remote-relay/$compose_file" "$compose"
cp "$root/infra/remote-relay/$config_file" "$relay/infra/remote-relay/$config_file"
run_compose build relay
docker run --rm --user 0:0 --volume "$relay/data:/data:rw" \
  --env "RELAY_UID=$relay_uid" --env "RELAY_GID=$relay_gid" \
  --entrypoint /bin/sh "$image" -ec '
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
run_compose up -d --no-build

healthy=false
for attempt in $(seq 1 30); do
  health=$(curl --fail --silent "http://127.0.0.1:$host_port/healthz" || true)
  if [ -n "$health" ] && printf '%s' "$health" | jq -e '.ok == true and .persistence.enabled == true and .persistence.errors == 0' >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done
if [ "$healthy" != true ]; then
  echo "Relay did not become healthy; OpenResty was not reloaded" >&2
  run_compose logs --tail=50 relay >&2
  exit 1
fi

peer_capabilities=$(curl --fail --silent --max-time 5 "http://127.0.0.1:$host_port/_remote/capabilities" || true)
peer_capability_check='.peerProtocol == 1 and (.iceConfigured | type == "boolean")'
if [ "$instance" = p2p ]; then
  peer_capability_check='.peerProtocol == 1 and .iceConfigured == true'
  stun_id=$(run_compose ps -q stun)
  if [ -z "$stun_id" ] || [ "$(docker inspect "$stun_id" --format '{{.State.Running}}')" != true ]; then
    echo "Self-hosted STUN service is not running; OpenResty was not reloaded" >&2
    run_compose logs --tail=50 stun >&2
    exit 1
  fi
  stun_ready=false
  for attempt in $(seq 1 15); do
    if ss -H -lun 'sport = :3478' | grep -q .; then
      stun_ready=true
      break
    fi
    sleep 1
  done
  if [ "$stun_ready" != true ]; then
    echo "Self-hosted STUN service is not listening on UDP 3478; OpenResty was not reloaded" >&2
    run_compose logs --tail=50 stun >&2
    exit 1
  fi
fi
if ! printf '%s' "$peer_capabilities" | jq -e "$peer_capability_check" >/dev/null; then
  echo "Relay peer capability endpoint did not report the expected protocol; OpenResty was not reloaded" >&2
  run_compose logs --tail=50 relay >&2
  exit 1
fi

had_conf=false
if docker exec "$openresty" test -e "$host_conf"; then
  had_conf=true
  docker cp "$openresty:$host_conf" "$temp/rollback.conf"
fi
docker cp "$root/infra/remote-relay/$config_file" "$openresty:/tmp/openctrlc-$instance.conf"
docker exec -u root "$openresty" install -m 0644 "/tmp/openctrlc-$instance.conf" "$host_conf"
if ! docker exec -u root "$openresty" nginx -t; then
  if [ "$had_conf" = true ]; then
    docker cp "$temp/rollback.conf" "$openresty:/tmp/openctrlc-$instance.rollback.conf"
    docker exec -u root "$openresty" install -m 0644 "/tmp/openctrlc-$instance.rollback.conf" "$host_conf"
    docker exec -u root "$openresty" nginx -t
  else
    docker exec -u root "$openresty" rm -f "$host_conf"
  fi
  exit 1
fi
if ! docker exec -u root "$openresty" nginx -s reload; then
  if [ "$had_conf" = true ]; then
    docker cp "$temp/rollback.conf" "$openresty:/tmp/openctrlc-$instance.rollback.conf"
    docker exec -u root "$openresty" install -m 0644 "/tmp/openctrlc-$instance.rollback.conf" "$host_conf"
  else
    docker exec -u root "$openresty" rm -f "$host_conf"
  fi
  docker exec -u root "$openresty" nginx -t
  docker exec -u root "$openresty" nginx -s reload
  exit 1
fi

run_compose ps
curl --fail --silent --show-error "http://127.0.0.1:$host_port/healthz"
rm -rf "$relay/packages/remote-relay.previous"

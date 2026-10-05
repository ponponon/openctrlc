#!/bin/sh
# Hourly Relay traffic collector + threshold alerts.
# Reads /home/pon/openctrlc-remote/monitor/monitor.env when present.
set -eu

health_url=${RELAY_HEALTH_URL:-http://127.0.0.1:4097/healthz}
data_dir=${RELAY_WATCH_DIR:-/home/pon/openctrlc-remote/logs}
state_file="$data_dir/relay-watch.state"
alerts_file="$data_dir/relay-alerts.log"
env_file=${RELAY_MONITOR_ENV:-/home/pon/openctrlc-remote/monitor/monitor.env}

if [ -f "$env_file" ]; then
  . "$env_file"
fi

umask 077

session_alert_threshold=${RELAY_SESSION_ALERT_THRESHOLD:-50}
host_out_alert_bytes=${RELAY_HOST_OUT_ALERT_BYTES:-524288000}
viewer_out_alert_bytes=${RELAY_VIEWER_OUT_ALERT_BYTES:-524288000}
# These are desktop-reported WebRTC endpoint counters, not TURN server NIC totals or quota enforcement.
turn_bytes_alert=${RELAY_TURN_PATH_BYTES_ALERT:-524288000}

mkdir -p "$data_dir"
chmod 0700 "$data_dir"
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
today=$(date -u +%Y-%m-%d)
traffic_file="$data_dir/relay-traffic-$today.jsonl"
for file in "$state_file" "$alerts_file" "$traffic_file"; do
  if [ -e "$file" ]; then
    chmod 0600 "$file"
  fi
done

notify_alert() {
  message=$1
  if [ -z "${RELAY_ALERT_QUEUE:-}" ] || [ -z "${RABBITMQ_USER:-}" ] || [ -z "${RABBITMQ_PASS:-}" ]; then
    return 0
  fi
  rabbit_host=${RABBITMQ_HOST:-127.0.0.1}
  rabbit_port=${RABBITMQ_PORT:-15672}
  encoded=$(printf '%s' "$message" | base64 | tr -d '\n')
  curl --fail --silent --max-time 5 \
    -u "$RABBITMQ_USER:$RABBITMQ_PASS" \
    -H 'content-type: application/json' \
    -X PUT "http://$rabbit_host:$rabbit_port/api/queues/%2f/$RELAY_ALERT_QUEUE" \
    -d '{"durable":true}' >/dev/null 2>&1 || true
  curl --fail --silent --max-time 5 \
    -u "$RABBITMQ_USER:$RABBITMQ_PASS" \
    -H 'content-type: application/json' \
    -X POST "http://$rabbit_host:$rabbit_port/api/exchanges/%2f/amq.default/publish" \
    -d "{\"properties\":{\"delivery_mode\":2},\"routing_key\":\"$RELAY_ALERT_QUEUE\",\"payload\":\"$encoded\",\"payload_encoding\":\"base64\"}" \
    >/dev/null 2>&1 || true
}

record_alert() {
  level=$1
  kind=$2
  detail=$3
  message=$4
  printf '%s %s %s %s\n' "$now" "$level" "$kind" "$detail" >>"$alerts_file"
  notify_alert "$(printf '{"level":"%s","kind":"%s","ts":"%s","detail":%s,"message":"%s"}' \
    "$level" "$kind" "$now" "$detail" "$message")"
}

payload=$(curl --fail --silent --show-error --max-time 5 "$health_url" || true)

if [ -z "$payload" ]; then
  printf '{"ts":"%s","error":"healthz unreachable"}\n' "$now" >>"$traffic_file"
  record_alert critical unreachable '{}' 'openctrlc relay healthz unreachable'
  echo "$now CRITICAL relay healthz unreachable"
  exit 1
fi

snapshot=$(printf '%s' "$payload" | jq -c '{sessions, usage, traffic, persistence}')
printf '{"ts":"%s","snapshot":%s}\n' "$now" "$snapshot" >>"$traffic_file"

sessions=$(printf '%s' "$payload" | jq -r '.sessions // 0')
connected_desktops=$(printf '%s' "$payload" | jq -r '.usage.connectedDesktops // 0')
authorized_browsers=$(printf '%s' "$payload" | jq -r '.usage.authorizedBrowsers // 0')
active_viewer_sockets=$(printf '%s' "$payload" | jq -r '.usage.activeViewerSockets // 0')
active_peer_signaling_sockets=$(printf '%s' "$payload" | jq -r '.usage.activePeerSignalingSockets // 0')
active_p2p_direct_peers=$(printf '%s' "$payload" | jq -r '.usage.activeP2PDirectPeers // "unknown"')
active_p2p_turn_peers=$(printf '%s' "$payload" | jq -r '.usage.activeP2PTurnPeers // "unknown"')
pending_viewer_requests=$(printf '%s' "$payload" | jq -r '.usage.pendingViewerRequests // 0')
pending_pairings=$(printf '%s' "$payload" | jq -r '.usage.pendingPairings // 0')
host_in=$(printf '%s' "$payload" | jq -r '.traffic.hostIn // 0')
host_out=$(printf '%s' "$payload" | jq -r '.traffic.hostOut // 0')
viewer_in=$(printf '%s' "$payload" | jq -r '.traffic.viewerIn // 0')
viewer_out=$(printf '%s' "$payload" | jq -r '.traffic.viewerOut // 0')
p2p_direct_bytes=$(printf '%s' "$payload" | jq -r '.traffic.p2pDirectBytes // 0')
p2p_turn_bytes=$(printf '%s' "$payload" | jq -r '.traffic.p2pTurnBytes // 0')
persistence_errors=$(printf '%s' "$payload" | jq -r '.persistence.errors // 0')
persistence_status=$(printf '%s' "$payload" | jq -r 'if (.persistence | type) != "object" or (.persistence | has("enabled") | not) then "unknown" elif .persistence.enabled == true then "enabled" elif .persistence.enabled == false then "disabled" else "unknown" end')

prev_host_out=0
prev_viewer_out=0
prev_p2p_direct_bytes=0
prev_p2p_turn_bytes=0
prev_persistence_errors=0
prev_persistence_status=missing
if [ -f "$state_file" ]; then
  prev_host_out=$(sed -n 's/^hostOut=//p' "$state_file" | tail -1)
  prev_viewer_out=$(sed -n 's/^viewerOut=//p' "$state_file" | tail -1)
  prev_p2p_direct_bytes=$(sed -n 's/^p2pDirectBytes=//p' "$state_file" | tail -1)
  prev_p2p_turn_bytes=$(sed -n 's/^p2pTurnBytes=//p' "$state_file" | tail -1)
  prev_persistence_errors=$(sed -n 's/^persistenceErrors=//p' "$state_file" | tail -1)
  prev_persistence_status=$(sed -n 's/^persistenceStatus=//p' "$state_file" | tail -1)
fi
prev_host_out=${prev_host_out:-0}
prev_viewer_out=${prev_viewer_out:-0}
prev_p2p_direct_bytes=${prev_p2p_direct_bytes:-0}
prev_p2p_turn_bytes=${prev_p2p_turn_bytes:-0}
prev_persistence_errors=${prev_persistence_errors:-0}
prev_persistence_status=${prev_persistence_status:-missing}

host_out_delta=$((host_out - prev_host_out))
viewer_out_delta=$((viewer_out - prev_viewer_out))
p2p_direct_bytes_delta=$((p2p_direct_bytes - prev_p2p_direct_bytes))
p2p_turn_bytes_delta=$((p2p_turn_bytes - prev_p2p_turn_bytes))
persistence_error_delta=$((persistence_errors - prev_persistence_errors))
[ "$host_out_delta" -lt 0 ] && host_out_delta=0
[ "$viewer_out_delta" -lt 0 ] && viewer_out_delta=0
[ "$p2p_direct_bytes_delta" -lt 0 ] && p2p_direct_bytes_delta=0
[ "$p2p_turn_bytes_delta" -lt 0 ] && p2p_turn_bytes_delta=0
[ "$persistence_error_delta" -lt 0 ] && persistence_error_delta=0

printf 'hostOut=%s\nviewerOut=%s\np2pDirectBytes=%s\np2pTurnBytes=%s\npersistenceErrors=%s\npersistenceStatus=%s\n' \
  "$host_out" "$viewer_out" "$p2p_direct_bytes" "$p2p_turn_bytes" "$persistence_errors" "$persistence_status" >"$state_file"

if [ "$sessions" -ge "$session_alert_threshold" ]; then
  record_alert warning sessions "{\"sessions\":$sessions,\"threshold\":$session_alert_threshold}" \
    "Relay session count reached $sessions"
fi

if [ "$host_out_delta" -ge "$host_out_alert_bytes" ]; then
  record_alert warning host-out "{\"delta\":$host_out_delta,\"total\":$host_out,\"threshold\":$host_out_alert_bytes}" \
    "Relay hostOut grew $host_out_delta bytes in one hour"
fi

if [ "$viewer_out_delta" -ge "$viewer_out_alert_bytes" ]; then
  record_alert warning viewer-out "{\"delta\":$viewer_out_delta,\"total\":$viewer_out,\"threshold\":$viewer_out_alert_bytes}" \
    "Relay viewerOut grew $viewer_out_delta bytes in one hour"
fi

if [ "$p2p_turn_bytes_delta" -ge "$turn_bytes_alert" ]; then
  record_alert warning turn-path-bytes "{\"delta\":$p2p_turn_bytes_delta,\"total\":$p2p_turn_bytes,\"threshold\":$turn_bytes_alert}" \
    "Desktop-reported TURN candidate-pair bytes grew $p2p_turn_bytes_delta in one hour"
fi

if [ "$persistence_status" != unknown ] && [ "$persistence_error_delta" -gt 0 ]; then
  record_alert critical persistence "{\"errors\":$persistence_errors,\"newErrors\":$persistence_error_delta}" \
    "Relay session state persistence failed"
fi

if [ "$persistence_status" = disabled ]; then
  record_alert critical persistence-disabled '{"enabled":false}' \
    "Relay session persistence is disabled"
fi

if [ "$persistence_status" = unknown ] && [ "$prev_persistence_status" != unknown ]; then
  record_alert warning persistence-unreported '{"status":"unknown"}' \
    "Relay healthz does not report persistence status; update the Relay to verify it"
fi

# Catch the upstream OpenCode shell being served instead of embedded OpenCtrlC UI.
ui_probe=${RELAY_UI_PROBE_URL:-}
if [ -n "$ui_probe" ]; then
  ui_mode=$(curl --fail --silent --max-time 5 -D - -o /dev/null "$ui_probe" | awk -F': ' 'tolower($1)=="x-openctrlc-ui"{print $2}' | tr -d '\r' | tail -1)
  if [ -n "$ui_mode" ] && [ "$ui_mode" != "embedded" ]; then
    record_alert critical remote-ui "{\"ui\":\"$ui_mode\"}" "Remote UI source is $ui_mode, expected embedded OpenCtrlC UI"
  fi
fi

echo "$now collected sessions=$sessions connectedDesktops=$connected_desktops authorizedBrowsers=$authorized_browsers activeViewerSockets=$active_viewer_sockets activePeerSignalingSockets=$active_peer_signaling_sockets activeP2PDirectPeers=$active_p2p_direct_peers activeP2PTurnPeers=$active_p2p_turn_peers pendingViewerRequests=$pending_viewer_requests pendingPairings=$pending_pairings hostIn=$host_in hostOut=$host_out viewerIn=$viewer_in viewerOut=$viewer_out p2pDirectEndpointBytes=$p2p_direct_bytes p2pTurnEndpointBytes=$p2p_turn_bytes hostOutDelta=$host_out_delta viewerOutDelta=$viewer_out_delta p2pTurnEndpointBytesDelta=$p2p_turn_bytes_delta persistenceStatus=$persistence_status persistenceErrors=$persistence_errors"

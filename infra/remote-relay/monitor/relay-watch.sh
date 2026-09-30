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

session_alert_threshold=${RELAY_SESSION_ALERT_THRESHOLD:-50}
host_out_alert_bytes=${RELAY_HOST_OUT_ALERT_BYTES:-524288000}
viewer_out_alert_bytes=${RELAY_VIEWER_OUT_ALERT_BYTES:-524288000}

mkdir -p "$data_dir"
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
today=$(date -u +%Y-%m-%d)
traffic_file="$data_dir/relay-traffic-$today.jsonl"

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

printf '{"ts":"%s","snapshot":%s}\n' "$now" "$payload" >>"$traffic_file"

sessions=$(printf '%s' "$payload" | jq -r '.sessions // 0')
host_in=$(printf '%s' "$payload" | jq -r '.traffic.hostIn // 0')
host_out=$(printf '%s' "$payload" | jq -r '.traffic.hostOut // 0')
viewer_in=$(printf '%s' "$payload" | jq -r '.traffic.viewerIn // 0')
viewer_out=$(printf '%s' "$payload" | jq -r '.traffic.viewerOut // 0')

prev_host_out=0
prev_viewer_out=0
if [ -f "$state_file" ]; then
  prev_host_out=$(sed -n 's/^hostOut=//p' "$state_file" | tail -1)
  prev_viewer_out=$(sed -n 's/^viewerOut=//p' "$state_file" | tail -1)
fi
prev_host_out=${prev_host_out:-0}
prev_viewer_out=${prev_viewer_out:-0}

host_out_delta=$((host_out - prev_host_out))
viewer_out_delta=$((viewer_out - prev_viewer_out))
[ "$host_out_delta" -lt 0 ] && host_out_delta=0
[ "$viewer_out_delta" -lt 0 ] && viewer_out_delta=0

printf 'hostOut=%s\nviewerOut=%s\n' "$host_out" "$viewer_out" >"$state_file"

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

echo "$now collected sessions=$sessions hostIn=$host_in hostOut=$host_out viewerIn=$viewer_in viewerOut=$viewer_out hostOutDelta=$host_out_delta viewerOutDelta=$viewer_out_delta"

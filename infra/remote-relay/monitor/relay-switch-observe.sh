#!/bin/sh
# Compare the official Relay's retained-session count around the manual
# "a failing custom relay must not fall back" acceptance step in docs/release.md.
# Usage:
#   RELAY_SSH_TARGET=user@relay-host relay-switch-observe.sh snapshot
#   ... run the failing-relay start attempt on the packaged desktop ...
#   RELAY_SSH_TARGET=user@relay-host relay-switch-observe.sh compare
# Or against a directly reachable healthz URL (the relay host itself):
#   relay-switch-observe.sh snapshot --healthz http://127.0.0.1:4097/healthz
# Public /healthz returns 404 by design, so use RELAY_SSH_TARGET or run on the host.
set -eu

state_file="${TMPDIR:-/tmp}/openctrlc-relay-switch-snapshot.json"
healthz="http://127.0.0.1:4097/healthz"
action=""

while [ $# -gt 0 ]; do
  case "$1" in
    snapshot | compare)
      action=$1
      shift
      ;;
    --healthz)
      healthz=$2
      shift 2
      ;;
    *)
      echo "unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [ -z "$action" ]; then
  echo "usage: relay-switch-observe.sh snapshot|compare [--healthz URL]" >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

fetch() {
  if [ -n "${RELAY_SSH_TARGET:-}" ]; then
    ssh "$RELAY_SSH_TARGET" "curl -fsS http://127.0.0.1:4097/healthz"
  else
    curl -fsS "$healthz"
  fi
}

summarize() {
  jq -c '{sessions, desktops: (.usage.connectedDesktops // 0), browsers: (.usage.authorizedBrowsers // 0)}'
}

capture() {
  if ! json=$(fetch); then
    echo "could not read relay healthz (set RELAY_SSH_TARGET or --healthz; public /healthz returns 404 by design)" >&2
    exit 1
  fi
  printf '%s' "$json" | summarize
}

is_count() {
  case "$1" in
    '' | *[!0-9]*) return 1 ;;
    *) return 0 ;;
  esac
}

case "$action" in
  snapshot)
    summary=$(capture)
    printf '{"capturedAt":"%s","summary":%s}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$summary" >"$state_file"
    echo "baseline saved to $state_file"
    printf '%s' "$summary" | jq -r '"  sessions=\(.sessions) connectedDesktops=\(.desktops) authorizedBrowsers=\(.browsers)"'
    echo "now run the failing-relay start attempt on the packaged desktop, then run compare."
    ;;
  compare)
    if [ ! -f "$state_file" ]; then
      echo "no baseline at $state_file; run snapshot first" >&2
      exit 1
    fi
    previous=$(jq -r '.summary.sessions' "$state_file")
    if ! is_count "$previous"; then
      echo "baseline at $state_file has no session count; run snapshot again" >&2
      exit 1
    fi
    summary=$(capture)
    current=$(printf '%s' "$summary" | jq -r '.sessions')
    if ! is_count "$current"; then
      echo "relay healthz returned no session count" >&2
      exit 1
    fi
    delta=$((current - previous))
    echo "baseline: $(jq -r '.capturedAt' "$state_file")  sessions=$previous"
    echo "current:  sessions=$current (delta $delta)"
    printf '%s' "$summary" | jq -r '"  connectedDesktops=\(.desktops) authorizedBrowsers=\(.browsers)"'
    if [ "$delta" -le 0 ]; then
      echo "PASS: no new sessions appeared during the window, so no fallback to the official relay was observed."
      echo "note: a concurrent public user could also raise this count; PASS only means no increase happened."
    else
      echo "FAIL: sessions increased by $delta during the window."
      echo "If the window only contained the failing-relay test, the desktop fell back to the official relay;"
      echo "do not publish the change. Exclude unrelated public-user sessions before concluding."
      exit 1
    fi
    ;;
esac

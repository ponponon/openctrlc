#!/bin/sh
# Smoke-check the remote stack after a desktop or relay change.
# Usage:
#   remote-smoke.sh --public https://openctrlc-remote.quniv.cn
#   remote-smoke.sh --public https://openctrlc-remote.quniv.cn --cookie 'name=value'
#   remote-smoke.sh --healthz http://127.0.0.1:4097/healthz
set -eu

public=""
healthz="http://127.0.0.1:4097/healthz"
cookie=""

while [ $# -gt 0 ]; do
  case "$1" in
    --public)
      public=$2
      shift 2
      ;;
    --healthz)
      healthz=$2
      shift 2
      ;;
    --cookie)
      cookie=$2
      shift 2
      ;;
    *)
      echo "unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

public=${public%/}

fail=0
ok() {
  echo "PASS  $1"
}
bad() {
  echo "FAIL  $1"
  fail=1
}
curl_public() {
  if [ -n "$cookie" ]; then
    curl --fail --silent --show-error --max-time 20 -H "Cookie: $cookie" "$@"
    return
  fi
  curl --fail --silent --show-error --max-time 20 "$@"
}

# 1) healthz reports sessions and traffic shape
if [ -n "$healthz" ]; then
  snap=$(curl --fail --silent --max-time 5 "$healthz" || true)
  if [ -z "$snap" ]; then
    bad "healthz unreachable ($healthz)"
  else
    echo "$snap" | jq -e '.ok == true and (.traffic | type == "object") and (.persistence | type == "object")' >/dev/null \
      && ok "healthz payload" \
      || bad "healthz payload missing ok/traffic/persistence"
  fi
fi

# 2) public UI must be the embedded OpenCtrlC shell when a cookie is available
if [ -z "$public" ]; then
  echo "skip  public UI checks (pass --public URL)"
  exit "$fail"
fi

ui_headers=$(curl_public -D - -o /dev/null "$public/" || true)
ui_mode=$(printf '%s' "$ui_headers" | awk -F': ' 'tolower($1)=="x-openctrlc-ui"{print $2}' | tr -d '\r' | tail -1)
if [ "$ui_mode" = "embedded" ]; then
  ok "UI source is embedded"
elif [ "$ui_mode" = "upstream" ]; then
  bad "UI source is upstream app.opencode.ai (remote workspace restore will not run)"
else
  echo "skip  UI source header missing (page is likely pair/bootstrap without app shell)"
fi

# 3) public Relay must expose its peer capability endpoint without viewer credentials
peer_capabilities=$(curl --fail --silent --show-error --max-time 5 "$public/_remote/capabilities" || true)
if [ -z "$peer_capabilities" ]; then
  bad "peer capability endpoint unreachable or unauthorized"
elif printf '%s' "$peer_capabilities" | jq -e '.peerProtocol == 1 and (.iceConfigured | type == "boolean")' >/dev/null; then
  if [ "$(printf '%s' "$peer_capabilities" | jq -r '.iceConfigured')" = "true" ]; then
    ok "peer capability endpoint and ICE configured"
  else
    ok "peer capability endpoint available; ICE is not configured (Relay fallback remains active)"
  fi
else
  bad "peer capability endpoint returned an unsupported payload"
fi

# 4) app shell JS must contain the OpenCtrlC workspace key
html=$(curl_public "$public/" || true)
js_path=$(printf '%s' "$html" | sed -n 's/.*src="\(\/assets\/[^"]*\.js\)".*/\1/p' | head -1)
if [ -n "$js_path" ]; then
  js_hit=$(curl_public "$public$js_path" | grep -c "openctrlc.remote-workspace" || true)
  if [ "$js_hit" -gt 0 ]; then
    ok "app JS contains openctrlc.remote-workspace"
  else
    bad "app JS missing openctrlc.remote-workspace ($js_path)"
  fi
else
  echo "skip  app JS not referenced (pair/bootstrap page or unauthorized)"
fi

exit "$fail"

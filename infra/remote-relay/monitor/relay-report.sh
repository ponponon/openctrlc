#!/bin/sh
# Summarize relay-traffic-YYYY-MM-DD.jsonl produced by relay-watch.sh.
# Usage: relay-report.sh [YYYY-MM-DD]
set -eu

data_dir=${RELAY_WATCH_DIR:-/home/pon/openctrlc-remote/logs}
day=${1:-$(date -u +%Y-%m-%d)}
file="$data_dir/relay-traffic-$day.jsonl"

if [ ! -f "$file" ]; then
  echo "No traffic log for $day at $file" >&2
  exit 1
fi

alerts_file="$data_dir/relay-alerts.log"

echo "Relay traffic report $day"
echo "samples: $(wc -l <"$file" | tr -d ' ')"
echo

jq -s '
  map(select(.snapshot))
  | if length == 0 then
      {note:"no snapshots"}
    else
      {
        samples: length,
        sessions_max: (map(.snapshot.sessions // 0) | max),
        sessions_avg: (map(.snapshot.sessions // 0) | add / length | floor),
        hostIn_total: (map(.snapshot.traffic.hostIn // 0) | max),
        hostOut_total: (map(.snapshot.traffic.hostOut // 0) | max),
        viewerIn_total: (map(.snapshot.traffic.viewerIn // 0) | max),
        viewerOut_total: (map(.snapshot.traffic.viewerOut // 0) | max),
        peak: (max_by(.snapshot.traffic.hostOut + .snapshot.traffic.viewerOut)
          | {ts, sessions: .snapshot.sessions,
             hostOut: .snapshot.traffic.hostOut,
             viewerOut: .snapshot.traffic.viewerOut})
      }
    end
' "$file"

echo
if [ -f "$alerts_file" ] && grep -q "^$day" "$alerts_file" 2>/dev/null; then
  echo "alerts on $day:"
  grep "^$day" "$alerts_file"
else
  echo "alerts on $day: none"
fi

echo
echo "hourly sessions / hostOut / viewerOut:"
jq -r 'select(.snapshot) | [.ts, (.snapshot.sessions // 0), (.snapshot.traffic.hostOut // 0), (.snapshot.traffic.viewerOut // 0)] | @tsv' "$file" \
  | awk 'BEGIN{print "ts\tsessions\thostOut\tviewerOut"} {print}'

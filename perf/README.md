# Local performance diagnostics

Run these scripts from the repository root against a development desktop with CDP enabled on 127.0.0.1:9222.

## Safety defaults

- Scripts omit prompt text, transcript bodies, local-storage keys/values, session IDs, credentials, and URL query values from output.
- inspect-renderer.mjs captures a screenshot only with --screenshot; screenshots may contain visible conversation content.
- capture-network.mjs, capture-errors.mjs, and watch-module-load.mjs observe the current page. Pass --reload only when it is safe to reload.
- measure-session-load.mjs reloads only with --reload.
- probe-sidecar.mjs uses the session currently open in the renderer and hides its identifier.
- probe-session-list.mjs uses the current working directory by default. Optional directory arguments are sent to the local sidecar but are not printed.
- Cold-start scripts require ports 9222 and 5173 to be free. They fail closed if a port is occupied, never connect to or reload an existing renderer, and only terminate the isolated process group they started.
- Measurement JSON is written only to /tmp and contains timing/DOM-size summaries, not transcript or startup-log text.

These scripts use the local renderer's authenticated sidecar context. Keep the CDP listener bound to loopback and do not expose port 9222 to the network.

## Commands

| Script                                               | Purpose                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| node perf/measure-cold-start.mjs [--warm] [--keep]   | Measure a full desktop cold start; optionally also measure a warm reload. |
| node perf/measure-desktop-boot.mjs [--keep]          | Measure desktop launch through renderer readiness.                        |
| node perf/measure-sidecar-ready.mjs                  | Separate sidecar HTTP readiness from desktop launch time.                 |
| node perf/measure-session-load.mjs [--reload]        | Measure the current renderer's session restore.                           |
| node perf/probe-session-list.mjs [directory ...]     | Compare serial and concurrent session-list calls.                         |
| node perf/probe-sidecar.mjs                          | Measure local sidecar endpoints for the current page/session.             |
| node perf/diagnose-sync.mjs                          | Measure event-stream delivery and inspect skeleton/timeline state.        |
| node perf/capture-network.mjs [seconds] [--reload]   | Capture a coarse request waterfall.                                       |
| node perf/capture-errors.mjs [seconds] [--reload]    | Count failed requests and renderer error classes.                         |
| node perf/cold-request-log.mjs [seconds]             | Observe early requests after a fresh renderer appears.                    |
| node perf/watch-module-load.mjs [seconds] [--reload] | Observe module loading and skeleton duration.                             |
| node perf/inspect-renderer.mjs [--screenshot]        | Inspect renderer structure without reading stored values or page text.    |

`probe-session-reads.mjs` measures the V2 and legacy session detail/message endpoints for the session already open in the renderer. It reads response byte counts only, caps each body at 4 MiB, and times out each request after 12 seconds. It does not inspect local storage or print the active session route.

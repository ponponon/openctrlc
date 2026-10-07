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
| node perf/capture-network.mjs [seconds] [--reload]   | Capture request-header and full-body timings without reading response bodies. |
| node perf/capture-errors.mjs [seconds] [--reload]    | Count failed requests and renderer error classes.                         |
| node perf/cold-request-log.mjs [seconds]             | Observe early requests after a fresh renderer appears.                    |
| node perf/watch-module-load.mjs [seconds] [--reload] | Observe module loading and skeleton duration.                             |
| node perf/inspect-renderer.mjs [--screenshot]        | Inspect renderer structure without reading stored values or page text.    |

`probe-session-reads.mjs` measures the current desktop session's V2 detail and one-message page, falling back to V1 only when V2 returns 404. Desktop uses `MemoryRouter`, so the probe resolves its per-window remembered route inside the renderer; the session ID and credentials never leave the renderer or appear in output. Message response reading stops at 512 KiB, and each request has a 12-second timeout. This checks local server endpoint latency and payload size; it does not measure end-to-end browser-to-Relay latency.

`capture-network.mjs` observes the current renderer without reloading it by default. It distinguishes time to response headers from time to the fully received response and reports encoded byte counts from CDP, so a slow body transfer is not mistaken for a fast endpoint. It never reads response bodies or prints request query values.

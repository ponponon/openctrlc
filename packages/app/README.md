# OpenCtrlC application UI

This package contains the shared SolidJS application UI used by the OpenCtrlC
desktop client and browser-based development flows. It owns session views,
review panels, the terminal interface, settings, and the client-side i18n
resources.

## Local development

Install dependencies from the repository root, then start the UI and the local
OpenCtrlC backend in separate terminals:

```bash
bun run --cwd packages/opencode dev serve
bun run --cwd packages/app dev
```

The Vite development server is available at <http://localhost:3000/>. The
Playwright configuration starts this server automatically for browser tests.

## Checks

```bash
bun run --cwd packages/app typecheck
bun run --cwd packages/app test:unit
bun run --cwd packages/app test:browser
bun run --cwd packages/app test:e2e:local
```

Useful test options include `PLAYWRIGHT_SERVER_HOST`,
`PLAYWRIGHT_SERVER_PORT`, `PLAYWRIGHT_PORT`, `PLAYWRIGHT_BASE_URL`, and
`PLAYWRIGHT_WORKERS`.

## Relationship to the desktop client

`packages/desktop` wraps this UI in Electron and supplies native menus,
window management, updates, and the packaged CLI sidecar. Changes that affect
both browser and desktop behavior should be checked in the UI package first,
then validated through the desktop package's typecheck and packaging scripts.

# OpenCtrlC enterprise package

This package contains the enterprise deployment surface for OpenCtrlC,
including its server-facing routes, shared session UI, and Cloudflare
deployment entrypoint. It is kept separate from the public marketing site and
the local desktop client.

## Development

From the repository root:

```bash
bun install
bun run --cwd packages/enterprise dev
```

## Checks and builds

```bash
bun run --cwd packages/enterprise typecheck
bun run --cwd packages/enterprise build
bun run --cwd packages/enterprise build:cloudflare
```

The package is an internal deployment target. Public product downloads and
documentation are maintained by `packages/console/app` and `packages/web`.

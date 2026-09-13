# OpenCtrlC runtime

This package contains the OpenCtrlC CLI runtime, server, configuration, and
TUI entrypoints. The directory name `packages/opencode` is retained as an
internal compatibility path; the installed command and product name are
`openctrlc`.

## Development

From the repository root:

```bash
bun install
bun run --cwd packages/opencode dev
```

Run the headless API server with:

```bash
bun run --cwd packages/opencode dev serve
```

## Checks and build

```bash
bun run --cwd packages/opencode typecheck
bun run --cwd packages/opencode test
bun run --cwd packages/opencode build
```

The standalone build writes platform archives to `packages/opencode/dist/`.
For the complete cross-platform release process, see
[`docs/release.md`](../../docs/release.md).

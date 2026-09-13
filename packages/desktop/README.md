# OpenCtrlC Desktop

The native OpenCtrlC desktop client, built with Electron. It wraps the shared
application UI, starts the local runtime, and packages a matching CLI sidecar
for each supported platform.

## Development

```bash
bun install
bun run --cwd packages/desktop dev
```

## Build

Run `build` to compile the renderer and main-process assets, then `package` to
bundle an installable application. The resulting artifacts are written to
`dist/`.

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

Platform-specific packaging commands are available for macOS, Windows, and
Linux:

```bash
bun run --cwd packages/desktop package:mac
bun run --cwd packages/desktop package:win
bun run --cwd packages/desktop package:linux
```

Before packaging, run the icon contract check:

```bash
bun run --cwd packages/desktop check:icons -- --resources
```

The release workflow produces x64 and ARM64 desktop artifacts for Windows and
Linux, plus the supported macOS targets. See the public
[download page](https://openctrlc.pages.dev/download/) for the current
release assets.

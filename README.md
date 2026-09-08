<h1 align="center">OpenCtrlC</h1>

<p align="center">The open source AI coding agent.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/openctrlc-ai"><img alt="npm" src="https://img.shields.io/npm/v/openctrlc-ai?style=flat-square" /></a>
  <a href="https://github.com/ponponon/openctrlc/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/ponponon/openctrlc/publish.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a>
</p>

OpenCtrlC is an open-source AI coding agent for terminal and desktop workflows.
It helps you explore a codebase, edit files, run commands, and review changes
with the model and tools you choose.

## Installation

```bash
# Direct install
curl -fsSL https://openctrlc.ai/install | bash

# Package managers
npm i -g openctrlc-ai@latest       # or bun/pnpm/yarn
scoop install openctrlc            # Windows
choco install openctrlc            # Windows
brew install openctrlc             # macOS and Linux
sudo pacman -S openctrlc            # Arch Linux
mise use -g openctrlc               # Any OS
nix run github:ponponon/openctrlc
```

> [!TIP]
> The latest stable CLI release is `v0.1.3`. Development builds may include
> features that have not been published in a stable release yet.

## What you can do today

The current `dev` branch includes the following OpenCtrlC capabilities:

- **Terminal and Desktop workflows**: use the CLI/TUI or the Electron Desktop
  app with the same local project and session model.
- **Transparent Skills**: inspect project-available Skills, their source
  directories, the runtime protocol, and Skills activated in the current
  session.
- **Session context inspection**: view the effective System Prompt, inspect
  context usage, and copy the complete prompt for debugging.
- **Session navigation**: search within a session, jump between turns, and
  collapse completed turns or their detailed activities.
- **Session export**: export JSON, readable Markdown, or a full Markdown
  transcript containing execution details.
- **OpenCode session import**: import an existing OpenCode session by ID while
  preserving its messages and project directory.
- **Desktop conveniences**: open the export directory from a Desktop toast and
  copy session IDs through the native clipboard bridge.

## Why OpenCtrlC?

OpenCtrlC is an independent fork of [OpenCode](https://github.com/anomalyco/opencode).

OpenCode provided a strong foundation for terminal-based AI-assisted development,
including agents, tools, providers, sessions, and local server workflows. OpenCtrlC
builds on that foundation because the core architecture is worth continuing, while
the product experience should be driven by the people who use it.

OpenCtrlC was created after repeated user-focused improvements and human-friendly
feature proposals were not accepted upstream. Instead of waiting for changes that
may never land, OpenCtrlC gives the project an independent direction and a faster
path from idea to implementation.

OpenCtrlC is maintained independently. It is not affiliated with or endorsed by
the OpenCode team.

## Roadmap

The next improvements are focused on making AI-assisted development more
predictable for everyday use and for workflows that run unattended:

- **Token speed visibility**: show output token speed and useful live model
  performance information directly in the interface.
- **Unattended automation**: provide explicit permission policies for tasks that
  need to continue without manual approval.
- **Goal mode**: add a goal-oriented workflow with a clear target, plan,
  execution loop, and completion state.
- **Prompt presets**: save and reuse common instructions and workflows.
- **Cross-session history search**: search previous sessions by title, project,
  prompt, and relevant content.
- **Cross-platform Desktop releases**: extend the automated signed release
  pipeline beyond the current macOS Apple Silicon target.

## CLI release

OpenCtrlC `v0.1.3` is available from the
[GitHub Release](https://github.com/ponponon/openctrlc/releases/tag/v0.1.3).
The release contains platform-specific CLI/TUI archives for macOS, Linux, and
Windows. Each archive contains one `openctrlc` executable for its target platform.

## Desktop app

The Electron Desktop app can be run locally from a checkout:

```bash
bun run dev:desktop
```

The current GitHub Actions release workflow builds, signs, and notarizes macOS
Apple Silicon (`arm64`) DMG/ZIP artifacts. Windows and Linux Desktop installers
are not currently published by the automated release workflow.

### Local macOS packaging

From the project root, this command builds the Desktop app, creates a native
`.app`, installs it to `/Applications/OpenCtrlC.app`, and launches it:

```bash
bun run desktop:mac
```

The default channel is `dev`. Build without installing, or select another channel:

```bash
bun run desktop:mac -- --no-install --no-open
bun run desktop:mac -- --channel=prod --no-open
```

To create a DMG/ZIP for distribution:

```bash
OPENCTRLC_CHANNEL=prod bun run --cwd packages/desktop package:mac
```

### Installation directory

The install script respects the following priority order for the installation path:

1. `$OPENCTRLC_INSTALL_DIR` - Custom installation directory
2. `$XDG_BIN_DIR` - XDG Base Directory Specification compliant path
3. `$HOME/bin` - Standard user binary directory (if it exists or can be created)
4. `$HOME/.openctrlc/bin` - Default fallback

```bash
# Examples
OPENCTRLC_INSTALL_DIR=/usr/local/bin curl -fsSL https://openctrlc.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://openctrlc.ai/install | bash
```

## Agents

OpenCtrlC includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

The **general** subagent is also available for complex searches and multistep
tasks. It can be invoked using `@general` in messages.

Learn more in the [OpenCtrlC agent documentation](https://openctrlc.ai/docs/agents).

## Development

OpenCtrlC uses [Bun](https://bun.sh) for its workspace and scripts. After cloning
the repository, install dependencies and start the CLI or Desktop app with:

```bash
bun install
bun run dev
bun run dev:desktop
```

## Documentation

For configuration and usage details, read the
[OpenCtrlC documentation](https://openctrlc.ai/docs).

## Contributing

If you're interested in contributing to OpenCtrlC, please read
[CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a pull request.

## Building on OpenCtrlC

If you are building an integration or extension for OpenCtrlC, please make its
relationship to this project clear and link to the relevant OpenCtrlC documentation.

---

**Project links** [GitHub](https://github.com/ponponon/openctrlc) |
[Issues](https://github.com/ponponon/openctrlc/issues)

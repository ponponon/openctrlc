<p align="center">
  <a href="https://openctrlc.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="OpenCtrlC logo">
    </picture>
  </a>
</p>
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

[![OpenCtrlC Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://openctrlc.ai)

---

### Installation

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
> The current stable CLI release is `0.1.1`.

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

## OpenCtrlC Roadmap

OpenCtrlC is focused on making AI-assisted development more predictable for
people who use it every day and for workflows that run unattended for long
periods. The following improvements are part of the product roadmap:

- **Token speed visibility**: show token generation speed and useful live model
  performance information directly in the interface.
- **Unattended automation**: provide explicit automation permission policies so a
  long-running task does not stop overnight because it needs a manual approval.
- **Goal mode**: add a Codex-style goal-oriented workflow for tasks that need a
  clear target, plan, execution loop, and completion state.
- **Prompt presets**: let users save and reuse common instructions and workflows
  without repeatedly typing the same prompts.
- **History search**: make previous sessions and conversations searchable by
  title, prompt, project, and relevant content.
- **Desktop forking**: support forking a Desktop conversation into a separate
  branch of work while preserving the original session.

These items describe planned OpenCtrlC improvements. They should not be read as
features already available in the current `v0.1.1` release.

## CLI Release

OpenCtrlC `v0.1.1` is available from the
[GitHub Release](https://github.com/ponponon/openctrlc/releases/tag/v0.1.1).
The release contains platform-specific CLI/TUI archives for macOS, Linux, and
Windows. Each archive contains one `openctrlc` executable for its target platform.

### Desktop App (Development)

The Electron desktop app is currently available for local development. Start it
from a checkout with:

```bash
bun run dev:desktop
```

Packaged DMG, Windows, and Linux desktop installers will be published separately
once the cross-platform desktop release pipeline is enabled.

#### Installation Directory

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

### Agents

OpenCtrlC includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://opencode.ai/docs/agents).

### Documentation

For more info on how to configure OpenCtrlC, [**read the documentation**](https://openctrlc.ai/docs).

### Contributing

If you're interested in contributing to OpenCtrlC, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on OpenCtrlC

If you are building an integration or extension for OpenCtrlC, please make its
relationship to this project clear and link to the relevant OpenCtrlC documentation.

---

**Project links** [GitHub](https://github.com/ponponon/openctrlc) | [Issues](https://github.com/ponponon/openctrlc/issues)

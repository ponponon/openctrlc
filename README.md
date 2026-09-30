<h1 align="center">OpenCtrlC</h1>

<p align="center">An open-source AI coding agent built on OpenCode, with a richer desktop and remote workflow.</p>

<p align="center">
  <a href="https://github.com/ponponon/openctrlc/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/ponponon/openctrlc/publish.yml?style=flat-square&branch=dev" /></a>
  <a href="https://github.com/ponponon/openctrlc/blob/dev/LICENSE"><img alt="License" src="https://img.shields.io/github/license/ponponon/openctrlc?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a>
</p>

OpenCtrlC is an independently maintained open-source fork of [OpenCode](https://github.com/anomalyco/opencode). We started this project to build on OpenCode's AI coding foundation and make it more comfortable for everyday work across a visual desktop app and remote access.

## Why build OpenCtrlC

OpenCode gives us a strong foundation for AI-assisted coding. OpenCtrlC extends that foundation with a product focus on desktop usability, clear session history, and working from more than one device:

- **A richer desktop workflow** — use a native app on macOS, Windows, or Linux, alongside the CLI and TUI. The desktop shares the local project and session model with the CLI, with session search, turn navigation, context inspection, and visual analysis of token usage, cost, and timing.
- **Phone access to your workspace** — pair with a QR code, approve the browser in the desktop app, and open the current workspace from your phone. The desktop connects outbound through a relay, so you do not need to expose a port on your computer. Relay traffic is not end-to-end encrypted; the relay operator can inspect content while forwarding it.
- **The coding workflow stays inspectable** — review tool calls, generated changes, and command results; choose the model provider or local model that fits your work; and keep project rules and Skills close to the code.
- **Bring compatible OpenCode sessions along** — export readable transcripts and import compatible sessions by ID.

OpenCode is the technical foundation; OpenCtrlC adds its own desktop experience, remote workflow, product direction, and release process. OpenCtrlC is not affiliated with or endorsed by the OpenCode team.

## Start here

- Website: [openctrlc.pages.dev](https://openctrlc.pages.dev/)
- Documentation: [openctrlc.pages.dev/docs](https://openctrlc.pages.dev/docs/)
- Downloads: [openctrlc.pages.dev/download](https://openctrlc.pages.dev/download/) · [GitHub Releases](https://github.com/ponponon/openctrlc/releases)
- Discussions: [GitHub Discussions](https://github.com/ponponon/openctrlc/discussions)

## Installation

### CLI / TUI

The install script detects the current operating system and architecture:

```bash
curl -fsSL https://raw.githubusercontent.com/ponponon/openctrlc/dev/install | bash
```

You can also install the CLI globally with npm (Node.js and npm required):

```bash
npm install -g openctrlc
```

To migrate from the former npm package name, run `npm uninstall -g openctrlc-ai` before installing `openctrlc`.

On macOS and Linux, you can also install through the project Homebrew tap:

```bash
brew install ponponon/tap/openctrlc
```

This formula is maintained in the OpenCtrlC tap and is separate from `homebrew/core`.

The installer respects `OPENCTRLC_INSTALL_DIR` and `XDG_BIN_DIR`. The default fallback is `$HOME/.openctrlc/bin`.

### Desktop

Download the latest desktop installer from the [OpenCtrlC download page](https://openctrlc.pages.dev/download/). Stable assets are served through the project's Cloudflare R2 mirror when available, with an automatic GitHub Release fallback.

| Platform | Architectures | Formats        |
| -------- | ------------- | -------------- |
| macOS    | Apple Silicon | DMG, ZIP       |
| Windows  | x64, ARM64    | NSIS installer |
| Linux    | x64, ARM64    | DEB, AppImage, RPM |

The desktop app and CLI use the same local project and session model. The desktop package includes a matching CLI binary for its target platform.

## Data and provider model

OpenCtrlC is a client application, not a hosted model service. The application runs locally and sends requests through the provider configuration you choose. Your provider's terms, retention policy, and pricing apply to those requests.

The optional sharing feature is explicit: only a conversation you choose to share is sent to the configured share service. Disable it in your project configuration when sharing is not appropriate.

## Development

OpenCtrlC uses [Bun](https://bun.sh) and a Bun workspace:

```bash
bun install
bun run dev
bun run dev:console
bun run dev:desktop
```

Useful checks for changes:

```bash
bun run --cwd packages/console/app typecheck
bun run --cwd packages/console/app build
bun run --cwd packages/web build
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a pull request. Release maintainers should also read [docs/release.md](./docs/release.md).

## License

OpenCtrlC is distributed under the [MIT License](./LICENSE).

---

**Project links:** [GitHub](https://github.com/ponponon/openctrlc) · [Issues](https://github.com/ponponon/openctrlc/issues) · [Discussions](https://github.com/ponponon/openctrlc/discussions)

<h1 align="center">OpenCtrlC</h1>

<p align="center">An open-source AI coding agent for terminal and desktop workflows.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/openctrlc-ai"><img alt="npm" src="https://img.shields.io/npm/v/openctrlc-ai?style=flat-square" /></a>
  <a href="https://github.com/ponponon/openctrlc/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/ponponon/openctrlc/publish.yml?style=flat-square&branch=dev" /></a>
  <a href="https://github.com/ponponon/openctrlc/blob/dev/LICENSE"><img alt="License" src="https://img.shields.io/github/license/ponponon/openctrlc?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a>
</p>

OpenCtrlC helps you explore a repository, understand unfamiliar code, edit
files, run commands, and review changes with the model providers you choose.
It is designed for people who want an AI coding workflow that stays close to
their terminal, project files, and existing tools.

## Start here

- Website: [openctrlc.pages.dev](https://openctrlc.pages.dev/)
- Documentation: [openctrlc.pages.dev/docs](https://openctrlc.pages.dev/docs/)
- Downloads: [GitHub Releases](https://github.com/ponponon/openctrlc/releases)
- Discussions: [GitHub Discussions](https://github.com/ponponon/openctrlc/discussions)

## Installation

### CLI / TUI

The install script detects the current operating system and architecture:

```bash
curl -fsSL https://raw.githubusercontent.com/ponponon/openctrlc/dev/install | bash
```

You can also install the npm package:

```bash
npm install --global openctrlc-ai
# or: bun add --global openctrlc-ai
```

The installer respects `OPENCTRLC_INSTALL_DIR` and `XDG_BIN_DIR`. The default
fallback is `$HOME/.openctrlc/bin`.

### Desktop

Download the latest desktop installer from [GitHub
Releases](https://github.com/ponponon/openctrlc/releases):

| Platform | Architectures | Formats |
| --- | --- | --- |
| macOS | Apple Silicon | DMG, ZIP |
| Windows | x64, ARM64 | NSIS installer |
| Linux | x64, ARM64 | DEB, AppImage, RPM |

The desktop app and CLI use the same local project and session model. The
desktop package includes a matching CLI binary for its target platform.

## What OpenCtrlC does

- **Terminal and desktop workflows** — work in a TUI or a native desktop app
  without changing your project layout.
- **Provider choice** — connect the model providers or local models that fit
  your workflow and security requirements.
- **Skills and project rules** — inspect available skills and keep project
  guidance close to the codebase.
- **Session navigation** — search sessions, jump between turns, and inspect
  the context used for a response.
- **Transparent output** — review tool calls, generated changes, and command
  results instead of treating the agent as a black box.
- **Session export and import** — export readable transcripts and import
  compatible OpenCode sessions by ID.
- **Cross-platform releases** — CLI and desktop builds are published for
  macOS, Windows, and Linux on both x64 and ARM64 where supported by the
  release workflow.

## Data and provider model

OpenCtrlC is a client application, not a hosted model service. The application
runs locally and sends requests through the provider configuration you choose.
Your provider's terms, retention policy, and pricing apply to those requests.

The optional sharing feature is explicit: only a conversation you choose to
share is sent to the configured share service. Disable it in your project
configuration when sharing is not appropriate.

## Relationship to OpenCode

OpenCtrlC is an independently maintained open-source fork of
[OpenCode](https://github.com/anomalyco/opencode). OpenCode provided a strong
technical foundation for terminal-based AI-assisted development; OpenCtrlC
continues that work with an independent product direction and release process.

OpenCtrlC is not affiliated with or endorsed by the OpenCode team.

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

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a pull request.
Release maintainers should also read [docs/release.md](./docs/release.md).

## License

OpenCtrlC is distributed under the [MIT License](./LICENSE).

---

**Project links:** [GitHub](https://github.com/ponponon/openctrlc) ·
[Issues](https://github.com/ponponon/openctrlc/issues) ·
[Discussions](https://github.com/ponponon/openctrlc/discussions)

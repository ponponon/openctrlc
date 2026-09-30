<h1 align="center">OpenCtrlC</h1>

<p align="center">基于 OpenCode 持续开发的开源 AI 编程 Agent，带来更完整的桌面与远程工作流。</p>

<p align="center">
  <a href="https://github.com/ponponon/openctrlc/actions/workflows/publish.yml"><img alt="构建状态" src="https://img.shields.io/github/actions/workflow/status/ponponon/openctrlc/publish.yml?style=flat-square&branch=dev" /></a>
  <a href="https://github.com/ponponon/openctrlc/blob/dev/LICENSE"><img alt="许可证" src="https://img.shields.io/github/license/ponponon/openctrlc?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a>
</p>

OpenCtrlC 是基于 [OpenCode](https://github.com/anomalyco/opencode) 独立维护的开源分支。我们开发这个项目，是希望在 OpenCode 的 AI 编程能力基础上，提供更顺手的桌面体验、清晰直观的会话管理，以及跨设备远程访问能力。

## 为什么开发 OpenCtrlC

OpenCode 为 AI 辅助编程提供了扎实的基础。OpenCtrlC 在此之上重点打磨桌面使用、会话理解和多设备协作：

- **更完整的桌面工作流**：提供 macOS、Windows 和 Linux 原生桌面应用，同时保留 CLI 和 TUI。桌面版与 CLI 共用本地项目和会话模型，并提供会话搜索、轮次跳转、上下文查看，以及 Token 用量、成本和耗时的可视化分析。
- **用手机访问工作区**：扫描二维码配对，在桌面端批准浏览器后，即可从手机打开当前工作区。桌面端通过中继主动建立连接，无需向公网开放本机端口。中继转发流量时可以查看内容，因此这不是端到端加密连接。
- **过程清晰、模型自选**：可以查看工具调用、文件变更和命令结果；按需连接模型供应商或本地模型；同时把项目规则和 Skills 放在代码工作流中。
- **兼容 OpenCode 会话**：可以导出可读的对话记录，并按 ID 导入兼容的 OpenCode 会话。

OpenCode 是 OpenCtrlC 的技术基础；OpenCtrlC 在此基础上发展自己的桌面体验、远程工作流、产品方向和发布流程。OpenCtrlC 与 OpenCode 团队不存在隶属、代理或背书关系。

## 快速入口

- 官网：[openctrlc.pages.dev](https://openctrlc.pages.dev/)
- 文档：[openctrlc.pages.dev/docs](https://openctrlc.pages.dev/docs/)
- 下载：[官网软件下载页](https://openctrlc.pages.dev/download/) · [GitHub Releases](https://github.com/ponponon/openctrlc/releases)
- 讨论区：[GitHub Discussions](https://github.com/ponponon/openctrlc/discussions)

## 安装

### CLI / TUI

安装脚本会自动识别操作系统和 CPU 架构：

```bash
curl -fsSL https://raw.githubusercontent.com/ponponon/openctrlc/dev/install | bash
```

也可以通过 npm 全局安装 CLI（需要 Node.js 和 npm）：

```bash
npm install -g openctrlc
```

如果之前安装的是旧包名，请先运行 `npm uninstall -g openctrlc-ai`，再安装 `openctrlc`。

macOS 和 Linux 用户也可以通过 OpenCtrlC 项目的 Homebrew tap 安装：

```bash
brew install ponponon/tap/openctrlc
```

这个 Formula 由 OpenCtrlC 项目的 tap 维护，与 `homebrew/core` 分开管理。

安装器支持通过 `OPENCTRLC_INSTALL_DIR` 或 `XDG_BIN_DIR` 自定义安装路径，默认回退到 `$HOME/.openctrlc/bin`。

### 桌面版

从[官网软件下载页](https://openctrlc.pages.dev/download/)下载最新桌面安装包。稳定版在可用时优先通过项目的 Cloudflare R2 镜像提供，失败时会自动回退到 GitHub Release：

| 平台    | 架构          | 格式               |
| ------- | ------------- | ------------------ |
| macOS   | Apple Silicon | DMG、ZIP           |
| Windows | x64、ARM64    | NSIS 安装程序      |
| Linux   | x64、ARM64    | DEB、AppImage、RPM |

桌面版和 CLI 共用本地项目与会话模型；桌面安装包会包含与目标平台匹配的 CLI 二进制文件。

## 数据与模型供应商

OpenCtrlC 是客户端软件，不是托管模型服务。应用在本地运行，并按照你选择的供应商配置发送请求。具体供应商的条款、数据保留策略和费用规则适用于这些请求。

可选的分享功能需要你主动触发：只有你选择分享的会话才会发送到配置的分享服务。如果不适合分享，可以在项目配置中关闭它。

## 开发

OpenCtrlC 使用 [Bun](https://bun.sh) 和 Bun workspace：

```bash
bun install
bun run dev
bun run dev:console
bun run dev:desktop
```

修改后可以运行以下检查：

```bash
bun run --cwd packages/console/app typecheck
bun run --cwd packages/console/app build
bun run --cwd packages/web build
```

提交 Pull Request 前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)，发布维护者还应阅读 [docs/release.md](./docs/release.md)。

## 许可证

OpenCtrlC 使用 [MIT License](./LICENSE) 发布。

---

**项目链接：** [GitHub](https://github.com/ponponon/openctrlc) · [Issues](https://github.com/ponponon/openctrlc/issues) · [Discussions](https://github.com/ponponon/openctrlc/discussions)

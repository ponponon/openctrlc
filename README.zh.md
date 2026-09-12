<h1 align="center">OpenCtrlC</h1>

<p align="center">面向终端和桌面工作流的开源 AI 编程 Agent。</p>

<p align="center">
  <a href="https://www.npmjs.com/package/openctrlc-ai"><img alt="npm" src="https://img.shields.io/npm/v/openctrlc-ai?style=flat-square" /></a>
  <a href="https://github.com/ponponon/openctrlc/actions/workflows/publish.yml"><img alt="构建状态" src="https://img.shields.io/github/actions/workflow/status/ponponon/openctrlc/publish.yml?style=flat-square&branch=dev" /></a>
  <a href="https://github.com/ponponon/openctrlc/blob/dev/LICENSE"><img alt="许可证" src="https://img.shields.io/github/license/ponponon/openctrlc?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a>
</p>

OpenCtrlC 帮助你探索代码仓库、理解陌生代码、编辑文件、运行命令并审查变更。它面向希望把 AI 编程工作流保持在终端、项目文件和现有工具附近的开发者。

## 快速入口

- 官网：[openctrlc.pages.dev](https://openctrlc.pages.dev/)
- 文档：[openctrlc.pages.dev/docs](https://openctrlc.pages.dev/docs/)
- 下载：[GitHub Releases](https://github.com/ponponon/openctrlc/releases)
- 讨论区：[GitHub Discussions](https://github.com/ponponon/openctrlc/discussions)

## 安装

### CLI / TUI

安装脚本会自动识别操作系统和 CPU 架构：

```bash
curl -fsSL https://raw.githubusercontent.com/ponponon/openctrlc/dev/install | bash
```

也可以安装 npm 包：

```bash
npm install --global openctrlc-ai
# 或：bun add --global openctrlc-ai
```

安装器支持通过 `OPENCTRLC_INSTALL_DIR` 或 `XDG_BIN_DIR` 自定义安装路径，默认回退到 `$HOME/.openctrlc/bin`。

### 桌面版

从 [GitHub Releases](https://github.com/ponponon/openctrlc/releases) 下载最新桌面安装包：

| 平台    | 架构          | 格式               |
| ------- | ------------- | ------------------ |
| macOS   | Apple Silicon | DMG、ZIP           |
| Windows | x64、ARM64    | NSIS 安装程序      |
| Linux   | x64、ARM64    | DEB、AppImage、RPM |

桌面版和 CLI 使用相同的本地项目与会话模型。桌面安装包会包含与目标平台匹配的 CLI 二进制文件。

## OpenCtrlC 能做什么

- **终端与桌面工作流**：在 TUI 或原生桌面应用中工作，不改变项目目录结构。
- **自由选择模型供应商**：连接适合自己工作流和安全要求的远程供应商或本地模型。
- **Skills 与项目规则**：查看可用技能，让项目约定和代码一起维护。
- **会话导航**：搜索会话、跳转到指定轮次并检查本次回复使用的上下文。
- **透明的执行过程**：查看工具调用、生成的变更和命令结果，不把 Agent 当作黑盒。
- **会话导出与导入**：导出可读的对话记录，并按 ID 导入兼容的 OpenCode 会话。
- **跨平台发布**：CLI 和桌面版面向 macOS、Windows、Linux 发布；发布流程覆盖 x64 与 ARM64 架构。

## 数据与模型供应商

OpenCtrlC 是客户端软件，不是托管模型服务。应用在本地运行，并按照你选择的供应商配置发送请求。具体供应商的条款、数据保留策略和费用规则适用于这些请求。

可选的分享功能是显式触发的：只有你主动选择分享的会话才会发送到配置的分享服务。如果不适合分享，可以在项目配置中关闭它。

## 与 OpenCode 的关系

OpenCtrlC 是基于 [OpenCode](https://github.com/anomalyco/opencode) 独立维护的开源分支。OpenCode 为终端 AI 编程提供了坚实的技术基础；OpenCtrlC 在此基础上采用独立的产品方向和发布流程。

OpenCtrlC 与 OpenCode 团队不存在隶属、代理或背书关系。

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

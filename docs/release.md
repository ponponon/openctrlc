# Release

## Current GitHub Actions release

当前 GitHub Actions 发布流程是手动触发的 CLI 发布流程，不会因为向 `dev` 推送普通 commit 自动发布。
在 Actions 页面手动运行 `publish`，填写 `version` 或选择 `bump`。

流程会先创建 draft GitHub Release，然后显式确认对应 tag 指向本次工作流 commit；如果 tag 缺失，会创建并推送它。之后构建并上传 CLI 压缩包。

当前流程不会调用根目录的 `script/publish.ts`，因此不会发布 npm 包、桌面端安装包或执行版本同步 commit。

## Full package publishing

如果要执行包含 npm 包的完整发布流程，从仓库根目录执行：

```bash
OPENCTRLC_VERSION=<version> \
OPENCTRLC_CHANNEL=prod \
OPENCTRLC_RELEASE=1 \
bun ./script/publish.ts
```

发布脚本会构建并发布 CLI 平台包以及 `openctrlc-ai`。不要直接修改
`packages/desktop/scripts/utils.ts` 中的默认 CLI 版本来“发布”新版本。

## 发布前检查

确认以下 13 个 npm 包都使用同一个版本：

```text
openctrlc-ai
openctrlc-darwin-arm64
openctrlc-darwin-x64
openctrlc-darwin-x64-baseline
openctrlc-linux-arm64
openctrlc-linux-arm64-musl
openctrlc-linux-x64
openctrlc-linux-x64-baseline
openctrlc-linux-x64-musl
openctrlc-linux-x64-baseline-musl
openctrlc-windows-arm64
openctrlc-windows-x64
openctrlc-windows-x64-baseline
```

检查版本元数据和实际 tarball：

```bash
for package in openctrlc-ai openctrlc-darwin-arm64 openctrlc-darwin-x64 openctrlc-darwin-x64-baseline openctrlc-linux-arm64 openctrlc-linux-arm64-musl openctrlc-linux-x64 openctrlc-linux-x64-baseline openctrlc-linux-x64-musl openctrlc-linux-x64-baseline-musl openctrlc-windows-arm64 openctrlc-windows-x64 openctrlc-windows-x64-baseline; do
  npm view "$package@<version>" version
  npm pack "$package@<version>" --dry-run
done
```

如果 `npm view` 已经能查到版本，但 `npm pack` 或 Bun 安装仍然返回 tarball `404`，这是 npm CDN 尚未同步完成。等待后重新执行实际安装验证，不要重复发布同一个版本。

## 桌面端验证

确认当前平台包可以被桌面端实际下载并启动：

```bash
OPENCTRLC_CLI_VERSION=<version> bun run dev:desktop
```

必须看到类似以下输出后，才认为桌面端发布链路完成：

```text
installed openctrlc-darwin-arm64@<version>
Copied openctrlc-darwin-arm64 to resources/openctrlc
```

本地开发可以使用 `OPENCTRLC_CLI_VERSION` 临时覆盖版本，但不要把未发布版本写入源码默认值。

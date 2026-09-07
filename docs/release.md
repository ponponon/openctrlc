# Release

## Current GitHub Actions release

当前 GitHub Actions 发布流程是手动触发的正式发布流程，不会因为向 `dev` 推送普通 commit 自动发布。
在 Actions 页面手动运行 `publish`，填写 `version` 或选择 `bump`。

流程会先创建 draft GitHub Release，然后确认对应 tag 指向本次工作流 commit；之后并行构建 CLI 和 macOS Desktop。版本说明在 CI 中使用 Git 提交生成，避免依赖模型凭证。Desktop 使用
Developer ID 证书签名并提交 Apple notarization，成功后把 DMG/ZIP 和 CLI 压缩包上传到 Release，最后自动将 Release 从 draft 发布。

当前流程不会调用根目录的 `script/publish.ts`，因此不会发布 npm 包或执行版本同步 commit。macOS Desktop 当前构建 Apple Silicon（arm64）产物。

### GitHub Actions 必需 Secrets

本机的 `openctrlc-notary` 是 macOS 钥匙串配置，只能在本机使用，GitHub Runner 无法读取。需要在仓库的
`Settings → Secrets and variables → Actions` 中配置以下 Secrets：

```text
MACOS_DEVELOPER_ID_P12_BASE64   # 包含 Developer ID Application 私钥的 .p12，经 base64 编码
MACOS_DEVELOPER_ID_P12_PASSWORD # 导出 .p12 时设置的密码
APPLE_ID                        # 有权访问该 Developer Team 的 Apple 账户邮箱
APPLE_APP_SPECIFIC_PASSWORD     # Apple 账户页面生成的 App 专用密码
APPLE_TEAM_ID                   # J6RWCMMG83
```

在本机导出包含私钥的 Developer ID `.p12` 后，可使用下面的命令复制成 Secret 内容：

```bash
base64 -i /path/to/OpenCtrlC-Developer-ID.p12 | pbcopy
```

复制到 GitHub Secret `MACOS_DEVELOPER_ID_P12_BASE64` 后，不要把 `.p12` 或密码提交到仓库。

完成 Secrets 配置后，在 Actions 页面运行 `publish`；成功日志应包含 `notarization successful`，Release 会自动发布。

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

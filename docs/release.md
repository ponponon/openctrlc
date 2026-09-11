# Release

## 正式发布流程

正式版本通过 GitHub Actions 的 `publish` 工作流手动发布，不会因为普通的
`dev` 分支提交自动创建版本。

发布前先把代码、官网、文档和 `docs/releases/v<version>.md` 提交并推送到
`dev`，然后在 GitHub Actions 中运行 `publish`，填写完整版本号，例如
`0.2.2`。工作流会创建 draft Release、创建并校验版本 tag、构建所有平台
资产，最后上传资产并将 Release 发布。

## 本地标签同步

GitHub Release 创建的 tag 是远程仓库的独立 ref。若对应提交已经存在于本地，
普通 `git fetch` 可能不会自动带回后来创建的 tag，因此 Git Graph 里会看不到
线上已有标签。首次在本仓库使用或发现本地标签不完整时，执行：

```bash
./script/sync-tags
```

该脚本会把 `remote.origin.tagOpt` 设置为 `--tags`，并通过
`git fetch origin --tags --force` 同步远程标签。设置完成后，后续普通 fetch
也会自动获取标签；如果使用其他远程名，可以把远程名作为第一个参数传入。

同步后可用下面的命令核对本地标签：

```bash
git tag --list --sort=version:refname
git show-ref --tags
```

当前正式发布包含：

- CLI：macOS Apple Silicon / Intel、Linux x64 / ARM64、Windows x64 / ARM64。
- Desktop：macOS Apple Silicon、Windows x64 / ARM64、Linux x64 / ARM64。
- Desktop Linux：DEB、AppImage、RPM。
- Desktop Windows：NSIS 安装程序。
- macOS Desktop：Developer ID 签名和 notarization。
- 所有 Desktop 构建：发布前执行图标尺寸、透明圆角和 Dock inset 校验。

发布说明优先读取 `docs/releases/v<version>.md`。正文应面向最终用户，按
`Features`、`Bug Fixes` 和 `Downloads` 组织；Downloads 先按 `CLI/Desktop`
分类，再按 `macOS/Linux/Windows` 和架构分类。不要在正文中堆积 commit ID。
如果没有第三方贡献者，不要添加 Contributors 小节。

## 官网和文档部署

`.github/workflows/deploy.yml` 会在 `dev` 分支更新时构建并部署两个 Cloudflare
Pages 项目：

- `openctrlc`：官网、下载页、更新日志和法律页面，地址为
  `https://openctrlc.pages.dev`。
- `openctrlc-docs`：多语言文档，地址为
  `https://openctrlc-docs.pages.dev`，官网通过代理挂载到 `/docs/`。

仓库需要配置以下 GitHub Actions 凭据：

```text
CLOUDFLARE_API_TOKEN   # Secret，至少具备 Pages 项目部署权限
CLOUDFLARE_ACCOUNT_ID  # Variable 或 Secret，Cloudflare Account ID
```

工作流会在部署前自动创建缺失的 Pages 项目。若账号策略禁止自动创建，先
在 Cloudflare Pages 中手动创建这两个项目，并把生产分支设为 `dev`。

## GitHub Actions 必需 Secrets

macOS 正式桌面包需要以下仓库 Secrets：

```text
MACOS_DEVELOPER_ID_P12_BASE64
MACOS_DEVELOPER_ID_P12_PASSWORD
APPLE_ID
APPLE_APP_SPECIFIC_PASSWORD
APPLE_TEAM_ID
```

其中 `MACOS_DEVELOPER_ID_P12_BASE64` 是包含 Developer ID Application 私钥的
`.p12` 文件的 base64 内容。不要把 `.p12`、密码或任何 API token 提交到仓库。

## 发布前检查

1. 查看最近提交，确认版本变更确实面向用户，并更新 `docs/releases/`。
2. 运行官网和文档构建：

   ```bash
   bun run --cwd packages/console/app typecheck
   bun run --cwd packages/console/app build
   SST_STAGE=production bun run --cwd packages/web build
   ```

3. 检查 GitHub Actions workflow 文件、下载资产名和发布说明中的链接一致。
4. 检查 staged diff，确认没有 API key、账号密码、证书私钥或本地配置。
5. 发布后验证 Release 页面、官网首页、`/download`、`/changelog` 和 `/docs/`。

## npm 包发布

当前 `publish` 工作流主要负责 GitHub Release 和 Desktop 资产，不会自动发布
npm 包。若需要同步发布 CLI npm 包，使用：

```bash
OPENCTRLC_VERSION=<version> \
OPENCTRLC_CHANNEL=prod \
OPENCTRLC_RELEASE=1 \
bun ./script/publish.ts
```

不要直接修改 `packages/desktop/scripts/utils.ts` 中的默认 CLI 版本来“发布”新版本。

## 桌面端验证

发布后可以用对应版本验证本机桌面端下载：

```bash
OPENCTRLC_CLI_VERSION=<version> bun run dev:desktop
```

应看到对应平台的 `openctrlc-<platform>-<arch>@<version>` 成功安装并复制到
Desktop resources。开发环境可以临时覆盖版本，但不要把未发布版本写入源码默认值。

# Release

## 正式发布流程

正式版本通过 GitHub Actions 的 `publish` 工作流手动发布，不会因为普通的
`dev` 分支提交自动创建版本。

发布前先把代码、官网、文档和 `docs/releases/v<version>.md` 提交并推送到
`dev`，然后在 GitHub Actions 中运行 `publish`，填写完整版本号，例如
`0.2.5`。工作流会创建 draft Release、创建并校验版本 tag、构建所有平台
资产，最后上传资产并将 Release 发布。Release 发布成功后，工作流会自动把公开
资产同步到 Cloudflare R2，官网的稳定版下载入口优先使用 R2，R2 不可用时自动
回退到 GitHub Release。

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
- macOS CLI：三种 Darwin 归档（arm64、x64、x64-baseline）使用 Developer ID 签名和 hardened runtime；单独的 CLI notarization 不在当前流程中。
- Desktop：macOS Apple Silicon、Windows x64 / ARM64、Linux x64 / ARM64。
- Desktop Linux：DEB、AppImage、RPM。
- Desktop Windows：NSIS 安装程序。
- macOS Desktop：Developer ID 签名和 notarization。
- 所有 Desktop 构建：发布前执行图标尺寸、透明圆角和 Dock inset 校验。

发布说明优先读取 `docs/releases/v<version>.md`。正文应面向最终用户，按
`Features`、`Bug Fixes` 和 `Downloads` 组织；Downloads 先按 `CLI/Desktop`
分类，再按 `macOS/Linux/Windows` 和架构分类。不要在正文中堆积 commit ID。
如果没有第三方贡献者，不要添加 Contributors 小节。

官网 `/changelog.json` 会把 GitHub Release 正文转换为安全的 HTML，Desktop 在标题栏
更新提示中按目标版本读取并显示各个二级标题和列表；点击更新提示只打开预览，用户再点
“安装并重启”才会开始安装。Desktop 升级后也从同一更新源加载本次版本的说明。请保留
`Features` 与 `Bug Fixes` 标题和列表结构，避免更新前预览及升级后说明失去分组。

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

下载加速使用 R2 存储桶 `openctrlc-releases` 和公开域名
`https://openctrlc-releases.quniv.cn/openctrlc/releases`。发布工作流会使用
同一组 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID` 凭据同步清单和资产；
账号 ID 可以配置为 Repository Variable，也可以配置为 Secret。`sync-downloads`
工作流保留无参数手动触发入口，用于重新同步 GitHub 当前 latest stable Release 并清理 R2 中的旧版本对象。R2 只保留该最新版资产及 `download-manifest.json`；所有历史版本与资产继续由 GitHub Releases 保存。同步脚本会完整读取 R2 对象列表、删除旧版本对象、再次读取并核对；如果对象列表响应异常或删除后仍有旧对象，工作流必须失败。发布工作流同步时也会校验待发布标签就是 GitHub 当前 latest stable，避免手动补传旧版本覆盖 R2 最新版。

## GitHub Actions 必需 Secrets

macOS 正式 CLI 和桌面包共用 Developer ID 证书 Secrets；桌面 notarization 还需要 Apple 账号信息：

```text
MACOS_DEVELOPER_ID_P12_BASE64
MACOS_DEVELOPER_ID_P12_PASSWORD
APPLE_ID
APPLE_APP_SPECIFIC_PASSWORD
APPLE_TEAM_ID
```

其中 `MACOS_DEVELOPER_ID_P12_BASE64` 是包含 Developer ID Application 私钥的
`.p12` 文件的 base64 内容。不要把 `.p12`、密码或任何 API token 提交到仓库。

CLI 的 `sign-cli-macos` job 下载 `build-cli` 的 ZIP，解包后签名、严格校验并重新归档，
按 runner 原生架构运行 `--version` 校验目标版本。最终 `publish` 必须等待此 job 成功，
先下载原始 CLI artifact，再用 `openctrlc-cli-signed-macos` 覆盖三份 Darwin ZIP，然后才上传
资产并公开 Release；签名或冒烟失败时不发布。临时证书和 keychain 在成功、失败时均清理。
Homebrew tap 使用的 macOS ZIP 也因此来自签名后的正式 Release。

## 发布前检查

1. 查看最近提交，确认版本变更确实面向用户，并更新 `docs/releases/`。
2. 运行官网和文档构建：

   ```bash
   bun run --cwd packages/console/app typecheck
   bun run --cwd packages/console/app build
   SST_STAGE=production bun run --cwd packages/web build
   ```

3. 检查 GitHub Actions workflow 文件、下载资产名和发布说明中的链接一致。
4. 检查 R2 `download-manifest.json` 仅包含最新版本，并确认 R2 只保留该版本的对象；
   抽查官网稳定版下载路由是否重定向到 R2，历史版本入口是否跳转到 GitHub Releases。
   R2 同步失败时确认官网仍能回退到 GitHub latest。
5. 检查 staged diff，确认没有 API key、账号密码、证书私钥或本地配置。
6. 发布后验证 Release 页面、官网首页、`/download`、`/changelog` 和 `/docs/`。

## npm 包发布

当前 `publish` 工作流主要负责 GitHub Release 和 Desktop 资产，不会自动发布
npm 包。CLI 的正式 npm 包名是 `openctrlc`；`openctrlc-ai` 会在迁移期间保留为
兼容别名。发布后应弃用旧包名，并在 npm 上确认两个包都已发布：

```bash
npm view openctrlc version
npm view openctrlc-ai version
```

若需要同步发布 CLI npm 包，使用：

```bash
OPENCTRLC_VERSION=<version> \
OPENCTRLC_CHANNEL=prod \
bun ./packages/opencode/script/build.ts

OPENCTRLC_VERSION=<version> \
OPENCTRLC_CHANNEL=prod \
OPENCTRLC_NPM_ONLY=1 \
bun ./script/publish.ts
```

构建步骤会为全部 12 个目标平台生成与指定版本一致的 CLI 二进制。此步骤不要设置
`OPENCTRLC_RELEASE`，否则构建脚本会尝试覆盖已发布的 GitHub Release 资产。发布脚本会在发布前
拒绝缺失、混用版本或目录/包名不匹配的构建产物，并只发布刚生成的对应版本 tarball。
`OPENCTRLC_NPM_ONLY=1` 只发布 CLI、平台二进制包和迁移期兼容别名，不会尝试发布未配置
npm scope 的 SDK，也不会运行 Docker、AUR 或 Homebrew 发布流程。

该命令成功发布后会自动运行 `script/verify-npm-release.ts`：检查主包、兼容别名和全部
12 个平台包都能按精确版本查询，并检查主包和兼容别名的发布 dist-tag 指向该版本。npm
元数据尚未传播时会按 5–30 秒间隔重试最多 12 次；每轮查询超时 15 秒。仍不完整会返回失败，
之后可单独重跑：

```bash
OPENCTRLC_VERSION=<version> \
OPENCTRLC_CHANNEL=prod \
bun ./script/verify-npm-release.ts
```

注意：上述本地构建在 macOS 上只自动修复 ad-hoc 签名，不会自动使用 Developer ID，
也不会复用 GitHub 工作流的签名 artifact。若 npm 包需要与 Release 保持相同签名，
应在构建后、运行 npm 发布命令前下载同版本 Release 的三份 `openctrlc-darwin-*.zip`，
解压覆盖对应 `packages/opencode/dist/<platform>/bin` 内的二进制（保留已校验的 package.json）；
在 macOS 上执行 `codesign --verify --deep --strict`、`codesign --display --verbose=4` 并检查
Developer ID 身份及原生架构 `--version`，或者在持有该证书的 macOS 上执行相同签名步骤。
不要设置 `OPENCTRLC_RELEASE` 来补签已公开的 Release，也不要把 ad-hoc 签名当作 Developer ID 签名。

## Homebrew tap

CLI 通过公开仓库 `ponponon/homebrew-tap` 分发，Formula 文件为
`Formula/openctrlc.rb`，安装命令是 `brew install ponponon/tap/openctrlc`。
该 tap 是 OpenCtrlC 项目维护的第三方 tap，不属于 `homebrew/core`；Homebrew 官方
core 的星标/关注度收录门槛不适用于自建 tap。清华镜像只镜像官方索引和 bottles，
不会自动镜像这个 tap。

tap 仓库自己的 GitHub Actions 每六小时查询一次 OpenCtrlC 最新稳定版 Release，读取资产
SHA-256 并重写 Formula；Formula 有变化时，使用该 tap 仓库自带的 `GITHUB_TOKEN` 提交。
因此无需在主仓库配置可跨仓库写入的 PAT。也可以在 tap 仓库的 Actions 页面手动运行
`Update Homebrew Formula` workflow 立即同步。主仓库的
`packages/opencode/script/publish-homebrew.ts` 仍可供本地完整发布流程手动更新 tap。

不要直接修改 `packages/desktop/scripts/utils.ts` 中的默认 CLI 版本来“发布”新版本。

## 桌面端验证

发布后可以用对应版本验证本机桌面端下载：

```bash
OPENCTRLC_CLI_VERSION=<version> bun run dev:desktop
```

应看到对应平台的 `openctrlc-<platform>-<arch>@<version>` 成功安装并复制到
Desktop resources。开发环境可以临时覆盖版本，但不要把未发布版本写入源码默认值。

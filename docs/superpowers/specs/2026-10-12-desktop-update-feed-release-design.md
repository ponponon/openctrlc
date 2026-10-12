# Desktop 自动更新 feed 发布链路修复设计

## Goal

修复 electron-updater 三平台全线 404 的根因：Release 资产中从未上传 channel file（`latest*.yml`），打通 build → finalize → verify 的完整发布链路，使 Linux/macOS/Windows 桌面端自动更新真正可用，并以发布后冒烟门禁防止链路再次静默断裂。

## 背景与根因（已完成的调查结论）

- 桌面端更新机制为 `electron-updater` 6.8.9（`packages/desktop/src/main/updater.ts`），打包版每 10 分钟检查一次，feed 来自 GitHub Releases 的 channel file。
- `electron-builder` 在 `--publish never` 下**仍会在 `dist/` 生成 `latest*.yml`**（`PublishManager.js` 的 `createUpdateInfoTasks` 不受 `isPublish` 影响），但 `.github/workflows/publish.yml` 只上传安装包，从未上传 yml。
- 唯一会上传 yml 的 `packages/desktop/scripts/finalize-latest-yml.ts` 是死代码：CI 中唯一调用点被 `OPENCTRLC_SYNC_VERSIONS_ONLY=1` 短路（`script/publish.ts` 提前退出），且 `LATEST_YML_DIR` 全仓库无人设置。
- 由此产生用户可见报错：`Cannot find latest-linux.yml ... 404`。Windows `latest.yml`、macOS `latest-mac.yml` 同样缺失，三平台全部 404。
- 次要问题：Linux CI 把安装包重命名为 `openctrlc-linux-{arch}.{ext}`，yml 内 `url` 仍是 electron-builder 原始名（如 `openctrlc-linux-amd64.deb`），即使上传也会在下载步骤二次 404。
- `script/publish-contract.test.ts` 当前即为失败状态（job 白名单缺 `sync-release-versions`），且没有任何 workflow 执行它——发布契约处于无人看守状态。
- 界面显示 v1.18.18 与 feed 请求 v1.1.7 是两条独立来源：前者是打包时未注入 `OPENCTRLC_VERSION` 的陈旧版本，后者是 `releases/latest` 的 tag。

已验证的关键机制（设计依据）：

- electron-updater 按扩展名选文件（`DebUpdater` 找 `.deb`、`AppImageUpdater` 找 `.AppImage`、`RpmUpdater` 找 `.rpm`），并优先选 url 含 `process.arch` 的条目 → 重命名后的 `x64`/`arm64` 名与多条目 yml 可以正确协作。
- yml 若缺某扩展名条目，对应 updater 会回落到 `files[0]`，错误延迟到用户端 → 必须在 CI 断言三种 Linux 扩展名齐全。
- `${os}` 宏 = `platform.buildConfigurationKey`（`win`/`mac`/`linux`）→ Windows yml 的 `url`（`openctrlc-win-{arch}.exe`）与 CI 上传名一致，无需重写；macOS 无重命名步骤，也无需重写；仅 Linux 需要重写。
- macOS 桌面仅构建 arm64（`macos-14` 单 job、无 arch 参数，Release 仅 arm64 dmg）→ `latest-mac.yml` 只含 arm64 是正确且完整的。
- Windows 为双 matrix job，均产出**无 arch 后缀**的 `latest.yml`，直接 `--clobber` 会互相覆盖 → 必须单点合并。
- workflow 中 `gh release upload` 对 draft Release 有效（CLI 资产即如此上传）。
- `actions/upload-artifact@ea165f8…v4.6.2`、`actions/download-artifact@d3f86a1…v4.3.0` 已在 workflow 中 pin，直接复用。
- `download-artifact`（指定 pattern、不指定 name）解压到 `<path>/<artifact-name>/`，与 finalize 脚本现有的 `latest-yml-<target-triple>/` 目录约定天然吻合——该脚本本就是为此链路写的，只差接线。

## Scope

- 新增 `packages/desktop/scripts/rewrite-update-feed.ts`：build job 内就地重写 yml 的 `url`。
- 改造 `packages/desktop/scripts/finalize-latest-yml.ts`：tag 改用 `RELEASE_TAG` env、输出不满 4 文件即 fail。
- 新增 `script/verify-update-feed.ts`：发布后公网冒烟校验，失败即红灯（用户已确认必过红灯）。
- `publish.yml`：三个 build job 加 rewrite + artifact 上传步骤；新增 `finalize-update-feed`、`verify-update-feed` 两个 job；`publish` job 增加 needs。
- 修 `script/publish-contract.test.ts`（白名单、禁止词、新契约断言），并接入一个 PR/CI 检查让它不再孤儿（实现时查现有 PR workflow 决定挂载点）。
- `packages/desktop/scripts/prepare.ts`：prod 通道缺 `OPENCTRLC_VERSION` 时打印醒目警告（用户已确认仅警告、不阻断）。
- 文档：`FEATURE.md` 新章节、`FailureExperience.md` 新条目、`docs/release.md` 检查清单补充。

## 架构与数据流

```
version（创建 draft Release v<X.Y.Z>，输出 tag/repo）
  ├─ build-desktop-macos（1 job）
  │    package:mac → dist/latest-mac.yml（url 已匹配 → rewrite 为 no-op）
  │    → 拷入 latest-yml-aarch64-apple-darwin/ → upload-artifact
  ├─ build-desktop-linux（matrix x64/arm64）
  │    package:linux（单 invocation 产出 deb+AppImage+rpm）
  │    → rename 安装包为 openctrlc-linux-{arch}.{ext}
  │    → rewrite-update-feed：按 sha512 对齐 url 到重命名后的实际文件名
  │      （断言 .deb/.AppImage/.rpm 三种扩展名各 ≥1，否则 fail）
  │    → 拷入 latest-yml-{x86_64|aarch64}-unknown-linux-gnu/ → upload-artifact
  ├─ build-desktop-windows（matrix x64/arm64）
  │    package:win → dist/latest.yml（url 已匹配 → rewrite no-op）
  │    → 拷入 latest-yml-{x86_64|aarch64}-pc-windows-msvc/ → upload-artifact
  ├─ finalize-update-feed【新 job】needs: 三个 build-desktop-* job
  │    checkout + setup-bun + download-artifact（pattern: latest-yml-*）
  │    → LATEST_YML_DIR 下跑 finalize-latest-yml.ts
  │      合并 Windows 双架构 + 校验 4 文件齐全 + gh release upload --clobber
  │      （此时 Release 仍是 draft）
  ├─ publish（needs += finalize-update-feed）→ 传 CLI → gh release edit 公开
  ├─ verify-update-feed【新 job】needs: publish
  │    → 公网 GET 4 个 latest*.yml + 解析后逐个 GET files[].url
  │    → $GITHUB_STEP_SUMMARY 表格；任一失败 exit 1（红灯）
  ├─ sync-downloads（不变）
  └─ sync-release-versions（不变）
```

设计决策：

- **url 重写放 build job**：只有那里有重命名后的 dist 文件可做 sha512 对齐，不硬编码重命名规则，避免与 workflow 的 rename 逻辑两处漂移。
- **合并+上传放 finalize job**：Windows 双架构必须单点合并，避免两个 matrix job `--clobber` 互踩；也是缺文件校验的唯一收口点。
- **上传在 draft 阶段、校验在公开之后**：verify 走真实用户路径（无 token 公网 GET），与 electron-updater 的行为一致。
- **tag 单一事实来源**：finalize/verify 均使用 version job 输出的 `RELEASE_TAG`，脚本不再自行推导。

## 脚本设计

### `packages/desktop/scripts/rewrite-update-feed.ts`（新）

- 入参：dist 目录（默认 `packages/desktop/dist`），就地改写其中 `latest*.yml`。
- 流程：扫描 dist 安装包 → 算 sha512 建 `sha512 → 实际文件名` 索引 → 逐条 entry 查索引：
  - 查到且 `url` ≠ 实际文件名 → 改写 `url` 并同步顶层 `path` 兼容字段；
  - 查不到 → fail（yml 引用了 dist 中不存在的文件，绝不上传坏 feed）。
- Linux yml 额外断言三种扩展名齐全，缺则 fail。
- 无改写需求时不写文件（幂等；mac/win 为 no-op）。
- 用仓库已有 `yaml` 包解析/序列化（不复用 finalize 脚本的 hand-rolled parser，两者职责不同，不强行合并）。

### `packages/desktop/scripts/finalize-latest-yml.ts`（改造）

1. tag 决策改为 `RELEASE_TAG` env 必填（CI 传 `needs.version.outputs.tag`），删除 `beta ? "beta" : v${version}` 自造逻辑。
2. 输出文件不满 4 个（`latest.yml`、`latest-mac.yml`、`latest-linux.yml`、`latest-linux-arm64.yml`）即 fail，替代现有静默跳过。
3. parse/serialize/merge 主体不动；上传仍用 `gh release upload --clobber --repo`。

### `script/verify-update-feed.ts`（新）

- 输入：`RELEASE_TAG`、`GH_REPO`（默认 `GITHUB_REPOSITORY`）。
- 对 4 个 yml：`Bun.fetch` GET `https://github.com/{owner}/{repo}/releases/download/{tag}/{file}` → 200；解析后对每条 `files[].url` 同样 GET → 200，响应含 `content-length` 时断言与 yml `size` 一致（缺失则降级为仅状态码校验）；跟随 302。
- 写 `$GITHUB_STEP_SUMMARY` markdown 表格（文件、状态码、耗时、✅/❌）；任一失败 `exit 1`。
- 零新依赖（纯 `Bun.fetch`）；解析与断言拆为可导出纯函数供测试。

### `packages/desktop/scripts/prepare.ts`（警告）

- 条件：`OPENCTRLC_CHANNEL=prod` 且未设 `OPENCTRLC_VERSION` → 打印醒目多行警告（陈旧版本会被打进可发布包、界面版本将与 Release 不符），不退出。dev/beta 不警告。

## Testing

- `rewrite-update-feed`：临时目录造真实小文件（不同内容 → 不同 sha512）+ 真实 yml，断言 url 改写、sha512 查不到时报错、三扩展名断言报错、幂等 no-op。
- `finalize-latest-yml`：按 triple 结构铺 fixture，断言 Win 双架构合并、缺文件 fail、tag 使用 `RELEASE_TAG`。
- `verify-update-feed`：纯函数层对 fixture yml 断言；HTTP 层不 mock，注入 base-url 指向本地 `Bun.serve` 静态服务，跑通 200/404 两条路径。
- 修 `script/publish-contract.test.ts` 并全绿：job 白名单补 `sync-release-versions`、`finalize-update-feed`、`verify-update-feed`；删除与现状冲突的 `script/publish.ts` 禁止词；新增断言（build job 含 rewrite 调用、`publish` needs `finalize-update-feed`、`verify-update-feed` needs `publish` 且引用 `verify-update-feed.ts`）。
- 测试从包目录运行（遵守 `do-not-run-tests-from-root`）；`bun typecheck` 从包目录跑。

## 文档

- `FEATURE.md` 新章节「桌面自动更新 feed 发布链路」：机制、4 个 channel file 命名规则、rewrite → finalize → verify 三段链路、`app-update.yml` 生成条件（dev 通道无 publish 配置故无更新器）、Windows 双架构合并原因。
- `FailureExperience.md` 新条目：`--publish never` 只关上传不关生成、channel file 躺在 dist 无人上传；契约测试过期且无人执行 = 发布契约无人看守；含本次 404 报障证据链。
- `docs/release.md` 检查清单补一条：确认 `verify-update-feed` 绿灯（附手动核验命令）。

## 验证与发布策略

1. 本地：三脚本单测 + `OPENCTRLC_CHANNEL=prod` 本地打包跑 rewrite 观察 url 改写。
2. CI：`bun test` 契约测试全绿。
3. 全链路需发一次真实 release（如 v1.1.8）：finalize 上传 4 文件 → verify 绿灯 → 用已安装客户端手动「检查更新」确认拉到 feed。发布不可逆，1、2 全绿后再由用户触发 publish workflow。

## 遗留风险

- R1：CI 单次 `package:linux` 是否真把三种 target 写进同一 yml——本地仅见 deb，无直接证据；由 rewrite 三扩展名断言兜底，首次 CI 运行即揭盲。
- R2：mac yml 是否只含 arm64 zip——与 Release 仅发 arm64 dmg 一致则无问题；由 verify 逐条可达校验兜底。

## Non-goals

- 不改变 R2 下载同步（`publish-release-downloads.mjs` 只镜像安装包扩展名，yml 不进 R2）。
- 不改变 changelog（`openctrlc.pages.dev/changelog.json`）这条独立的更新说明链路。
- 不把「仅警告」升级为阻断（用户已明确选择警告）。
- 不做差分更新（blockmap）相关工作。
- 不重构 finalize 脚本的 hand-rolled YAML parser 为通用库。

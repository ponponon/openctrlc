## GitHub Actions 定时任务静默时段

### 功能目标

避免 GitHub Actions 的自动定时任务在北京时间 22:00 至次日 09:30 之间运行，同时保留手动触发能力，方便主动发布版本或临时执行维护任务。

### 实现范围

- `compliance-close` 改为北京时间 09:30 至 21:30 每 30 分钟运行。
- `close-prs` 改为北京时间每天 19:00 运行。
- `close-issues` 保持北京时间每天 10:00 运行。
- `stats` 保持北京时间每天 20:00 运行。
- `docs-update` 改为北京时间每天 20:00 运行，移除原本北京时间 08:00 的定时触发。
- 所有工作流的 `workflow_dispatch` 手动触发入口保持不变，版本发布等主动操作不受影响。

### 验证方式

- 检查 `.github/workflows` 下所有 `schedule` 的 cron 表达式，确认没有配置在北京时间 22:00 至 09:30 之间的自动触发。
- 在 GitHub Actions 页面确认手动运行入口仍然存在。

## Skill 加载透明度面板

### 功能目标

让用户在不访问文件系统的情况下，查看当前项目发现了哪些 Skill，并区分“项目可用”与“本次会话已经激活”，避免把配置存在误认为 Skill 已经生效。

### 使用方式

打开设置，在「服务器」分组进入「Skills」。页面按当前项目加载 Skill 列表，支持搜索；点击某个 Skill 可以展开查看来源路径和调用方式。若从会话中打开设置，还会额外显示该会话已经激活过的 Skill 及激活次数。

### 实现范围

- 复用已有按项目返回 Skill 的 `GET /skill` 接口和查询缓存，不修改公共协议或生成 SDK。
- 可用列表展示名称、描述、来源类型、真实来源路径和可选的 Slash 调用方式。
- 会话使用列表从现有 `session.skill.activated` 投影中实时聚合，按 Skill 去重并保留激活次数。
- 覆盖无项目、加载中、加载失败、搜索无结果和空列表状态；新增设置文案同步到全部 App locale，保证 i18n parity。

### 代码位置

- `packages/app/src/components/settings-v2/skills.tsx`：Skill 透明度页面和会话激活聚合。
- `packages/app/src/components/settings-v2/dialog-settings-v2.tsx`：设置页导航与页面挂载。
- `packages/app/src/context/global-sync/bootstrap.ts`、`packages/app/src/context/server-sync.tsx`：项目范围 Skill 查询选项。
- `packages/app/src/components/settings-v2/settings-v2.css`：Skill 列表、详情和状态样式。
- `packages/app/src/context/global-sync/bootstrap.test.ts`：按目录请求 Skill 的查询测试。

### 验证方式

- 在 `packages/app` 执行 `bun run typecheck`。
- 执行 `bun test --conditions=solid --preload ./happydom.ts ./src/context/global-sync/bootstrap.test.ts ./src/i18n/parity.test.ts`。
- 在有 Skill 的项目中打开「设置 → 服务器 → Skills」，确认项目可用列表、来源详情、搜索和会话已使用列表均可见。

## 导出完成后打开系统文件管理器

### 功能目标

会话导出成功后，桌面端提示中提供打开下载目录的操作，帮助用户快速找到刚导出的 JSON 或 Markdown 文件。

### 使用方式

在桌面端导出会话成功后，点击提示中的「在 Finder 中显示」「在文件资源管理器中显示」或「打开所在文件夹」。macOS 使用 Finder，Windows 使用文件资源管理器，Linux 使用系统默认文件管理器。网页端保持原有下载行为，不显示本机文件管理器操作。

### 实现范围

- 通过 Desktop IPC 让主进程使用 Electron 默认文件打开能力打开系统下载目录，不在 Renderer 中硬编码各操作系统命令。
- 导出成功提示的会话标题菜单、上下文页入口和命令面板入口统一提供该操作。
- 复用现有文件管理器平台文案，并在打开失败时显示请求失败提示。
- 由于浏览器下载路径由 Chromium 管理，操作打开的是下载目录，不承诺直接选中某一个文件。

### 代码位置

- `packages/app/src/utils/session-export.ts`：按平台生成导出成功提示操作。
- `packages/app/src/context/platform.tsx`：声明打开系统下载目录的平台能力。
- `packages/desktop/src/preload/*`、`packages/desktop/src/main/ipc.ts`：暴露并实现 Desktop IPC。
- `packages/desktop/src/renderer/index.tsx`：将 Electron 能力接入 App 平台适配器。
- `packages/app/src/utils/session-export.test.ts`：验证 Web 降级和各桌面平台文案。

### 验证方式

- 在 `packages/app` 执行 `bun run typecheck`。
- 在 `packages/desktop` 执行 `bun run typecheck`。
- 在 `packages/app` 执行 `bun test --conditions=solid --preload ./happydom.ts ./src/utils/session-export.test.ts`。
- 在 macOS、Windows、Linux Desktop 中分别点击导出成功提示，确认打开对应系统的下载目录。

## 会话多格式导出

### 功能目标

在保留 JSON 原始数据导出的基础上，支持将会话导出为 Markdown，方便阅读、分享和归档。

### 使用方式

在会话标题的更多菜单或上下文页的原始消息区域点击「导出」，选择 `JSON`、`Markdown` 或 `Markdown (full)`。JSON 文件继续使用 `.json` 扩展名，Markdown 文件使用 `.md` 扩展名。

普通 `Markdown` 默认只保留用户输入和助手回答，适合阅读和分享；需要排查执行过程时，再选择 `Markdown (full)` 查看工具调用、推理和步骤信息。

### 实现范围

- 保留现有 JSON 导出结构和下载行为，避免影响会话重新导入。
- Markdown 包含会话标题、会话 ID、工作目录、创建时间和按顺序排列的对话内容。
- 普通 Markdown 只导出文本和文件引用；`Markdown (full)` 额外保留推理折叠块、工具调用输入/输出、子任务、步骤、快照、补丁、重试和压缩等过程信息。
- 导出逻辑集中在 `packages/app/src/utils/session-export.ts`，菜单入口复用同一套格式类型和文件命名规则。
- 新旧两套会话标题菜单，以及上下文页的原始消息导出按钮，均支持格式选择。

### 代码位置

- `packages/app/src/utils/session-export.ts`：格式类型、Markdown 序列化、文件命名和下载。
- `packages/app/src/utils/session-export.test.ts`：文件扩展名和 Markdown 内容测试。
- `packages/app/src/pages/session/timeline/message-timeline.tsx`：新旧会话标题菜单的格式子菜单。
- `packages/app/src/components/session/session-context-tab.tsx`：上下文页导出按钮的格式菜单。

### 验证方式

- 在 `packages/app` 执行 `bun run typecheck`。
- 在 `packages/app` 执行 `bun test --conditions=solid --preload ./happydom.ts ./src/utils/session-export.test.ts`。
- 手动打开会话标题菜单和上下文页导出按钮，确认 JSON/Markdown 两个选项均可下载，文件扩展名和内容格式正确。

## OpenCode sessionID 导入

### 功能目标

允许用户只提供一个 OpenCode 的 sessionID，将本地 OpenCode 数据库中的完整会话记录导入 OpenCtrlC，方便切换客户端后继续查看历史对话。

### 使用方式

默认从 `~/.local/share/opencode/opencode.db` 读取：

```bash
openctrlc import ses_xxxxxxxxx
```

如果 OpenCode 数据库不在默认位置，可以显式指定：

```bash
openctrlc import ses_xxxxxxxxx --opencode-db /path/to/opencode.db
```

### 实现范围

- 读取 OpenCode 的 `session`、`message`、`part` 数据。
- Desktop 在真正导入前按 sessionID 只读读取会话标题、消息数量和 `session.directory`，把它作为默认导入目录。
- Desktop 会话内容区顶部标题显示为“项目名 / 会话标题”，方便区分不同项目中的同名会话；重命名时仍只修改会话标题。
- 源数据库以只读方式打开，不修改 OpenCode 原始数据。
- 保留原始 sessionID、消息 ID 和 part ID，导入后绑定当前 OpenCtrlC 项目与目录。
- 支持重复导入：session 使用冲突更新，已有消息和内容不会重复插入。
- 继续兼容原有的 JSON 文件和 OpenCtrlC 分享链接导入方式。

### 代码位置

- `packages/opencode/src/cli/cmd/import.ts`：CLI 参数解析与导入流程。
- `packages/opencode/src/cli/opencode-database.ts`：OpenCode SQLite 数据读取和路径解析。
- `packages/opencode/test/cli/import.test.ts`：数据库读取、字段解析和排序测试。

### 验证方式

- 使用临时 SQLite 数据库验证 session、message、part 的读取。
- 使用真实 OpenCode 数据库执行端到端导入，确认消息和内容数量一致。
- 执行 `bun typecheck` 和 `bun test test/cli/import.test.ts`。

## Desktop 版本 OpenCode sessionID 导入

### 功能目标

在 Desktop 版本中通过文件菜单、命令面板或首页项目菜单按 sessionID 导入 OpenCode 会话，导入完成后自动刷新当前项目的会话列表并打开该会话。

### 使用方式

1. 在 Desktop 中打开一个本地项目。
2. 通过「文件 → 从 OpenCode 导入会话」或命令面板执行 `session.importOpencode`。
3. 输入 `ses_...` 格式的 sessionID，点击「查找会话」；界面会展示会话标题、消息数量和 OpenCode 工作目录。
4. 默认使用会话记录中的工作目录作为导入目标；如果需要导入到其他项目，可以点击「选择文件夹」，也可以恢复为会话目录。
5. 如果 OpenCode 数据库不在默认位置，可选择自定义 `.db` 文件，切换数据库后重新查找。
6. 在首页项目列表中打开项目右侧的「更多」菜单，也可以直接进入导入弹窗；此时会使用该项目的工作目录作为默认导入目标。

### 实现范围

- Renderer 只负责表单、当前项目和导航，不直接读取 OpenCode SQLite。
- Desktop 主进程通过 CLI 的 `--opencode-info` 只读查询会话元数据，避免前端猜测目录或直接访问数据库。
- Desktop 开发版直接调用工作区当前的 CLI 源码，避免被 `resources/openctrlc` 中的旧二进制阻塞本地验证；工作区 CLI 会继承 Desktop 的发布通道，确保与当前 sidecar 使用同一份通道数据库；打包版复用随应用发布的 `openctrlc import` CLI，并使用 Desktop 当前的本地状态目录，避免重复实现导入协议。
- 打包版启动查询或导入前会检查内置 CLI 是否包含 `--opencode-db` 和 `--opencode-info`，旧版本会提示更新，不会静默执行错误的文件导入流程。
- IPC 仅接受绝对路径和合法 sessionID；远程 HTTP/SSH/WSL 服务器不会显示为可导入目标。
- 目标目录可由原生文件夹选择器修改；导入成功后按最终目标目录刷新项目会话、强制同步，再创建并选中对应的 session tab。
- 首页项目菜单会把当前项目的服务器、工作目录传给同一导入弹窗，确保导入入口与点击的项目上下文一致。

### 代码位置

- `packages/desktop/src/main/background-cli.ts`：主进程调用打包 CLI 并传递工作目录、数据库路径。
- `packages/desktop/src/main/ipc.ts`、`packages/desktop/src/preload/*`：安全 IPC 和 preload 类型。
- `packages/app/src/components/dialog-import-opencode-session.tsx`：导入对话框。
- `packages/app/src/app.tsx`、`packages/app/src/desktop-menu.ts`：命令面板注册和 Desktop 文件菜单入口。
- `packages/app/src/pages/home/home-projects-controller.tsx`、`packages/app/src/pages/home/home-projects-view.tsx`：首页项目菜单入口。

### 验证方式

- 执行 `bun typecheck`（`packages/app`、`packages/desktop`）。
- 执行 app 单测，覆盖 sessionID 校验、菜单注册和多语言 key parity。
- 使用当前源码构建 CLI 后执行 `openctrlc import --help`，确认包含 `--opencode-db` 和 `--opencode-info`；发布桌面包时使用同版本平台 CLI 包。

## macOS Desktop 一键打包安装

### 功能目标

为本地 Desktop 开发提供单条命令完成构建、生成 `.app`、安装到 `/Applications` 并启动，减少反复执行构建和复制 APP 的操作成本。

### 使用方式

```bash
bun run desktop:mac
```

默认使用 `dev` 通道；支持 `--channel=dev|beta|prod`、`--no-install` 和 `--no-open` 参数。正式分发的 DMG/ZIP 继续使用 `packages/desktop` 中的 `package:mac` 命令。

### 实现范围

- 自动停止已运行的 OpenCtrlC，清理本机 macOS 构建目录并执行 Desktop `build`。
- 通过 electron-builder 的 `dir` target 生成当前架构的 `.app`，避免本地安装流程依赖 DMG 挂载。
- 跳过 Electron `locale.pak` 语言资源和其他平台可选二进制的单独签名，避免为非当前 macOS 产物重复请求时间戳服务；App、Framework、Helper 和 macOS 原生模块仍正常签名。
- 默认将 APP 安装到 `/Applications/OpenCtrlC.app` 并启动；`--no-install` 用于只生成本地 APP，`--no-open` 用于只构建或安装。
- 通过 `OPENCTRLC_CHANNEL` 统一 Desktop、sidecar 和内置 CLI 的通道，避免开发环境数据库不一致。

### 代码位置

- `script/build-macos.ts`：macOS 构建、安装和启动脚本。
- `script/build_and_run.sh`：统一 shell 入口。
- `package.json`：`bun run desktop:mac` 命令。

### 验证方式

- 在 macOS 上执行 `bun run desktop:mac`，确认 `/Applications/OpenCtrlC.app` 存在且进程成功启动。
- 执行 `bun run desktop:mac -- --no-install --no-open`，确认仅生成 `.app` 且不启动应用。
- 正式分发前执行 `OPENCTRLC_CHANNEL=prod bun run --cwd packages/desktop package:mac`，检查 DMG/ZIP 产物和签名/公证配置。

## GitHub Actions 自动发布 macOS Desktop

### 功能目标

在手动触发正式版本发布时，自动构建、签名、公证并把 macOS Desktop 安装包上传到 GitHub Release，减少本机重复打包和手工上传操作。

### 使用方式

1. 在仓库 Actions Secrets 中配置 Developer ID `.p12`（base64）、`.p12` 密码、Apple ID、App 专用密码和 Team ID。
2. 在 Actions 页面运行 `publish`，填写具体版本或选择版本 bump。
3. 工作流完成后，GitHub Release 中会自动出现 macOS arm64 的 DMG/ZIP，并从 draft 发布为正式 Release。

### 实现范围

- 复用现有 `publish` 工作流的版本、tag 和 Release 创建逻辑。
- 在版本计算阶段注册当前提交的源码 CLI 启动器，确保 changelog 生成不依赖 Runner 上预装的旧版 `openctrlc`。
- CI 版本说明使用 `raw-changelog.ts` 基于 Git 提交确定性生成，不要求 GitHub Runner 配置模型 API 凭证；本机版本说明仍可使用 AI 生成脚本。
- 在 macOS GitHub Runner 中导入临时 Developer ID 证书到临时钥匙串。
- 使用 Apple ID、App 专用密码和 Team ID 执行 notarization；本机钥匙串 profile 不会被复制到 CI。
- 上传 `packages/desktop/dist/*.dmg` 和 `packages/desktop/dist/*.zip`，CLI 资产继续由原有 job 上传。
- 桌面构建失败时不会执行最终的 Release 发布，避免产生没有完整安装包的正式版本。

### 代码位置

- `.github/workflows/publish.yml`：macOS Desktop 构建、公证和 Release 资产上传。
- `docs/release.md`：GitHub Secrets 配置和发布步骤。

### 验证方式

- 本机验证 `xcrun notarytool store-credentials` 和正式 `package:mac` 流程。
- GitHub Actions 手动运行 `publish`，确认日志出现 `notarization successful`。
- 从 Release 下载 DMG，在未安装开发环境的 macOS 上安装并启动，确认 Gatekeeper 不再提示无法验证开发者。

## 会话回合中间步骤折叠

### 功能目标

让会话完成后默认收起最终回复之前的推理、工具调用和上下文探索过程，保留类似 Codex 的紧凑时间线；运行中的回合保持展开，用户也可以手动重新展开查看完整过程。

### 实现范围

- 时间线数据层将最终文本回复之前的可见 assistant parts 聚合为 `AssistantSteps` 行，最终回复继续作为独立行渲染，避免收起时隐藏用户真正要看的答案。
- 折叠状态按 session 缓存在时间线缓存中；回合从运行态切换到完成态时自动收起，并在虚拟列表中触发尺寸重测，避免留下空白或遮挡后续内容。
- 中断、错误和没有最终文本的回合保留原有逐段渲染路径，工具子折叠状态和搜索高亮逻辑继续复用现有实现。
- 折叠触发器复用现有 UI `Collapsible`、步骤多语言文案和回合时长格式，不新增硬编码界面文案。

### 代码位置

- `packages/app/src/pages/session/timeline/rows.ts`、`timeline-row.ts`：步骤行建模和回合分组。
- `packages/app/src/pages/session/timeline/message-timeline.tsx`：折叠状态、触发器、自动收起和虚拟列表测量。
- `packages/session-ui/src/components/session-turn.css`：步骤触发器和内容区样式。
- `packages/app/src/pages/session/timeline/rows-current.test.ts`：中间步骤与最终回复分行的回归测试。

### 验证方式

- 在 `packages/app` 执行时间线 rows/projection 单测。
- 执行 `bun typecheck`（`packages/app`、`packages/session-ui`）。
- 执行 `bun run typecheck:e2e`，并通过 `session-timeline-collapse-state` 回归场景检查完成回合收起后没有虚拟列表空白间距。

## Desktop 会话 ID 原生剪贴板复制

### 功能目标

修复 Desktop 开发模式下点击会话 ID 复制按钮失败的问题，避免 Renderer 的 `navigator.clipboard.writeText` 被 Electron 权限检查拒绝。

### 实现范围

- Desktop 主进程通过受控 IPC 调用 Electron 原生 `clipboard.writeText`。
- App Platform 增加可选的 `writeClipboardText` 能力，会话上下文页在 Desktop 下优先使用原生通道。
- Renderer 检测到旧 preload 未暴露该能力时，复制逻辑先尝试 `execCommand("copy")`，再回退浏览器 Clipboard，避免开发热更新造成 API 版本错位错误。
- Web 端继续使用浏览器剪贴板 API，不改变浏览器权限模型。

### 代码位置

- `packages/desktop/src/main/ipc.ts`：注册原生剪贴板写入 IPC。
- `packages/desktop/src/preload/index.ts`、`packages/desktop/src/preload/types.ts`：安全暴露 IPC 能力。
- `packages/desktop/src/renderer/index.tsx`、`packages/app/src/context/platform.tsx`：接入 Platform 能力。
- `packages/app/src/components/session/session-context-tab.tsx`：会话 ID 复制入口优先使用 Desktop 原生通道。

### 验证方式

- 在 `packages/app` 执行会话 ID 复制单测。
- 分别执行 `bun run typecheck`（`packages/app`、`packages/desktop`）。
- 使用 `bun run dev:desktop` 启动后，在「上下文」页点击会话 ID 复制按钮，确认系统剪贴板中出现完整 session ID。

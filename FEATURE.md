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

## 会话上下文显示有效 System Prompt

### 功能目标

让「上下文」面板展示本次回合实际发送给模型的有效 System Prompt，而不只是统计图中的“系统”占比。有效提示词包含模型基础提示、项目指令、Skills、MCP 指令、环境信息以及用户配置的系统提示覆盖内容。

### 实现范围

- 后端在完成系统提示词组装和插件变换后，将最终文本写入当前用户消息的 `systemPrompt` 字段。
- 保留原有 `system` 字段作为用户输入的系统提示覆盖，避免下一轮请求重复拼接已组装的完整提示词。
- 上下文面板优先展示 `systemPrompt`，旧会话缺少该字段时回退展示原有 `system` 内容。
- 系统提示词仍参与上下文细分的 System 统计，保证可读内容与 token 估算使用同一份数据。
- 长系统提示词默认只显示固定高度预览并提供渐变截断提示，用户点击“展开”后在面板内部滚动查看完整内容，也可以再次收起。
- 系统提示词标题栏提供复制原始有效提示词的操作，复制失败使用 Toast 反馈；复制内容不受当前预览折叠状态影响。

### 代码位置

- `packages/schema/src/v1/session.ts`：用户消息的有效 System Prompt 字段。
- `packages/opencode/src/session/llm.ts`、`packages/opencode/src/session/processor.ts`：捕获并持久化完成请求准备后的提示词。
- `packages/app/src/components/session/session-context-tab.tsx`、`session-context-system-prompt.ts`：上下文面板展示和旧会话兼容回退。

### 验证方式

- 运行上下文细分和上下文指标单元测试。
- 运行 System Prompt 选择逻辑单元测试，确认新字段优先、旧字段回退。
- 在新会话发送一条消息，打开「上下文」，确认长 System Prompt 默认只显示预览，点击“展开”后可查看完整内容；旧会话仍可正常打开。
- 点击复制按钮后，将完整有效 System Prompt 粘贴到文本编辑器，确认复制的是原始文本而非截断预览。
- 执行 `bun run typecheck`，确认 Server API 和 App 使用的生成类型同步。

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

## Skill 列表与会话使用记录兼容

### 功能目标

让 Skills 面板展示与实际运行时一致：兼容新旧 Skill 接口，并能识别旧会话中已经持久化的 Skill 工具调用，避免“模型实际加载过 Skill，但面板显示 0”。

### 实现范围

- 项目可用 Skill 合并 `/api/skill` 和旧实例 `/skill` 接口，按名称去重；旧接口不可用时保留新接口结果，兼容不同版本服务端。
- 旧实例接口返回的 Skill 自动补齐列表所需的 `id`，并保留旧运行时的真实来源路径。
- 会话已使用 Skill 优先读取 `session.skill.activated` 投影；旧会话没有该投影时，从完成态 `tool=skill` Part 的输入或元数据中回退识别。
- 新旧数据同时存在时不重复计数，面板的数量表示实际激活次数，而不是仅表示当前已加载的 Skill 数量。

### 代码位置

- `packages/app/src/utils/session-skills.ts`：统一聚合会话 Skill 激活记录。
- `packages/app/src/context/global-sync/bootstrap.ts`：合并新旧项目 Skill 列表。
- `packages/app/src/context/server-sdk.tsx`：访问兼容的旧实例 Skill 接口并做响应校验。
- `packages/app/src/components/session/session-skills-tab.tsx`、`packages/app/src/components/settings-v2/skills.tsx`：复用统一的会话 Skill 聚合结果。

### 验证方式

- 在 `packages/app` 执行 `bun run typecheck`。
- 执行 `bun test --conditions=solid --preload ./happydom.ts ./src/utils/session-skills.test.ts ./src/context/global-sync/bootstrap.test.ts`。
- 打开包含旧版插件 Skill 的项目，确认可用列表不再只显示内置 `customize-opencode`；打开历史会话，确认已完成的 Skill 工具调用出现在“本次会话已使用”。

## 会话内 Skills 侧栏入口

### 功能目标

将 Skill 从深层设置入口提升为当前会话里的即时信息面板，让用户像查看上下文、Review 一样，随时确认本项目有哪些 Skill，以及本次会话实际激活过哪些 Skill。

### 使用方式

在会话顶部点击 Skills 图标，右侧面板会打开并选中 Skills Tab。面板支持搜索、查看 Skill 来源和 Slash 调用方式；Skill Tab 可以像其他侧栏 Tab 一样关闭或切换。设置页仍保留，作为完整的服务器 Skill 管理入口。

### 实现范围

- 将 Skills 注册为会话侧栏固定 Tab，不再混入文件 Tab 列表或要求用户先进入设置。
- 顶部会话工具栏和旧版标题栏都提供 Skills 快捷入口，入口状态会随当前 Tab 更新。
- 复用项目 Skill 查询和会话 Skill 激活记录，侧栏展示“本次会话已使用”和“当前项目可用”两段内容。
- 覆盖 Skill 搜索、来源详情、激活次数、加载中、加载失败和空列表状态。

### 代码位置

- `packages/app/src/components/session/session-skills-tab.tsx`：会话内 Skills 面板。
- `packages/app/src/components/session/session-skills-tab.css`：侧栏面板样式。
- `packages/app/src/components/session/session-header.tsx`：会话顶部 Skills 快捷入口。
- `packages/app/src/pages/session/session-side-panel.tsx`、`packages/app/src/pages/session/helpers.ts`：侧栏 Tab 注册与渲染。
- `packages/app/src/pages/session/helpers.test.ts`：Skills 不混入文件 Tab 的回归测试。

### 验证方式

- 在 `packages/app` 执行 `bun run typecheck`。
- 执行 `bun test --conditions=solid --preload ./happydom.ts ./src/pages/session/helpers.test.ts`。
- 在桌面宽度的会话中点击顶部 Skills 图标，确认右侧面板直接打开并展示 Skills Tab；点击关闭按钮后应回到上一个侧栏 Tab。

## Skill 来源分组展示

### 功能目标

当一个 Skill 包包含多个 Skill 时，避免把所有 Skill 平铺成无法理解的长列表；用户可以先看到 Skill 来自哪个组，再展开查看组内的每个 Skill。

### 使用方式

设置页和会话内 Skills 侧栏都会按来源显示可展开的分组。像 `superpowers` 这样的目录会聚合显示并标注组内数量；搜索 Skill 时会自动展开包含匹配项的分组。组内仍保留每个 Skill 的描述、来源路径、Slash 调用方式和单项展开详情，“本次会话已使用”继续按具体 Skill 单独统计。

### 实现范围

- 客户端根据 Skill 来源路径推断分组：内置 Skill、`node_modules` 包、`superpowers` 一类的来源目录，以及 `.agents/skills`、`.claude/skills` 等外部 Skill 根目录分别聚合。
- 组头同时显示来源类型和推断出的来源目录，长路径使用截断显示；展开单个 Skill 后仍可查看完整路径。
- 分组只影响展示，不修改 Skill 的发现、加载、权限或服务端协议；服务端未来提供显式组元数据时，可以替换客户端推断逻辑。
- 分组默认在 Skill 数量较少时展开，Skill 较多时收起，用户可以点击组标题切换；搜索结果会保持可见。

### 代码位置

- `packages/app/src/utils/skill-groups.ts`：来源路径分组与组名推断。
- `packages/app/src/utils/skill-groups.test.ts`：内置、外部目录、普通包和 scoped 包分组测试。
- `packages/app/src/components/session/session-skills-tab.tsx`、`session-skills-tab.css`：会话内分组列表。
- `packages/app/src/components/settings-v2/skills.tsx`、`settings-v2.css`：设置页分组列表。

### 验证方式

- 在 `packages/app` 执行 `bun run typecheck`。
- 执行 `bun test --conditions=solid --preload ./happydom.ts ./src/utils/skill-groups.test.ts ./src/utils/session-skills.test.ts ./src/context/global-sync/bootstrap.test.ts ./src/pages/session/helpers.test.ts ./src/i18n/parity.test.ts`。
- 在包含多个同源 Skill 的项目中打开 Skills 面板，确认先显示来源组和数量，展开后能查看每个 Skill；搜索具体 Skill 时确认对应组自动展开。

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
- 普通 Markdown 只导出每轮用户输入和最终助手回答，以及文件引用；中间的 `tool-calls` assistant 消息不会重复生成标题。`Markdown (full)` 额外保留推理折叠块、工具调用输入/输出、子任务、步骤、快照、补丁、重试和压缩等过程信息，并按对话轮次合并 Assistant 标题。
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
- 创建 Release tag 前为 CI Runner 配置固定的 GitHub Actions 提交者身份，保证 annotated tag 可以正常写入并推送。
- macOS Desktop 构建显式提高 Node.js 堆上限；失败重试时，如果 Release 仍是 draft，允许 tag 跟随新的修复提交更新。
- electron-builder 在 CI 中显式关闭隐式发布，由独立的 GitHub Release 上传步骤统一上传并发布资产。
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

让会话完成后默认收起最终回复之前的推理、工具调用和上下文探索过程，保留类似 Codex 的两级紧凑时间线；运行中的回合保持展开，用户也可以手动重新展开查看完整过程。

### 实现范围

- 时间线数据层将最终文本回复之前的可见 assistant parts 聚合为 `AssistantSteps` 行，最终回复继续作为独立行渲染，避免收起时隐藏用户真正要看的答案。
- `AssistantSteps` 展开后，连续的普通工具/思考步骤会再聚合成活动明细组；上下文探索继续复用已有的上下文组，用户可以独立收起第二级明细。
- 折叠状态按 session 缓存在时间线缓存中；回合从运行态切换到完成态时自动收起，并在虚拟列表中触发尺寸重测，避免留下空白或遮挡后续内容。
- 第一级回合折叠和第二级活动组折叠分别保存；完成回合默认只显示第一级摘要，用户重新展开回合时第二级默认可见，手动收起的活动组保持原状态。
- 中断、错误和没有最终文本的回合保留原有逐段渲染路径，工具子折叠状态和搜索高亮逻辑继续复用现有实现。
- 折叠触发器复用现有 UI `Collapsible`、步骤多语言文案和回合时长格式，不新增硬编码界面文案。

### 代码位置

- `packages/app/src/pages/session/timeline/rows.ts`、`timeline-row.ts`：步骤行建模和回合分组。
- `packages/app/src/pages/session/timeline/message-timeline.tsx`：折叠状态、触发器、自动收起和虚拟列表测量。
- `packages/session-ui/src/components/session-turn.css`：步骤触发器和内容区样式。
- `packages/app/src/pages/session/timeline/rows-current.test.ts`：中间步骤与最终回复分行的回归测试。
- `packages/app/e2e/regression/session-timeline-collapse-state.spec.ts`：两级折叠、默认状态和虚拟列表间距回归测试。

### 验证方式

- 在 `packages/app` 执行时间线 rows/projection 单测。
- 执行 `bun typecheck`（`packages/app`、`packages/session-ui`）。
- 执行 `bun run typecheck:e2e`，并通过 `session-timeline-collapse-state` 回归场景检查完成回合收起后没有虚拟列表空白间距。

## 会话回合导航轨道

### 功能目标

当一个会话包含很多轮对话时，在正文左侧提供类似 Codex 的紧凑导航轨道，让用户能看见回合分布、快速定位历史回合，并在不离开当前上下文的情况下预览回合内容。

### 使用方式

桌面端打开包含两轮以上消息的会话后，正文左侧会显示每个用户回合对应的小横线。滚动时当前视口附近的回合会加粗；鼠标悬停横线可以预览用户请求和该回合最后一段助手回复，点击横线即可跳转到对应回合。

### 实现范围

- 基于现有 Timeline 虚拟列表的测量结果计算回合在完整会话中的相对位置，不额外渲染一份消息正文。
- 桌面端通过独立左侧网格列预留导航安全区，正文 ScrollView 不与标记共享横向空间；单回合和移动端不保留空白列。
- 复用现有 `scrollToMessage` 定位链路，保留虚拟列表、历史锚点、URL hash 和自动跟随状态的既有行为。
- 预览内容从真实的 user/assistant text part 中提取，长文本通过 CSS 截断；没有新的固定文案依赖，不破坏现有多语言 parity。
- 导航轨道只在桌面宽度显示，并提供 hover、active、pressed、focus-visible、减少动画和无预览内容等状态。
- 回合横线保持窄视觉样式，但使用 `42px × 24px` 的透明命中区域，降低精确点击细线的操作成本。
- 轨道顶部依次提供跳到最早回合、上一个回合按钮，底部依次提供下一个回合、跳到最新回合按钮，均复用既有回合定位链路；到达滚动边界后相邻跳转按钮自动禁用。
- 首尾按钮采用“横线 + 实心箭头”，上一/下一按钮只使用方向箭头，确保边界跳转和相邻跳转在小尺寸下也能区分。
- 导航轨道顶部预留独立呼吸空间，首个边界按钮不贴合会话容器上边缘，保持按钮与正文安全区的视觉节奏。

### 代码位置

- `packages/app/src/pages/session/timeline/session-timeline-navigator-view.tsx`：导航轨道交互和预览浮层。
- `packages/app/src/pages/session/timeline/session-timeline-navigator-model.ts`：虚拟列表测量到导航标记位置的纯函数。
- `packages/app/src/pages/session/timeline/session-timeline-navigator.css`：轨道、标记和预览浮层样式。
- `packages/app/src/pages/session/timeline/message-timeline.tsx`：将 Timeline 回合、测量值和现有跳转逻辑接入导航轨道。

### 验证方式

- 在 `packages/app` 执行 `bun test --conditions=solid --preload ./happydom.ts ./src/pages/session/timeline/session-timeline-navigator.test.ts`。
- 在 `packages/app` 执行 `bun typecheck`。
- 在桌面端打开长会话，检查标记数量、悬停预览、点击定位、继续生成时的自动跟随和移动端隐藏行为。

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

## 统一 V1/V2 Skill 发现与运行时来源展示

### 功能目标

让 V2 Skill 发现规则继承 V1 的全局和项目级外部 Skill 目录，避免 `~/.agents/skills`、`~/.claude/skills` 中的技能因协议切换消失；同时在 Skills 面板中明确显示当前服务协议和已经发现的 Skill 来源路径。

### 实现范围

- V2 配置 Skill 插件默认注册用户目录下的 `.agents/skills`、`.claude/skills`，以及当前项目到项目根之间各级目录下的对应外部 Skill 目录。
- 保留 `OPENCTRLC_DISABLE_EXTERNAL_SKILLS`、`OPENCTRLC_DISABLE_CLAUDE_CODE` 和 `OPENCTRLC_DISABLE_CLAUDE_CODE_SKILLS` 的关闭行为，与 V1 扫描规则保持一致。
- Skills 设置面板和会话 Skills 面板显示当前检测到的 V1/V2 服务协议，并按实际发现结果列出来源目录与其中的 Skill 数量。
- 继续保留单个 Skill 的实际 `SKILL.md` 路径和来源组展示，便于从来源目录追溯到具体文件。

### 代码位置

- `packages/core/src/config/plugin/skill.ts`：V2 外部 Skill 来源注册和 V1 兼容环境开关。
- `packages/app/src/components/skill-runtime-info.tsx`、`skill-runtime-info.css`：服务协议和来源目录信息条。
- `packages/app/src/components/settings-v2/skills.tsx`、`components/session/session-skills-tab.tsx`：设置页和会话页接入运行时信息。
- `packages/core/test/config/skill.test.ts`：全局、项目祖先目录和配置来源注册测试。

### 验证方式

- 在 `packages/core` 执行 `bun test test/config/skill.test.ts test/skill.test.ts`。
- 在 `packages/core`、`packages/app` 分别执行 `bun typecheck`。
- 在 `packages/app` 执行 `bun test --conditions=solid --preload ./happydom.ts src/utils/skill-groups.test.ts`。
- 使用 `bun run dev:desktop` 打开 Skills 面板，确认看到服务协议、`.agents/skills` 来源和 `kimi-webbridge`。

## Skills 侧栏入口默认聚焦

### 功能目标

从右上角打开会话侧栏时，如果 Skills Tab 已经打开，直接展示 Skills 内容，避免用户先打开侧栏、再额外点击一次 Skills Tab。

### 实现范围

- 右上角侧栏按钮打开面板时优先激活已存在的 Skills Tab。
- 未打开 Skills Tab 时保留原有 Review/当前文件 Tab 行为。
- 关闭侧栏仍只关闭面板，再次打开时继续遵循上述默认聚焦规则。

### 代码位置

- `packages/app/src/pages/session/helpers.ts`：侧栏打开时的 Tab 优先级。
- `packages/app/src/components/session/session-header.tsx`：右上角侧栏按钮行为。
- `packages/app/src/pages/session/helpers.test.ts`：Skills 已打开和未打开两种回归场景。

## Skills 页面间距重梳理

### 功能目标

统一设置页和会话侧栏 Skills 面板的垂直节奏，避免运行时信息、分区标题、列表和空状态在视觉上黏连，提升长列表和窄侧栏下的可读性。

### 实现范围

- 会话 Skills 滚动区域使用明确的容器间距和分区间距，不再只依赖相邻分区选择器。
- 运行时信息卡、Skill 列表和加载/空状态统一使用卡片边界、内边距和层级背景。
- 分组头、分组内 Skill 行和详情区域补齐上下留白，并为窄侧栏增加响应式内边距。
- 服务版本 Tag 使用独立 value 包裹层，避免 flex 通用规则拉伸 Tag。

### 代码位置

- `packages/app/src/components/session/session-skills-tab.css`：会话侧栏 Skills 布局和间距。
- `packages/app/src/components/settings-v2/settings-v2.css`：设置页 Skills 布局和间距。
- `packages/app/src/components/skill-runtime-info.tsx`、`skill-runtime-info.css`：运行时信息卡结构和间距。

### 验证方式

- 在 `packages/app` 执行 `bun typecheck`。
- 在 `packages/app` 执行 Skills 相关单元测试。
- 执行 `bun run build`，确认设置页和会话侧栏样式正常编译。
- 在设置页和会话侧栏分别检查运行时信息、分区、展开组、空状态和窄窗口布局。

## Skill 列表刷新与 Kimi WebBridge 可见性

### 功能目标

修复 Skill 文件在服务启动后新增或更新时，Skills 面板仍显示旧缓存、导致 `kimi-webbridge` 不可见的问题。每次请求 Skill 列表时刷新目录发现缓存，保证 V1/V2 接口和面板看到同一份最新结果。

### 实现范围

- V2 Skill 服务提供轻量 `refresh` 操作，只清理已注册目录的内容缓存，不改变来源注册和 Skill 分组规则。
- V2 `/api/skill` 列表接口请求前刷新缓存，V1 `/skill` 兼容接口同时使当前实例的发现结果失效并重新扫描。
- 保留现有 `~/.agents/skills`、`~/.claude/skills`、项目目录和配置目录的发现范围；刷新后由前端继续按来源组展示具体 Skill。
- 增加新增目录 Skill 的回归测试，覆盖 `kimi-webbridge` 这类服务启动后出现的 Skill。

### 代码位置

- `packages/core/src/skill.ts`：V2 Skill 内容缓存刷新。
- `packages/server/src/handlers/skill.ts`：V2 列表接口刷新后读取。
- `packages/opencode/src/skill/index.ts`、`server/routes/instance/httpapi/handlers/instance.ts`：V1 实例发现缓存刷新和兼容接口接入。
- `packages/core/test/skill.test.ts`：新增 Skill 后刷新列表的回归测试。

### 验证方式

- 在 `packages/core` 执行 `bun test test/skill.test.ts` 和 `bun typecheck`。
- 在 `packages/server`、`packages/opencode`、`packages/app` 分别执行 `bun typecheck`。
- 启动本地服务后分别请求 `/api/skill`、`/skill`，确认返回列表包含 `kimi-webbridge` 及其 `/Users/ponponon/.agents/skills/kimi-webbridge/SKILL.md` 路径。

## GitHub Release 说明统一格式

### 功能目标

让 OpenCtrlC 的 GitHub Release 说明与 AIVPlayer 保持一致，优先展示用户可理解的功能、可靠性、修复和下载入口，避免把完整提交历史直接铺满发布页。

### 实现范围

- 确定性变更说明统一使用 `Features`、`Bug Fixes` 和 `Downloads` 分组，并按 Core、TUI、Desktop、SDK、Extensions 展示提交证据。
- 正式版本生成说明时自动补充 CLI 与 macOS Desktop 的实际 Release 资产链接；Windows/Linux Desktop 当前未发布安装包时明确说明，不生成虚假下载入口。
- 末尾统一提供上一稳定版本到当前版本的 `Full Changelog` 对比链接。
- 已将 v0.1.3 的历史 Release 正文整理为同一格式，保留真实资产和 v0.1.1 到 v0.1.3 的变更范围。

### 代码位置

- `script/raw-changelog.ts`：确定性 Release 正文和下载链接生成。
- `script/version.ts`：创建 Release 时传递当前版本号。
- `.github/workflows/publish.yml`：正式发布使用确定性说明模式。

### 验证方式

- 执行 `bun run script/raw-changelog.ts --help`，确认支持 `--version` 参数。
- 使用已发布版本检查 Release 页面包含 Features、Performance and Reliability、Bug Fixes、Downloads 和 Full Changelog。
- 检查 Downloads 链接只指向实际上传的 GitHub Release 资产。

## OpenCtrlC Release 资产同步到 Cloudflare R2

### 功能目标

按照 AIVPlayer 的发布资产管理方式，将 GitHub Release 中的 OpenCtrlC 桌面安装包同步到 Cloudflare R2，并通过 `openctrlc-releases.quniv.cn` 提供稳定的公开下载地址。

### 实现范围

- 新增 `script/publish-release-downloads.mjs`，读取已发布 Release 的安装包资产，计算 SHA-256 后上传到 `openctrlc-releases` 存储桶。
- R2 对象路径统一为 `openctrlc/releases/{version}/{asset}`，并在 `openctrlc/releases/download-manifest.json` 保存最近若干版本的资产清单。
- 新增 `.github/workflows/sync-downloads.yml`，支持在 GitHub Actions 中按 Release tag 手动同步和恢复下载资产。
- 通过 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID` Repository secrets 连接 R2；首次同步 `v0.1.3` 已完成并通过公开清单和 macOS/Windows 对象回读校验。当前官网接口仍保留 GitHub Release 作为下载来源，待官网平台与实际 Release 资产命名统一后再切换公开下载入口。
- 单文件超过 Cloudflare R2 REST API 300 MB 限制时，在清单中保留 GitHub 资产地址作为兜底，不会伪造不完整的 R2 文件。

### 验证方式

- 执行 `node --check script/publish-release-downloads.mjs`。
- 在 GitHub Actions 的 `Sync OpenCtrlC Downloads` 中传入已经发布的 tag，确认 R2 出现版本目录和 `download-manifest.json`。
- 访问 `https://openctrlc-releases.quniv.cn/openctrlc/releases/download-manifest.json`，确认返回 JSON 清单；访问具体资产 URL，确认文件下载和 SHA-256 一致。
- 已验证 `v0.1.3` 清单返回 HTTP 200，`openctrlc-mac-arm64.dmg` 与 `openctrlc-windows-x64.zip` 返回 HTTP 200，且响应大小与清单一致。

## Cloudflare Pages 官网临时地址

### 功能目标

在购买独立根域名之前，先使用 Cloudflare Pages 提供的 `openctrlc.pages.dev` 发布 OpenCtrlC 官网和文档，降低早期运营成本。

### 实现范围

- 复用 `packages/web` 现有 Astro 文档站作为 Pages 发布内容，并在构建完成时把文档首页复制为根路径入口。
- 将生产站点的 canonical URL、站点标题和 GitHub 链接切换到 OpenCtrlC 与 `openctrlc.pages.dev`。
- 安装脚本链接改为 GitHub 仓库 `dev` 分支中的可验证原始脚本地址，避免 Pages 暂未提供 `/install` 路由时产生失效命令。
- Pages 项目名称固定为 `openctrlc`，后续可继续绑定自有域名而不改变构建产物。

### 代码位置

- `packages/web/config.mjs`：生产站点地址、GitHub 地址和社区入口。
- `packages/web/astro.config.mjs`：文档站标题。
- `packages/web/src/components/Lander.astro`：官网安装命令和页脚品牌。
- `packages/web/src/components/Footer.astro`：文档页脚品牌。
- `packages/web/src/content/docs/index.mdx`：文档首页安装和配置说明。

### 验证方式

- 在 `packages/web` 目录执行 `bun run build`，确认 Astro/Cloudflare Pages 产物生成。
- 检查构建产物中的 canonical URL 和站点标题均指向 `openctrlc.pages.dev` / `OpenCtrlC`。
- 发布后访问 `https://openctrlc.pages.dev/` 和 `https://openctrlc.pages.dev/docs/`，确认首页和文档页均返回 HTTP 200。
## OpenCtrlC 官网品牌与功能说明收敛

### 功能目标

让官网只展示 OpenCtrlC 自己已经提供的品牌、安装方式和功能，避免用户看到上游 OpenCode 的 Logo、截图、Zen/Go 托管服务或失效的上游链接。

### 实现范围

- 替换官网 Logo、分享页图标和语言选择器的品牌残留。
- 移除当前产品没有提供的 Zen、Go 文案、入口和中英文页面。
- 删除带有上游品牌的官网截图，收紧安装、提供商和企业版说明。
- 将分享卡片改为 Cloudflare Pages 本地静态图片，避免继续请求上游社交卡片服务。

### 验证方式

- 构建 `packages/web`，确认 Astro/MDX 构建成功。
- 检查生成页面不再出现 OpenCode Logo、Zen 入口和上游分享卡片 URL。
- 部署后访问 `/`、`/docs/`、`/docs/zh-cn/`，确认状态码为 200。

## Desktop 会话分叉

### 功能目标

在桌面版复用 OpenCode 已有的 `session.fork` 服务能力，让用户可以从任意已完成的助手回复创建独立聊天分支，并选择当前工作空间或新的 Git 工作树作为分支位置。

### 实现范围

- 在共享会话消息的助手回复操作区增加“从此消息创建新会话”入口，分叉结果保留当前用户消息和对应助手回复；客户端根据服务端的排他边界协议自动定位下一条消息。
- 扩展现有分叉对话框为“选择消息 → 选择位置”的两步流程，保留命令面板入口和搜索历史消息能力。
- Git 项目提供当前工作空间和新工作树两种位置；新工作树创建成功后，分叉会话通过目标目录的 SDK 客户端创建并自动跳转。
- 命令面板分叉保留原用户输入和附件上下文；助手回复分叉进入新会话后保持空白输入框。进行中禁用重复操作，失败显示本地化错误并保留对话框。

### 代码位置

- `packages/session-ui/src/components/message-part.tsx`：助手回复分叉按钮及操作透传。
- `packages/app/src/pages/session.tsx`：捕获当前会话上下文并打开分叉对话框。
- `packages/app/src/components/dialog-fork.tsx`：消息选择、工作空间/工作树选择、分叉和导航流程。
- `packages/app/src/utils/session-fork.ts`：将包含当前助手回复的语义转换为服务端排他分叉边界。
- `packages/opencode/src/session/session.ts`：已有会话消息前缀克隆实现，无需新增服务端协议。

### 验证方式

- 在 `packages/app` 和 `packages/session-ui` 分别执行 `bun typecheck`。
- 执行分叉边界单测，覆盖中间回复、最后一条回复和消息未加载三种情况。
- 执行时间线模型单测，确认分叉入口的消息渲染改动不影响时间线状态模型。
- 在 Git 项目中验证助手回复操作区可打开分叉对话框，并分别验证当前工作空间和新工作树导航。

## Desktop 跨平台正式发布与图标适配门禁

### 功能目标

让正式版 GitHub Release 同时提供 macOS Apple Silicon、Windows x64/ARM64 和 Linux x64/ARM64 桌面安装包，并在发布前阻止图标尺寸、透明圆角或 macOS Dock inset 配置回归。

### 实现范围

- `publish` 工作流将 Windows 和 Linux Desktop 构建拆成 x64/ARM64 矩阵，分别生成 Windows NSIS 和 Linux AppImage/DEB/RPM，并在构建任务完成后上传真实资产到 draft Release。
- Release 说明和官网下载路由同步列出 macOS DMG/ZIP、Windows x64/ARM64 安装程序和 Linux x64/ARM64 DEB/AppImage/RPM，链接只使用工作流实际上传的文件名。
- 新增 `packages/desktop/scripts/check-icons.ts` 和 `check:icons` 脚本，解析 PNG、ICO 和 ICNS 的真实像素数据，检查平台所需尺寸层级、四角透明度、边缘填充，并确认 `dock.png` 与 ICNS 的 256px Retina 图层逐像素一致。
- macOS、Windows、Linux 构建前后都执行图标门禁；`0.2.1` 起 Windows/Linux 的每个架构矩阵任务都必须通过同一套门禁。

### 代码位置

- `.github/workflows/publish.yml`：三平台 Desktop 构建、图标门禁和 Release 上传。
- `packages/desktop/scripts/check-icons.ts`：跨平台图标容器及像素校验。
- `packages/desktop/electron-builder.config.ts`：macOS、Windows、Linux 图标和安装包目标配置。
- `script/raw-changelog.ts`：跨平台 Desktop 下载链接生成。

### 验证方式

- 在 `packages/desktop` 执行 `bun run check:icons`，确认 dev、beta、prod 三套图标均通过。
- 使用 `--channel prod --resources` 检查生产构建实际复制到 `resources/icons` 的图标。
- GitHub Actions 成功后检查 Release 同时包含 `openctrlc-win-x64.exe`、`openctrlc-win-arm64.exe`、`openctrlc-linux-x64.*`、`openctrlc-linux-arm64.*`，以及现有 macOS 资产。

## 面向用户的 GitHub Release 说明

### 功能目标

让正式版本说明保持简洁、可读，并与 AIVPlayer 的发布格式一致，避免把内部提交日志直接展示给用户。

### 实现范围

- 自动生成的正文按 `Features`、`Bug Fixes`、`Downloads` 和 `Full Changelog` 组织，去掉 conventional commit 前缀和测试、构建噪音，不展示 commit ID、内部模块分组或提交作者标记。
- 仓库所有者自动视为内部贡献者；只有存在第三方贡献者时才生成 `Contributors` 区块。
- Downloads 先按 CLI、Desktop 分类，再按 macOS、Linux、Windows 平台分组，仍列出真实架构和文件格式，不因精简正文而隐藏可下载内容。

### 代码位置

- `script/raw-changelog.ts`：生成简洁的 Release 正文和第三方贡献者感谢。
- `script/version.ts`：优先读取指定版本的手工 Release 正文。
- `docs/releases/v0.2.0.md`：保存 `v0.2.0` 的面向用户发布说明。

### 验证方式

- 生成版本说明后检查正文不含 commit ID 和仓库所有者 Contributors。
- 对照 GitHub Release 资产，确认 Downloads 中的链接和文件名完全一致，并确认 Windows/Linux 两种架构均有可用路由。

## 2026-09-10：官网产品化与公开文档收口

### 功能目标

把 OpenCtrlC 从“能用的开源仓库”整理成可以直接面向用户宣传的正式项目：官网负责产品介绍，文档负责真实能力说明，README 和 Release 说明保持同一套入口、平台和服务边界。

### 实现范围

- 重做官网首页的产品叙事、终端预览、安装入口、工作流说明、功能介绍和 FAQ，并补齐中英文与繁体中文首页文案。
- 将官网、文档、README、桌面元数据和安装脚本统一到 `openctrlc.pages.dev`、`openctrlc-docs.pages.dev` 与 OpenCtrlC GitHub 仓库。
- 移除官网导航和文档中的 Zen、Go、旧企业宣传、旧分享服务和旧社区入口；历史路由统一跳转到当前首页或提供商文档。
- 将多语言文档中会误导用户的旧安装地址、旧分享域名和旧服务商说明改为 OpenCtrlC 当前支持的本地优先工作流；缺少可靠翻译的专题页回退到准确的主文档，避免展示拼接后的伪服务。
- 更新日文、韩文、中文和英文 README，明确 CLI/Desktop 下载范围、平台架构、数据边界、开发检查和独立维护关系。
- 准备 `v0.2.2` 面向用户的 Release 正文，覆盖近期导出、会话分叉和跨平台发布修复；继续保留 CLI/Desktop、平台和架构三级下载结构。
- 将旧 `/zen`、`/go`、`/black` 官网入口改为正式跳转，并让全局社交卡片使用 OpenCtrlC 资源。
- 将配置 Schema、邀请邮件和认证界面的公开链接与品牌统一到 OpenCtrlC，避免生成的配置说明或账户邮件继续指向上游产品。

### 代码位置

- `packages/console/app/src/routes/index.tsx` 与 `index.css`：官网首页内容和视觉系统。
- `packages/console/app/src/routes/zen/index.tsx`、`go/index.tsx`、`black.tsx`：历史宣传路由跳转。
- `packages/web/src/content/docs/`：文档、翻译和服务边界说明。
- `README.md`、`README.zh.md`、`README.ja.md`、`README.ko.md`：项目入口文档。
- `.github/workflows/deploy.yml`、`docs/release.md`、`docs/releases/v0.2.2.md`：Pages 部署和版本发布说明。

### 验证方式

- 执行 `bun run --cwd packages/console/app typecheck`。
- 执行 `bun run --cwd packages/console/app build`，确认官网、配置 Schema 和 sitemap 生成成功。
- 执行 `SST_STAGE=production bun run --cwd packages/web build`，确认文档和多语言搜索索引生成成功。
- 检查公开源码不再包含旧安装域名、旧分享域名或 Zen/Go 产品入口。

### GitHub Actions 自管理接入

GitHub Action 默认直接使用运行器提供的 `GITHUB_TOKEN`，并由生成器写入
`contents`、`issues` 和 `pull-requests` 的最小写权限。OIDC Token 交换仅作为
显式配置 `OIDC_BASE_URL` 的私有扩展保留；会话分享默认关闭，只有同时配置外部
`SHARE_URL` 才会启用。

代码位置：`github/action.yml`、`github/README.md`、
`packages/opencode/src/cli/cmd/github.handler.ts` 和
`packages/opencode/src/cli/cmd/github-workflow.ts`。

## 2026-09-12：补齐 Markdown 数学公式语法

### 功能目标

让会话消息中的常见 LaTeX 数学分隔符都能被 Markdown 渲染器识别，尤其修复公式写在列表正文同一行时仍显示原始 `$$...$$` 的问题。

### 实现范围

- 支持行内 `\(…\)` 和 `$…$` 数学公式。
- 支持独立块公式 `$$…$$`，包括单行写法和原有多行写法。
- 支持 `\[…\]` 显示公式。
- 继续统一通过 KaTeX 生成 HTML，并沿用现有 Markdown 安全过滤。

### 代码位置

- `packages/ui/src/context/marked-parser.tsx`：数学分隔符扩展和 KaTeX 渲染。
- `packages/ui/src/context/marked-parser.test.ts`：行内、块级及列表内公式回归测试。

### 验证方式

- 使用截图中的 `$$\\frac{...}{...}$$` 列表文本解析，结果包含 KaTeX 的 `katex-display` 节点且不再保留 `$$` 原文。
- 运行 `packages/ui` 的 Markdown parser 测试。

## 2026-09-12：流式 Markdown 等待期间保持格式化

### 功能目标

避免会话流式输出在 Markdown worker 尚未完成解析时直接显示原始 `**`、链接标记或其他语法符号，让粗体等基础格式从首屏开始就保持一致。

### 实现范围

- 增加不依赖 Shiki 的同步 Markdown 基础解析器，复用现有链接和 KaTeX 扩展。
- 增加兼容中日韩文字紧邻 `**...**`/`__...__` 分隔符的粗体解析，匹配 Typora 等常见编辑器的使用习惯。
- 将会话渲染等待 worker 结果时的浏览器 fallback 改为同步解析并继续经过 DOMPurify 安全过滤。
- 服务端渲染继续使用原有转义文本 fallback，避免引入浏览器依赖。
- 代码块仍由现有 worker 负责高亮，不把重型 Shiki 解析搬回主线程。

### 代码位置

- `packages/ui/src/context/marked-parser.tsx`：同步基础解析器。
- `packages/session-ui/src/components/markdown.tsx`：流式 Markdown fallback。
- `packages/ui/src/context/marked-parser.test.ts`：跨行粗体回归测试。

### 验证方式

- 对截图中跨行的 `**列式存储...\\n**最底层...` 解析，结果包含 `<strong>` 且不保留 `**`。
- 运行 UI Markdown parser 测试和 Session UI 类型检查。

## 远程 Git 标签同步入口

### 功能目标

让本地 Git Graph、发布检查和新环境初始化能够稳定看到 GitHub 上已经创建的
版本标签，避免远程 Release 已完成但本地 refs 不完整。

### 实现范围

- 新增 `script/sync-tags`，默认同步 `origin` 的全部标签。
- 首次运行时为当前仓库设置 `remote.<name>.tagOpt=--tags`，让后续普通 fetch
  也会获取后来创建、但目标提交已经存在于本地的标签。
- 使用 `git fetch <remote> --tags --force` 以远程标签为准修复本地缺失或落后的
  tag ref，并输出同步后的标签列表。
- 在 `docs/release.md` 记录标签 ref 与 GitHub Release 的关系、修复命令和验收方式。

### 验证方式

- 执行 `./script/sync-tags`，确认远程标签出现在 `git tag --list` 和 Git Graph 中。
- 检查 `git config --local --get remote.origin.tagOpt` 返回 `--tags`。
- 执行普通 `git fetch origin` 后，确认已同步标签仍然存在。

## UI 包 DOM 测试环境

### 功能目标

让 `packages/ui` 可以直接运行包含真实 DOM 交互的单元测试，并与应用包使用同一套 Happy DOM 运行时。

### 实现范围

- 为 UI 包增加独立的 Happy DOM preload 入口。
- 让 UI 包的 Bun 测试脚本自动加载该环境，覆盖 DOM、事件和 `PointerEvent` 测试。
- 复用工作区已有的 `@happy-dom/global-registrator` 版本，避免测试依赖漂移。

### 验证方式

- 在 `packages/ui` 执行 `bun run test`，确认 DOM 测试不再因 `document is not defined` 失败。

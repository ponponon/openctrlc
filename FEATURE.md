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

在 Desktop 版本中通过文件菜单或命令面板按 sessionID 导入 OpenCode 会话，导入完成后自动刷新当前项目的会话列表并打开该会话。

### 使用方式

1. 在 Desktop 中打开一个本地项目。
2. 通过「文件 → 从 OpenCode 导入会话」或命令面板执行 `session.importOpencode`。
3. 输入 `ses_...` 格式的 sessionID，点击「查找会话」；界面会展示会话标题、消息数量和 OpenCode 工作目录。
4. 默认使用会话记录中的工作目录作为导入目标；如果需要导入到其他项目，可以点击「选择文件夹」，也可以恢复为会话目录。
5. 如果 OpenCode 数据库不在默认位置，可选择自定义 `.db` 文件，切换数据库后重新查找。

### 实现范围

- Renderer 只负责表单、当前项目和导航，不直接读取 OpenCode SQLite。
- Desktop 主进程通过 CLI 的 `--opencode-info` 只读查询会话元数据，避免前端猜测目录或直接访问数据库。
- Desktop 开发版直接调用工作区当前的 CLI 源码，避免被 `resources/openctrlc` 中的旧二进制阻塞本地验证；打包版复用随应用发布的 `openctrlc import` CLI，并使用 Desktop 当前的本地状态目录，避免重复实现导入协议。
- 打包版启动查询或导入前会检查内置 CLI 是否包含 `--opencode-db` 和 `--opencode-info`，旧版本会提示更新，不会静默执行错误的文件导入流程。
- IPC 仅接受绝对路径和合法 sessionID；远程 HTTP/SSH/WSL 服务器不会显示为可导入目标。
- 目标目录可由原生文件夹选择器修改；导入成功后按最终目标目录刷新项目会话、强制同步，再创建并选中对应的 session tab。

### 代码位置

- `packages/desktop/src/main/background-cli.ts`：主进程调用打包 CLI 并传递工作目录、数据库路径。
- `packages/desktop/src/main/ipc.ts`、`packages/desktop/src/preload/*`：安全 IPC 和 preload 类型。
- `packages/app/src/components/dialog-import-opencode-session.tsx`：导入对话框。
- `packages/app/src/app.tsx`、`packages/app/src/desktop-menu.ts`：命令面板注册和 Desktop 文件菜单入口。

### 验证方式

- 执行 `bun typecheck`（`packages/app`、`packages/desktop`）。
- 执行 app 单测，覆盖 sessionID 校验、菜单注册和多语言 key parity。
- 使用当前源码构建 CLI 后执行 `openctrlc import --help`，确认包含 `--opencode-db` 和 `--opencode-info`；发布桌面包时使用同版本平台 CLI 包。

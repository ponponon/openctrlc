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

# Session ID Context Display

## Goal

让 desktop 用户可以在当前会话的 Context 详情面板中查看并复制完整的 `sessionID`，方便排查问题、反馈错误和关联导出的会话数据。

## Scope

- 在现有 `SessionContextTab` 统计区域增加 `Session ID` 项。
- 显示完整的当前会话 ID；没有当前会话时显示现有的占位符 `—`。
- 提供复制按钮，复制完整 ID，而不是截断后的视觉文本。
- 复制成功沿用现有成功 toast 风格，复制失败沿用现有请求错误处理。
- 增加英文、简体中文和其余 app locale 的 i18n key；其余 locale 使用英文 fallback，满足现有 parity 约束。
- 不新增后端接口，不改变 Session schema、路由或持久化模型。

## UX

会话 ID 与现有 Context 统计项使用同一网格和标签样式。值区域使用单行布局：ID 文本可截断以适配窄面板，完整 ID 通过元素的 `title` 保留可发现性；复制图标按钮放在值右侧，使用现有 Button/Icon 组件和交互样式。

当 `params.id` 不存在时，不渲染 Session ID 项和复制按钮，避免对占位符执行无效操作。复制依赖浏览器 Clipboard API；失败时通过现有错误提示反馈，不吞掉错误。

## Data Flow

`SessionContextTab` 已通过 `useSessionLayout()` 获得 `params.id`。该值就是当前路由对应的 session ID，因此直接用于展示和复制，不需要额外读取或请求会话数据。

## Testing

- 为复制逻辑增加一个可独立测试的行为测试，验证存在 ID 时写入完整 ID。
- 验证没有 ID 时不会触发复制。
- 验证所有 app locale 都包含新增的 i18n key。
- 运行 app 包相关测试和 `bun typecheck`。

## Non-goals

- 不在聊天标题栏常驻显示 ID。
- 不只显示短 ID。
- 不为 sessionID 增加新的存储字段或协议字段。

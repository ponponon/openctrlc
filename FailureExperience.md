## ⚠️ 重要：User-Agent 必须保持为 opencode

**禁止**将发送给 opencode.ai zen 服务器的 User-Agent 改为 `openctrlc`。

作为 opencode 的下游 fork，我们必须保持与上游一致的 User-Agent 才能正常使用 zen 服务。
如果 User-Agent 包含 `openctrlc`，服务器会对免费用户施加更严格的限制，导致 "Free usage exceeded" 错误。

**需要保持 `opencode` User-Agent 的文件**：

- `packages/opencode/src/installation/index.ts` → `userAgent()` 函数
- `packages/opencode/src/session/llm/request.ts` → `USER_AGENT` 常量
- `packages/opencode/src/tool/websearch.ts` → `parallelAuthHeaders()` 函数
- `packages/opencode/src/tool/webfetch.ts` → Cloudflare 挑战处理
- `packages/core/src/models-dev.ts` → `USER_AGENT` 常量
- `packages/core/src/tool/webfetch.ts` → Cloudflare 挑战处理

**法律依据**：opencode 使用 MIT 协议，允许自由修改和分发。保持相同的 User-Agent 表明"我是 opencode 兼容客户端"，符合协议要求。

**历史教训**：2026-08-20 的 commit `bce80bb` 把 `request.ts` 的 User-Agent 从 `opencode` 改成了 `openctrlc`，导致免费模型无法使用。

## Desktop 需求不能只实现 CLI

用户提出「根据 sessionID 把记录从 opencode 导入 openctrlc」时，不能只完成 CLI 入口；Desktop 也必须提供可发现的文件菜单/命令面板入口、表单校验、数据库选择、IPC 调用和导入后的会话刷新导航。以后新增跨端功能时，应先按 CLI、Web/App、Desktop 三个交付面检查入口和验证链路，并把 Desktop 的本地能力放在主进程，通过受校验的 IPC 暴露给 Renderer。

## Desktop 功能必须同步验证内置 CLI 版本

Desktop 的主进程可以调用随应用打包的 CLI，但 `resources/openctrlc` 可能仍是上一次发布的旧二进制。新增 CLI 参数后，如果只验证 TypeScript 源码而不检查实际二进制，开发版或已安装版本会出现“入口存在但功能不可用”。以后跨 CLI/Desktop 的功能要区分开发版源码调用和打包版 CLI 包，并在打包版执行前检查必要参数；发布时必须让 Desktop 使用包含该功能的同版本平台 CLI 包。

## OpenCode 导入目标目录必须由会话元数据推导

OpenCode 的 session 记录本身包含 `directory`（即会话工作目录）。如果导入对话框只显示当前正在打开的项目，会让用户误以为来源会话和导入目标天然是同一个项目，跨项目导入时尤其容易产生误操作。以后涉及外部会话导入时，应先按 sessionID 查询来源标题、消息数量和工作目录，将来源目录作为默认目标；同时提供原生文件夹选择器修改目标，并明确标识“来自会话”或“自定义目标”。

## 异步动态 Dialog 必须显式保留上下文

命令系统的异步回调在动态导入 Dialog 后再挂载组件，不能依赖组件函数执行时仍处于原始 Provider owner。否则组件内直接调用 `useLanguage` 等 context hook 会出现“必须在 context provider 内使用”的运行时崩溃。以后从异步命令打开动态 Dialog 时，应在确定处于 Provider 树内的入口捕获所需上下文并通过 props 注入，同时保留 Dialog 控制器；不能只依赖构建和类型检查判断这条渲染链路可用。

## 会话内容标题必须保留项目上下文

只显示 session title 时，不同项目中同名会话无法在内容区标题中快速区分。需要区分最顶部的标签栏和会话内容区标题，项目名应使用现有项目解析逻辑或工作目录名作为前缀，展示为“项目名 / 会话标题”；重命名交互必须继续使用原始 session title，保存时只提交原始值，避免把展示格式写入会话数据。

## 长内容 Dialog 必须由内容区域负责滚动

旧版 Dialog 的 `dialog-body` 默认使用 `overflow: hidden`，表单内容如果只依赖外层 Dialog 的滚动，会在固定高度下被裁切且无法响应滚轮。内容可能超出窗口的表单必须设置 `min-h-0 flex-1 overflow-y-auto`，让表单成为实际滚动容器，同时保留 Dialog 标题和说明区域固定可见。

## Dialog 内容区的横向内边距必须与头部对齐

导入弹窗曾让表单使用 `px-2.5`，而通用 Dialog 的标题和说明区域实际使用约 20px 的左右内边距，导致标题、区块标题和卡片左右边界不在同一条线上。以后基于通用 Dialog 编写表单时，必须先核对 `dialog-header`、`dialog-description` 的实际 padding，内容区统一使用相同的视觉内边距，并检查长路径、错误状态和底部操作区的左右边界。

## 短提示文案不要滥用句末标点

字段下方的辅助提示属于短标签式文案，不是独立正文；中文界面应避免在这类提示末尾添加句号，并保持同一字段不同状态的文案风格一致。修改文案时还要优先使用自然、紧凑的表达，例如将“选择要导入到的文件夹”改为“选择导入目标文件夹”。

## Desktop 导入 CLI 必须与 sidecar 使用同一通道数据库

开发版 Desktop 的 sidecar 使用构建时注入的 `dev` 通道，而直接执行工作区 CLI 源码时没有构建时通道常量，默认会退回 `local`。如果导入命令只验证 CLI 输出成功，却没有验证 sidecar 随后能否读取同一个 session，就会出现“导入成功”后打开会话仍提示 `Session not found`。以后跨进程调用 CLI 时，必须把 Desktop 当前通道传给子进程，并让未编译源码支持从运行时环境读取通道；验证要覆盖“导入写入 → sidecar API 查询 → UI 打开”的完整闭环。

## macOS 打包不要为 Electron 语言资源逐个请求签名时间戳

electron-builder 的 macOS 签名流程会遍历 App 内部文件。Electron Framework 包含大量 `locale.pak` 语言资源，依赖目录还可能包含 Linux、Windows 等平台的可选原生模块；如果不配置忽略规则，打包器会对这些文件逐个执行带 `--timestamp` 的 `codesign`，导致构建长时间停留在 `signing`，看起来像证书或钥匙串卡死。以后只能跳过明确属于非可执行资源或非当前目标平台的文件，不能关闭整个 App 的签名或时间戳；修复后仍要检查主 App、嵌套代码和当前平台原生模块的 Developer ID 签名及 `codesign --verify` 结果。

## Markdown 导出默认不应包含内部执行过程

用户反馈普通 Markdown 导出中包含大量工具调用、工具输入输出和步骤信息，影响阅读和分享。以后面向用户阅读的导出格式应默认只保留用户输入、助手回答和必要的文件引用；调试或复盘场景再通过单独的完整模式显式导出内部过程，不能把执行日志默认混入正文。

## 虚拟列表中的折叠内容必须同步真实高度

会话步骤折叠后曾出现“标题已收起但中间留下巨大空白”的问题。原因是虚拟列表保留了展开态的行高，而折叠内容只改变了状态，没有保证关闭态内容及时卸载，也没有在 Solid 更新后的 DOM 高度上重新测量。以后在虚拟列表中实现折叠区域时，关闭态应卸载大块内容，并让尺寸测量依赖折叠状态变化、在 DOM 更新后执行；回归测试必须同时检查折叠状态、内容节点是否消失，以及下一行与折叠行之间没有异常间距。

## 代理排查必须验证真正发请求的进程

桌面端存在 GUI 主进程、Electron sidecar 和模型请求三层，不能因为主进程源码调用了代理初始化，就断定模型请求已经经过代理。排查网络问题时必须同时检查：sidecar 的启动环境是否包含 `HTTP_PROXY`/`HTTPS_PROXY`、sidecar 是否在导入服务前调用代理初始化、以及实际运行时通过同一网络栈访问目标接口的结果。QuickQ 监听本地代理端口不会自动把环境变量注入已经运行的 GUI 或子进程；普通 Electron HTTPS 请求应显式使用 `HTTP_PROXY`/`HTTPS_PROXY`，不能只依赖 `ALL_PROXY`。

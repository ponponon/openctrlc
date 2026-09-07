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

导入成功 Toast 的会话 ID 也是短提示信息，末尾不应追加句号；调整成功提示时要同时检查标题、描述和动态 ID 拼接后的最终显示效果。

## Desktop 导入 CLI 必须与 sidecar 使用同一通道数据库

开发版 Desktop 的 sidecar 使用构建时注入的 `dev` 通道，而直接执行工作区 CLI 源码时没有构建时通道常量，默认会退回 `local`。如果导入命令只验证 CLI 输出成功，却没有验证 sidecar 随后能否读取同一个 session，就会出现“导入成功”后打开会话仍提示 `Session not found`。以后跨进程调用 CLI 时，必须把 Desktop 当前通道传给子进程，并让未编译源码支持从运行时环境读取通道；验证要覆盖“导入写入 → sidecar API 查询 → UI 打开”的完整闭环。

## macOS 打包不要为 Electron 语言资源逐个请求签名时间戳

electron-builder 的 macOS 签名流程会遍历 App 内部文件。Electron Framework 包含大量 `locale.pak` 语言资源，依赖目录还可能包含 Linux、Windows 等平台的可选原生模块；如果不配置忽略规则，打包器会对这些文件逐个执行带 `--timestamp` 的 `codesign`，导致构建长时间停留在 `signing`，看起来像证书或钥匙串卡死。以后只能跳过明确属于非可执行资源或非当前目标平台的文件，不能关闭整个 App 的签名或时间戳；修复后仍要检查主 App、嵌套代码和当前平台原生模块的 Developer ID 签名及 `codesign --verify` 结果。

## GitHub Actions 不能直接复用本机 notarization 钥匙串

本机执行 `xcrun notarytool store-credentials openctrlc-notary` 后，凭据保存在当前 Mac 的钥匙串中；GitHub Actions 使用全新的临时 Runner，既没有这个 profile，也没有本机的 Developer ID 私钥。以后接入 CI 发布时，必须分别把包含私钥的 Developer ID `.p12` 以加密 Secret 提供给 Runner，并提供 Apple ID、App 专用密码和 Team ID；不能只配置 `APPLE_KEYCHAIN_PROFILE` 就认为 CI 已具备签名和公证能力。

## 发布版本计算必须显式提供源码 CLI

发布工作流的版本脚本会调用 `script/changelog.ts`，而 changelog 生成依赖 `openctrlc run`。仅执行依赖安装不会把仓库内的 `openctrlc` 命令放进 GitHub Runner 的 PATH，导致版本任务在签名、公证和构建之前直接失败。以后发布流程必须在版本计算前注册当前提交的源码 CLI 启动器，避免依赖不存在或版本不匹配的全局 CLI。

## CI 发布变更说明不能依赖模型凭证

即使 CI 已经能启动源码 CLI，`script/changelog.ts` 仍会调用模型生成说明；Runner 没有本机配置的 provider 凭证时，版本任务会在创建 Release 前失败。以后正式发布的 CI 应使用 `script/raw-changelog.ts` 根据 Git 提交确定性生成基础说明，把模型生成保留为本机或有明确凭证的可选流程。

## GitHub Runner 创建 annotated tag 前必须配置提交者身份

GitHub Actions 的干净 Runner 默认没有 `user.name` 和 `user.email`。发布工作流如果直接执行 `git tag -a`，会在构建和签名前因 `empty ident name` 失败。以后 CI 创建 annotated tag 前必须设置固定的 `github-actions[bot]` 提交者身份。

## macOS Desktop CI 构建必须显式设置 Node.js 堆上限

macOS Runner 的 Node.js 默认堆上限可能只有约 2GB，`electron-vite build` 在处理 Desktop bundle 时会因 `JavaScript heap out of memory` 退出，即使 Runner 还有可用内存。以后 Desktop CI 构建应显式设置合适的 `NODE_OPTIONS` 堆上限；发布失败后的重试还要允许 draft Release 的 tag 跟随修复提交更新，但已发布 Release 不得被移动。

## electron-builder CI 发布必须显式关闭隐式上传

electron-builder 在检测到 CI 环境时可能自动执行 GitHub 发布。如果 Desktop job 没有提供 `GH_TOKEN`，签名和 notarization 即使成功，最后仍会因隐式上传失败。以后由独立步骤上传 Release 资产时，必须给 electron-builder 传 `--publish never`，避免构建器和发布 job 重复或冲突。

## Markdown 导出默认不应包含内部执行过程

用户反馈普通 Markdown 导出中包含大量工具调用、工具输入输出和步骤信息，影响阅读和分享。以后面向用户阅读的导出格式应默认只保留用户输入、助手回答和必要的文件引用；调试或复盘场景再通过单独的完整模式显式导出内部过程，不能把执行日志默认混入正文。

## 虚拟列表中的折叠内容必须同步真实高度

会话步骤折叠后曾出现“标题已收起但中间留下巨大空白”的问题。原因是虚拟列表保留了展开态的行高，而折叠内容只改变了状态，没有保证关闭态内容及时卸载，也没有在 Solid 更新后的 DOM 高度上重新测量。以后在虚拟列表中实现折叠区域时，关闭态应卸载大块内容，并让尺寸测量依赖折叠状态变化、在 DOM 更新后执行；回归测试必须同时检查折叠状态、内容节点是否消失，以及下一行与折叠行之间没有异常间距。

## Electron Desktop 的文本复制应走原生剪贴板通道

在 Desktop 开发模式中，Renderer 直接调用 `navigator.clipboard.writeText` 可能被 Electron 的 Clipboard 权限检查拒绝，即使点击动作来自用户，也会出现 `Write permission denied`。以后 Desktop 的关键文本复制入口应通过 preload 暴露受控 IPC，由主进程调用 Electron `clipboard.writeText`；Web 端再保留浏览器 API 作为降级路径。验证不能只看成功 Toast，还要实际粘贴并确认内容完整。

Electron Vite 开发模式还可能出现 Renderer 已热更新而已有窗口仍持有旧 preload 的短暂错位，此时直接调用新增的 `window.api` 会变成 `is not a function`。以后新增 preload API 时，Renderer 必须用运行时 `typeof` 检查能力是否存在，并提供不会依赖该 IPC 的兼容复制路径；不能只依赖 TypeScript 类型声明或重新构建后的静态产物。

## Skill 面板不能只读取单一投影

用户指出 Skills 面板显示“本次会话已使用 0”，但同一会话实际已经加载过 `brainstorming`。排查发现，新面板只读取 `session_message` 中的 `type: "skill"`，而旧会话的 Skill 调用持久化在 `part` 表的 `tool=skill` 记录中；同时项目可用列表只请求了 V2 `/api/skill`，旧版运行时实际从 `/skill` 发现的插件 Skill 没有进入面板。因此以后做运行透明度 UI 时，不能把某个客户端投影当成完整事实来源，必须梳理新旧协议、历史持久化数据和运行时实际读取路径；对跨版本数据应采用明确的事件优先、持久化 Part 回退策略，并对可用列表做新旧接口合并去重。

## Skill 面板不能把来源组和单个 Skill 混成一层

当一个 Skill 包包含多个 Skill 时，直接平铺虽然能展示数据，但用户无法判断哪些 Skill 属于同一个能力包，也会让列表随着配置增长失去可读性。以后做 Skill 透明度 UI 时，应将来源组作为第一层、具体 Skill 作为第二层；组内仍要保留单个 Skill 的描述、真实路径和会话激活记录，不能为了聚合而丢失可追溯性。服务端暂时没有显式组字段时，可以在客户端根据来源路径做稳定推断，并把这层推断限制在展示层。

## 代理排查必须验证真正发请求的进程

桌面端存在 GUI 主进程、Electron sidecar 和模型请求三层，不能因为主进程源码调用了代理初始化，就断定模型请求已经经过代理。排查网络问题时必须同时检查：sidecar 的启动环境是否包含 `HTTP_PROXY`/`HTTPS_PROXY`、sidecar 是否在导入服务前调用代理初始化、以及实际运行时通过同一网络栈访问目标接口的结果。任何 VPN/代理软件的本地监听或系统代理状态，都不会自动变成子进程环境变量；还必须区分 TUN 路由（由操作系统路由自动接管）、系统 HTTP/SOCKS/PAC 代理（需要应用读取系统代理配置）和环境变量代理。普通 Electron HTTPS 请求不能只依赖 `ALL_PROXY`，也不能把“支持环境变量代理”误称为“支持系统代理自动发现”。

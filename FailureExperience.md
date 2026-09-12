## Cloudflare Pages 的 Wrangler 上传必须显式使用代理

本机通过 `curl` 访问 Cloudflare API 正常，不代表 Wrangler 的 Node 网络库会自动读取代理环境变量。未显式设置代理时，Pages API 的元数据请求可能成功，但批量 `POST /pages/assets/upload` 会在上传数 MB 后因直连链路被关闭而失败。以后在中国大陆环境发布 Pages，必须先运行代理连通性检查，并同时设置 `HTTPS_PROXY`、`HTTP_PROXY` 和 `ALL_PROXY` 后再执行 Wrangler；验收要检查完整上传、部署记录、正式域名 HTTP 状态和页面内容。

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

## V1/V2 Skill 发现规则必须统一并对用户可见

桌面端默认启动的是 V1 sidecar，但 V1 服务同时挂载了部分 V2 API；Skills 页面又优先调用 `/api/skill`，仅凭接口路径无法判断实际服务协议。V2 的 Skill 服务只读取已注册来源，若没有默认注册 `~/.agents/skills`、`~/.claude/skills`，V1 能发现的 `kimi-webbridge` 就会在 V2 列表中消失。以后迁移 V1 能力到 V2 时，必须同步继承外部目录和关闭开关，并在 UI 显示实际协议、来源路径和来源内 Skill 数量，不能把“注册目录”留在服务端内存里让用户猜。

## 代理排查必须验证真正发请求的进程

桌面端存在 GUI 主进程、Electron sidecar 和模型请求三层，不能因为主进程源码调用了代理初始化，就断定模型请求已经经过代理。排查网络问题时必须同时检查：sidecar 的启动环境是否包含 `HTTP_PROXY`/`HTTPS_PROXY`、sidecar 是否在导入服务前调用代理初始化、以及实际运行时通过同一网络栈访问目标接口的结果。任何 VPN/代理软件的本地监听或系统代理状态，都不会自动变成子进程环境变量；还必须区分 TUN 路由（由操作系统路由自动接管）、系统 HTTP/SOCKS/PAC 代理（需要应用读取系统代理配置）和环境变量代理。普通 Electron HTTPS 请求不能只依赖 `ALL_PROXY`，也不能把“支持环境变量代理”误称为“支持系统代理自动发现”。

## 会话导航轨道必须预留正文安全区

会话时间线中的导航轨道不能仅以绝对定位叠加在正文左侧；如果正文容器仍从同一横向边界开始，标记会压住标题、分隔线或消息内容。以后新增类似缩略导航、浮动工具条时，必须让正文布局显式预留独立网格列或等价安全区，并在无导航和移动端状态下移除这段空间；回归测试要检查导航标记的右边界不超过正文容器的左边界。

## 长文本透明度面板不能默认展开全部内容

用户反馈系统提示词面板直接展示完整长文本，导致上下文面板被大量内容占满、阅读焦点丢失。以后在上下文、调试、日志、原始消息等透明度或诊断 UI 中，长文本必须采用“短预览 + 明确展开/收起”模式，默认限制高度并提供渐变或截断提示；只有用户主动展开后才展示全部内容，且展开内容应在面板内部滚动，不能无限撑开页面。设计完成后要从首屏信息密度、视线层级和交互成本检查，不能只验证内容是否可见。

## 会话侧栏入口必须直接打开用户已选择的 Skills

用户点击右上角侧栏按钮后看到的是 Git 变更，仍需再点击顶部 Skills Tab 才能看到技能列表，说明“侧栏已打开”和“目标面板已展示”被拆成了两步。以后当会话侧栏中已经存在 Skills Tab 时，右上角侧栏按钮打开面板必须优先激活 Skills；只有没有 Skills Tab 时才保留 Review 或当前文件的默认行为，不能让用户猜第二次要点哪里。

## 导航轨道视觉标记与点击区域必须分离

用户反馈导航轨道的细横线太难点中。以后细线、时间轴标记等低视觉噪声控件，必须保留窄的视觉标记，同时提供独立的透明点击区域，并在回归测试中检查命中区域尺寸；长会话还应提供跳到最早和跳到最新的快捷入口，避免用户逐个寻找回合。

## 导航轨道要同时覆盖边界跳转和相邻跳转

用户进一步反馈只有“跳到最早/最新”仍不够顺手，长会话中还需要“上一个/下一个”逐回合浏览；四个按钮应按“最早、上一个、下一个、最新”排列，并依据真实滚动边界禁用相邻按钮，避免虚拟列表当前标记与滚动位置暂时不同步时出现错误操作。

## 小尺寸图标候选必须形成可感知差异

用户反馈 E 和 I 在实际小尺寸下几乎看起来一样，说明候选方案不能只靠细微线条差异来区分语义。以后为紧凑导航设计图标时，边界跳转和相邻跳转必须有稳定、可感知的视觉差异，并在真实控件尺寸下对比；本次采用首尾“横线 + 实心箭头”、中间单方向实心箭头的组合。

## 导航轨道首个按钮不能贴住容器上边缘

用户反馈最上方边界按钮直接顶到会话容器边框，视觉上像没有内边距。以后给绝对定位的轨道控件留出顶部呼吸空间时，应通过轨道整体的上边距调整，保持按钮之间和标记相对位置稳定，不能只单独挪动一个按钮。

## Skills 页面间距不能只覆盖同类分区

会话 Skills 页面原先只给 `.session-skills-section + .session-skills-section` 设置上间距，运行时信息卡作为非分区兄弟节点时不会触发这条规则，导致卡片和首个分区直接贴在一起。以后页面有多种兄弟节点时，应让滚动容器或统一父级负责容器间距，再由分区自身负责标题到内容的间距；空状态也必须拥有自己的视觉容器，不能只靠文字的默认行高撑开布局。

## 过程折叠需要保留两级层次

用户参考 Codex 指出，过程不是单个“显示步骤”开关，而是“回合摘要 → 活动明细”两级折叠。以后设计会话时间线时，第一级只负责隐藏整段中间过程，第二级负责隐藏连续工具/思考活动的明细；完成回合默认关闭第一级，展开后第二级默认可见，两个层级的手动状态必须彼此独立并参与虚拟列表重测。不能把所有过程平铺在一个折叠容器里，否则用户要么面对过长列表，要么失去对局部过程的控制。

## Skill 列表不能依赖服务启动时的目录缓存

用户反馈 `kimi-webbridge` 文件明明存在，但 Skills 面板仍看不到。排查时必须同时对照磁盘文件、V1 `/skill`、V2 `/api/skill` 和前端分组结果；不能只看到来源组数量就断定具体 Skill 已经可见。Skill 服务为了避免重复读文件会缓存目录发现结果，如果服务启动后新增 Skill 而列表接口不刷新，V1/V2 都可能继续返回旧列表。以后列表接口应在请求边界刷新内容缓存或使用可验证的文件变更指纹，并用“新增 Skill 后再次请求列表”的回归测试覆盖；UI 还要保留真实文件路径，方便确认是扫描、解析、合并还是折叠展示的问题。

## GitHub Actions Secret 与 Variable 必须和 Workflow 引用保持一致

GitHub Actions 的 `secrets.NAME` 和 `vars.NAME` 是两套独立配置。以后配置外部服务凭证时，必须先确认用户实际添加在 Repository secrets、Repository variables 还是 Organization 级别，再让 Workflow 使用对应的上下文；不能因为账号 ID 不敏感就默认它一定会被配置为 Variable。若用户已经添加为 Secret，应直接使用 `secrets.NAME`，避免要求用户重复进入 GUI 配置。

## 官网不能直接继承上游产品宣传内容

官网从上游项目复制过来时，Logo、截图、Zen/Go 托管服务、社交卡片服务和企业版联系方式可能仍然指向上游。即使核心程序是 fork，也不能把这些并不存在于当前产品中的能力继续展示给用户。以后发布官网前要同时检查可见文本、图片、侧栏入口、Meta/OG 图片和外链；真正用于兼容协议或导入旧会话的内部 `opencode` 名称可以保留，但不能出现在 OpenCtrlC 的产品宣传层。

## 全局 Dialog Portal 不能直接读取目录级 Context

全局 Dialog Provider 挂载弹窗时，弹窗组件不一定位于当前会话的 `ServerSyncProvider`、`SDKProvider` 或 `PromptProvider` 子树内。以后从会话页面打开目录相关弹窗时，必须在页面作用域捕获这些 accessor 并通过 props 传入；不能在弹窗组件内部重新调用 `useSync` 等目录级 Hook，否则组件会在用户点击后才因脱离 Provider 崩溃。回归验证必须覆盖按钮入口和命令面板入口，并检查实际弹窗已渲染而不是只通过类型检查。

## Desktop 正式发布不能只构建 macOS

桌面版发布工作流曾只运行 macOS 构建，虽然 Electron Builder 已经声明了 Windows NSIS 和 Linux DEB 目标，用户在 Release 页面仍然只能看到 macOS 安装包。以后不能把本地打包配置存在就当成跨平台发布完成；必须逐平台检查 CI runner、构建命令、实际上传资产、Release 下载说明和官网下载路由是否闭环，并在 Release 发布前确认目标文件真实存在。

## 应用图标必须按容器和显示场景分别验收

应用图标不是一个 PNG 文件就算完成：macOS `.icns` 需要覆盖系统使用的多级 Retina 图层，Windows `.ico` 需要包含 16/24/32/48/64/256px 层，Linux 需要保留可被桌面环境读取的透明 PNG；macOS Dock 使用的 inset 图标还不能直接拿满画布图标替代。以后要同时检查实际像素尺寸、四角透明圆角、边缘是否被错误裁切，以及 Dock PNG 与 ICNS 对应图层是否一致；发布前应执行自动门禁，避免在安装包中出现方角、过度留白或图标被放大的问题。

## Linux 桌面资产名必须与官网下载路由统一

Electron Builder 在 Linux 上会把同一 x64 架构分别写成 `amd64`（DEB）和 `x86_64`（AppImage/RPM），而官网路由和 Release 文档使用统一的 `x64` 名称。以后发布 Linux Desktop 时，打包后必须显式归一化这三个公开文件名，再上传到 Release；验收要同时对照实际 Release 资产、Release 正文链接和官网下载接口，不能只看构建 job 成功。

## GitHub Release 正文不能直接暴露内部提交日志

用户反馈正式 Release 中逐条列出 commit ID、提交作者和按内部模块拆分的长列表，阅读体验明显偏离面向用户的版本说明。以后 Release 正文应参考 AIVPlayer 的格式，只保留面向用户的 `Features`、`Performance and Reliability`、`Bug Fixes`、`Downloads` 和 `Full Changelog`；提交 ID 和内部作者信息不进入正文。`Contributors` 仅在存在第三方贡献者时展示，仓库所有者自己的提交不列出。自动生成器也必须遵守同一规则，避免下一次发布恢复成开发日志格式。

## Downloads 必须先按产品类型再按平台分组

用户反馈下载区直接按 Windows、macOS、Linux 展开后，CLI 和 Desktop 资产混在同一平台下，阅读和选择成本较高。以后 Release 正文应使用 `Downloads → CLI/Desktop → macOS/Linux/Windows` 的层级，先让用户选择产品类型，再选择目标平台和架构；自动生成器和手工版本说明必须保持同一层级。

## Desktop 跨架构包必须由 CI 实际构建

用户要求 Windows 和 Linux Desktop 同时提供 x64 与 ARM64，不能只在 Release 正文或官网里补充 ARM64 链接。以后必须让 GitHub Actions 为 Windows/Linux 分别执行 x64、ARM64 矩阵任务，传入对应的 electron-builder 架构参数，并对每个任务生成的安装包做存在性校验；Linux 还要把 electron-builder 的 `amd64`、`x86_64`、`aarch64` 等内部命名归一化为官网和 Release 使用的 `x64`/`arm64`。工作流、下载路由、R2 清单和发布说明必须共享同一套公开文件名，避免出现“页面有链接但资产不存在”的假发布。

这次重跑还暴露出文件名归一化必须幂等：Linux ARM64 的 DEB 已经可能直接生成公开目标名，脚本不能对同一路径再次 `mv`。以后做多发行版资产归一化时，先比较源路径和目标路径，只有不同才移动，并为“已是目标名”和“需要改名”两种情况保留校验。

## 官网产品化不能只改首页

这次官网改造发现，删除导航入口并不等于删除公开产品边界。旧的 `/zen`、`/go`、`/black` 路由、全局 OG 图片、安装地址和多语言文档仍可能被搜索引擎或用户直接访问。以后做品牌切换或独立分叉发布时，必须同时检查首页、深层路由、Meta/OG 资源、README、安装脚本、文档翻译和静态资源；对已经不存在的能力应统一跳转或回退到真实文档，不能只依赖导航隐藏。

## 多语言文档宁可准确回退也不能保留伪服务说明

上游翻译页面会把不存在的托管服务、订阅计划和分享域名一起带入 OpenCtrlC。直接做关键词替换还可能产生“the configured provider”这类语义残片。以后维护翻译文档时，先以英文主文档和中文主文档为事实来源；无法可靠同步的专题页面应回退到主文档，而不是保留看起来已翻译、实际却指向不存在服务的页面。

## 官网宣传文案必须和发布流水线的真实资产一致

首页、下载页、README 和 Release 正文曾分别描述平台和架构，容易造成用户看到链接却找不到资产。以后发布前要以 CI 实际上传文件名为唯一事实源，同时检查官网下载路由、手工 Release 说明和安装脚本；任何“支持”声明都必须能在构建矩阵和可下载产物中找到对应证据。

## GitHub Action 不能只改 action.yml 的说明

这次官网收口发现，Action 的元数据虽然已经改成 OpenCtrlC，运行时仍可能走旧的
OIDC Token 交换服务、旧的 GitHub App 和旧分享地址。以后调整公开 Action 时，必须
同时检查 action.yml、生成 workflow、CLI handler、GitHub Action README 和实际的
Token/Git 推送路径；自管理模式要让 `GITHUB_TOKEN` 真正进入运行时，并确保
`actions/checkout` 使用 `persist-credentials: false` 时仍能完成推送。

## Cloudflare Pages 项目检查必须匹配 Wrangler 的真实输出字段

Wrangler 的 `pages project list --json` 当前返回的是表格字段名 `Project Name`，不是
直觉上的 `name`。以后在部署 Workflow 中检查 Pages 项目是否存在时，必须兼容实际
CLI 输出字段，并用 `any(...)` 返回明确的布尔结果；否则已有项目会被误判为不存在，
重复创建直接阻断官网部署。

## 静态文档站不能把超大的 Cloudflare Worker 一起部署

Astro Cloudflare 构建会同时生成静态页面和 `_worker.js`。文档站本身只需要
`dist/docs` 下的静态 HTML、资源和搜索索引；如果把整个 `dist` 上传，Worker
Bundle 可能超过 Cloudflare Pages Functions 的 25 MiB 未压缩限制，即使文档构建
完全成功也会在上传阶段失败。以后部署纯文档站必须只上传静态输出目录。

## Pages Worker 必须在部署前完成单文件打包

Nitro 的 Cloudflare Pages 输出会把 Worker 拆成 `_worker.js/index.js` 和多个相对路径
分包。直接把这个目录交给 Wrangler 二次打包时，临时构建目录会改变分包的相对层级，
最终部署虽然显示成功，线上请求却会因为找不到 `../../index.js` 全部返回 500。以后部署
这种产物必须先用固定版本的 esbuild 将 Worker 合并为输出根目录的单个 `_worker.js`，再用
`--no-bundle` 上传，并用线上首页请求做运行时冒烟验证。

## 公开 Pages 构建不能依赖上游托管计费资源

OpenCtrlC 的公开官网不连接上游 SST 的托管计费资源，但原控制台服务端仍会在加载路由
模块时初始化部分计费常量，导致官网首页在真正处理请求前就因缺少
`ZEN_LITE_PRICE` 返回 500。以后公开站点要么使用独立的营销构建，要么让仅用于旧托管
产品的模块在缺少资源时保持惰性，并同时把旧产品路由统一重定向；部署后不能只看构建成功，
还要验证没有资源绑定时的首页实际响应。

## Pages 下载路由不要在边缘函数代理 GitHub 大文件

官网下载路由原本在 Cloudflare Worker 中 `fetch` GitHub Release 资产，再复制响应体和响应头。
首页可以正常运行，但该代理路径在线上统一返回 500，且会让边缘函数承担大文件传输和外部重定向
兼容成本。以后公开下载路由只做资产白名单校验并返回 GitHub Release 直连重定向；发布前要用
未跟随重定向和跟随重定向两种请求分别确认路由状态及最终资产状态。

## 回复分叉必须保留被点击的助手回复

用户从助手回复 A 的操作区创建会话 B 时，旧实现错误地把 A 的 `parentID`（用户提问）传给 `session.fork`，又把该用户提问恢复到 B 的输入框。由于 OpenCode 的 `messageID` 是排他边界，结果 A 的提问和回复都从 B 的历史中消失。以后必须区分“从用户消息之前分叉”的命令面板流程和“包含当前助手回复分叉”的回复操作流程；后者传助手消息 ID，并把下一条消息作为排他边界，最后一条消息则省略边界，同时保持 B 的输入框为空。

## Markdown 导出不能把工具中间消息当成最终回答

用户反馈普通 Markdown 导出出现大量重复的 `Assistant` 标题。一个对话轮次在底层可能包含多条 `finish=tool-calls` 的 assistant 消息，真正面向用户的回答通常是最后一条非工具调用消息。以后精简导出必须过滤工具调用阶段，只保留用户输入和最终助手输出；完整导出可以保留过程，但应按同一轮合并角色标题，避免把协议消息数量直接暴露成阅读结构。

## Markdown 数学语法不能只支持独占多行的块公式

用户反馈会话中写在列表正文同一行的 `$$...$$` 公式无法渲染，而 Typora 可以正常显示。原因是解析器虽然注册了 KaTeX 扩展，但块公式正则只接受 `$$\n...\n$$`，同时没有实现标准的 `$...$` 和 `\[...\]` 分隔符，因此这些公式被 Marked 当成普通文本。以后扩展 Markdown 数学语法时，必须同时覆盖独占行和嵌入段落两种布局，并用真实的列表正文样例做回归测试，不能只测试单独一行的理想输入。

## 流式 Markdown fallback 不能直接展示原始标记

用户反馈跨行粗体的 `**...**` 在会话里显示成原始星号。这里有两层原因：Marked 的 GFM 规则会把紧邻中文字符的 `**` 视为单词内部分隔符而不解析；流式渲染在 Markdown worker 返回前还会使用转义原文 fallback，同时 `remend` 会为未闭合的粗体临时补上结尾 `**`，于是用户会看到成对星号。以后异步 Markdown 渲染必须为 CJK 紧邻分隔符提供兼容解析，并让等待态也经过轻量同步解析和安全过滤，不能把原始 Markdown 当作最终视觉输出；重型代码高亮仍应留在 worker 中。

## Marked 自定义 renderer 必须复用精确 Token 类型

Marked 18 的 `renderer.link` 参数中 `title` 是可选字段。自定义 renderer 如果直接解构
未标注类型的参数，会在单包检查时隐式退化成 `any`，并在全量依赖包检查时被严格模式拦截。
以后扩展 Markdown renderer 时，必须复用 `Tokens.Link` 等库提供的精确 Token 类型，保留可选
字段的语义，并在单包检查之外再跑一次全量 `bun turbo typecheck`，避免只在局部构建成功。

## GitHub Release 标签不会自动完整进入本地 refs

线上 GitHub 已经存在 `v0.1.3`、`v0.2.0`、`v0.2.1`、`v0.2.2`，但本地 Git Graph
只有 `v0.1.1`。根因不是发布工作流没有打标签，而是这些 tag ref 后创建时，目标
提交已经通过分支同步存在于本地；Git 的普通 fetch 只会自动跟随本次新获取对象上的
标签，不保证扫描并拉取所有后来创建的标签，所以本地 refs 与 GitHub 不一致。

以后遇到“GitHub 有 Release/tag、本地没有”的问题，必须先分别检查
`git ls-remote --tags --refs origin` 与 `git show-ref --tags`，不要只看当前分支的
提交图。修复时执行 `./script/sync-tags`，它会设置 `remote.<name>.tagOpt=--tags`
并显式运行 `git fetch <remote> --tags --force`；确认标签目标提交后，再刷新 Git
Graph。发布流程和排障记录都要区分“远程 tag 未创建”和“远程 tag 已创建但本地 ref
未同步”这两类问题。

## UI 包的 DOM 测试必须显式加载浏览器运行时

`packages/ui` 原本直接运行 Bun 测试，新增的滚动条 PointerEvent 回归测试访问真实 `document` 时会在本地和 CI 失败。以后只要测试涉及 DOM、事件或浏览器全局对象，就必须让所属包自己的测试脚本显式加载 Happy DOM preload；不能因为另一个工作区包已经有 DOM 测试环境，就假设 Bun 会自动继承它。

## 目录清单测试必须对新增 fixture 和遍历顺序保持稳定

`packages/app` 的身份残留测试用固定清单校验 E2E 文件。新增导航轨道测试文件后，清单没有同步更新；同时 Bun 的 Glob 遍历顺序变化会让直接比较 Set 产生噪声。以后维护这类清单门禁时，新增文件必须同时归类，集合比较应先排序，避免把合法的遍历顺序变化误报为产品失败。

## 网络重试不能携带旧产品身份

WebFetch 遇到 Cloudflare 挑战时原本会用 `opencode` 作为第二次请求的 User-Agent，即使主流程已经迁移到 OpenCtrlC，也会在真实网络请求中泄露旧产品身份。以后处理网络兼容重试时，浏览器 User-Agent 只用于触发兼容路径，后续请求仍必须使用当前产品的 `Brand` 标识；测试要同时验证初次请求和重试请求的身份。

## 个人仓库不能依赖不可用的专用 Runner 标签

常规 CI 曾固定使用 `blacksmith-4vcpu-*` 标签。发布工作流使用标准 GitHub Runner
可以正常运行，但个人仓库的测试、类型检查、生成和 Nix 评估任务没有匹配 Runner，
会长时间停留在 `queued`，容易被误判为代码失败。以后迁移上游工作流时，必须先用
当前仓库实际权限验证 Runner 标签；个人仓库的基础门禁应优先使用可分配的
`ubuntu-24.04`、`windows-2025` 等标准 Runner，只有确认专用 Runner 可用时才使用
自定义标签。

## Locale 推断不能依赖不同平台的 ICU 补全结果

同一个 `pa-PK` 在 macOS 和 Linux 的 ICU likely-subtags 数据中可能补出不同的脚本，
导致基于 `language + script` 的匹配在 Linux 上退回英语。以后做桌面语言包选择时，
应先读取用户显式提供的 language/region/script，针对产品明确支持的区域保留稳定映射，
再使用 `Intl.Locale.maximize()` 处理缺少区域或脚本的输入；不能只在开发机的 ICU
环境中验证结果。

## HTTP API 认证夹具必须使用当前产品身份

上游 HTTP API exerciser 的有效认证用户名曾被写死为 `opencode`，而服务配置已经
通过 `Brand.cli` 默认使用 `openctrlc`，结果所有认证场景都会被拒绝。以后迁移上游
测试夹具时，认证用户名、User-Agent、运行目录和环境变量都必须从统一品牌常量读取，
不能只改服务实现而遗漏测试请求里的旧身份。

## 个人仓库工作流不能强制依赖未配置的 GitHub App

代码生成和 Nix 哈希更新原本无条件调用 `actions/create-github-app-token`，但个人仓库
没有组织级的 `OPENCTRL[C]?_APP_ID` 和私钥时，工作流会在真正执行检查前因缺少 `appId`
直接失败。以后复用需要推送权限的工作流时，应让 GitHub App 作为可选的增强凭据，并在
个人仓库中安全回退到工作流自带的 `GITHUB_TOKEN`；同时不能把 Token 写入普通日志。

## Node EventEmitter 类型不能依赖已移除的兼容导出

`@types/node` 新版本已经不再导出 `EventEmitterEventMap`，直接从 `events` 导入会让远程
全新安装环境的类型检查失败，即使本地残留依赖仍可能暂时通过。以后扩展 Node
`EventEmitter` 时应使用当前公开的泛型接口或局部重载，不要依赖版本特定的内部类型名，
并在干净 Runner 上验证类型检查。

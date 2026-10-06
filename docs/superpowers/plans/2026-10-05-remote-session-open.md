# 远程会话首屏与 P2P 验收记录

## 首屏性能基线

2026-10-05 对当前工作区执行了生产构建版 `session-parent-hydration-benchmark`。基准使用合成服务端：每个消息查询延迟 50 ms，一页 20 条 assistant 消息，并发补取 20 个父消息。5 次观测的首次正确内容出现时间为 215、217、214.3、214.5、214.6 ms，中位数 214.6 ms；首屏完整消息列表加载期间测得的空白采样为 20–22 次；每轮消息列表请求 1 次、父消息请求 20 次。

这组数据只代表当前合成场景下的父消息补取表现，不代表用户报告的指定旧会话或公网生产服务器。第一次探测误连到 CLI 服务，目标会话返回 404；随后改用正在运行的桌面端服务，在不输出会话正文或认证信息的前提下完成了真实本地 API 测量：目标会话数据库占用 37,819 字节、5 条消息；`GET /session/:id/message?limit=20` 连续 5 次均为 200、每次响应 41,044 字节，TTFB 3.7–8.4 ms、完整读取 3.9–8.6 ms。它证明当前桌面服务的消息列表请求很快，但没有测到手机经公网 Relay 的整条导航、其余启动请求或用户所见的首屏时间，因此不能据此宣称 10 秒问题已经解决。

## 当前实现中的首屏阻塞点

`packages/app/src/context/server-session.ts` 的 V2 `fetchMessages` 会在最新页边界是 assistant 时串行读取更早的消息页，直到找到 user turn root。之后 `loadMessages` 还会补取缺失的父消息；页面应用消息前等待这些请求完成。深 assistant turn 因此可能增加多次顺序网络往返。

不能直接删掉旧页追溯：`normalizeSessionMessages` 依靠顺序中的 user 消息确定 assistant 的 parent；没有 parent 的 assistant 会被忽略。优化必须先确认消息 API 是否能在首屏响应中提供明确 `parentID` 或精确 turn root，再调整加载顺序，并增加 assistant-only 首屏的回归覆盖。

## 实现后验收状态

- [x] 代码审查发现 V2 旧消息 `parentID` 回填把查询页强制改成时间正序，导致倒序分页游标方向错乱；现在只在内部按序计算父级，并按查询原顺序组装响应。Core `bun run typecheck` 与 `git diff --check` 通过；本次没有运行测试。
- [x] assistant-only 最新页通过助手 `parentID` 与同页根消息侧载恢复 turn；App 单测确认仅发一次列表请求。
- [x] 新 assistant 投影保存用户/合成提示 ID；旧 assistant 用按 Session、消息类型、序号索引查询回填。Core 测试也覆盖移除持久化 parentID 后的旧数据读取。
- [x] V2 生产构建 Playwright 合成基准显式设置 V2 协议，使用 20 条 assistant 消息及一个页外共享 root；5 次都只有 1 次列表请求、0 次父消息详情请求，首个正确画面中位数 111 ms（106.5–117.7 ms）。此前旧夹具默认为 V1，覆盖了错误协议；V1 仍是历史回填回退路径。
- [x] 对指定本机会话的数据库大小、消息数、真实桌面 API 响应体积和延迟完成只读测量；该消息端点仅需数毫秒，无法解释整页 10 秒等待。
- [x] 路由改为目标会话元数据一到就挂载工作区，并与祖先 root 解析并行预取首屏消息；Chromium 回归阻塞父会话 detail 请求，仍确认消息正文已显示。
- [ ] 对同一会话经实际公网 Relay / 手机网络测完整导航，记录元数据 API、消息分页、其他启动请求与首屏的分段耗时。现有真实桌面 API 测量不覆盖这些链路。
- [ ] 桌面 host 到手机 viewer 的 P2P / TURN / HTTPS Relay 路径端到端验证。
- [x] 本机 Chromium 回归覆盖同一 DataChannel 的分片、Blob 后文本发送顺序、`bufferedAmount`、Relay WebSocket 回退及大请求取消。
- [x] 直连 WebSocket 连续收到重复关闭帧后，浏览器忽略迟到的直连帧，已打开的 Relay 备用连接保持正常；桌面 host 对 `error`/`close` 只回报一次。
- [ ] 覆盖真实桌面 hidden renderer 到手机浏览器的连接、SSE/终端切换、TURN、断线恢复、UDP 阻断和桌面休眠恢复。

## 2026-10-06 路径观测补充

- Relay 新版健康接口汇总 `activeP2PDirectPeers` 与 `activeP2PTurnPeers`；已认证桌面端每 15 秒上报 WebRTC stats 中选中的 ICE 路径，Peer 关闭、授权撤销、桌面断开和会话删除时清理计数。
- `/home/pon/openctrlc-remote/monitor/relay-watch.sh` 的日志行包含两个路径数。它们是在线路径连接计数，不是 P2P 字节/账单或唯一用户数；旧版公网 Relay 尚不返回这些字段，也未部署本次代码。
- `packages/remote-relay` bundle 构建及路径计数用例 2/2 通过；`packages/app`、`packages/desktop` 类型检查通过，监控脚本 `sh -n` 与 `git diff --check` 通过。未重启或部署线上 Relay，也未配置公网 ICE。

## 本轮代码验证

- `packages/core` 的 `bun test test/session-projector.test.ts`：9 项通过，覆盖新关联及旧数据回填。
- `packages/app` 的 `bun test src/context/server-session.test.ts`：89 项通过，覆盖助手单页携带根消息、保留现有 V1 与断线同步行为。
- `packages/schema`、`packages/core`、`packages/protocol`、`packages/server`、`packages/client`、`packages/sdk/js`、`packages/app` 的 `bun run typecheck` 均通过；按项目约定从 `packages/client` 执行了 `bun run generate`，并从 `packages/sdk/js` 重生成 V2 HTTP SDK。
- 以上是本地验证，不等同于公网 relay、手机网络或用户报告的 10 秒场景已验收，也不代表可以发布。
- 2026-10-05 本轮 `packages/app` typecheck、`typecheck:e2e` 与 `packages/desktop` typecheck 通过；`session-lineage-loading.spec.ts` 和 `remote-peer-channel.spec.ts` 合计 Chromium 6 项通过，包含父链阻塞时正文先到以及重复关闭帧后的 Relay 回退。
- 以上浏览器用例是本机 Chromium + 模拟对端，不代表真实手机、公共 Relay、TURN 网络或 10 秒会话的端到端验收。

## 2026-10-06 公网浏览器流量检查

- 通过 Kimi Bridge 借用用户当前打开的远程会话页，只读读取页面状态和 Resource Timing；页面当时已显示项目、会话和消息。该观测来自桌面 Chrome 中的公网远程页面，不代表实体手机实测。
- 浏览器记录到 3 次 `/provider` 响应各约 6.61 MB，另有一次约 390 KB；这 3 次请求都没有 `view` 参数。当前工作区的 `loadProvidersQuery` 已让远程全局/目录查询显式发送 `view=summary`，SDK 单测也验证了 `/provider?directory=...&view=summary` 会正确序列化。因此这次高流量来自当前页面仍在使用未带两阶段参数的旧嵌入 UI，而不是当前工作区这条 Provider 查询代码。Browser Resource Timing 显示页面没有 Service Worker 控制；`packages/desktop` 的 Electron 开发进程在 2026-10-03 启动，早于 10-04/10-05 的 UI 改动。`predev` 会重建 `packages/app/dist` 并把它嵌入 OpenCtrlC server；该常驻进程需在没有活跃工作时重启，才能装入新 bundle。
- 目标会话消息列表约 12.8 KB，TTFB 约 3.55 秒、总计约 4.58 秒；一个父会话消息列表约 429 KB，TTFB 约 39.8 秒、总计约 42.7 秒。多笔 6.6 MB 目录传输与父消息慢响应在同一页面时间线上重叠，可能争用 5 Mbps 上行，但单次浏览器采样不能证明它是 39.8 秒 TTFB 的唯一原因。完成重启后应复测相同远程会话，确认 Provider 响应降至 summary 量级，再拆分 Relay、桌面服务和网络耗时。
- 增加了 App 查询层与 SDK URL 序列化回归测试，分别覆盖 summary 不额外请求 model 列表、summary/full 参数确实进入请求 URL。两组测试通过；App 与 SDK typecheck 通过。
- 在实际手机网络验证 P2P / TURN、复测重启后的公网页面、以及不同运营商网络仍未完成；发布前不能宣称这些链路已经验收。

## 2026-10-06 工作区同步复核

- 发现并修复浏览器只恢复活动会话标签的问题：Relay 快照中的所有桌面标签现在按原顺序恢复，快照附带受限的标题元数据；非活动标签只显示标题，用户切换后再解析会话和加载消息。
- 桌面工作区快照统一由 `RemoteTabsHydrator` 发布，避免仅同步项目的另一处发布者以空 `sessionIDs` 覆盖完整快照。桌面明确发送的空项目列表按空状态处理；没有快照的普通 Web 连接只自动打开一个最近/首个项目。
- 目标会话本地服务端请求仍是毫秒级，不能把“手机 10 秒”归因给本地查询。过去公网页面采样里大 Provider 响应与慢消息 TTFB 重叠，可能争用上行；新 provider summary 代码必须随应用重启后复测，旧页面结果不能代表新 bundle。
- 新改动的 App、Desktop 类型检查通过；Relay 入口 Bun bundle 构建通过；`git diff --check` 通过。本轮未运行单测/E2E、未重启服务，也未做真实手机/公网验收；因此仍不能宣称工作区新快照与完整 P2P 链路已在生产环境验证。

## 2026-10-06 Relay 版本错配与压缩上行（待公网复验）

- 先前对照公网响应与部署时间，判断线上 Relay 很可能仍是 2026-10-04 创建的旧版本：公网能力接口行为与当前源码不同，健康响应也没有新版 P2P 路径字段。这个迹象支持“公网部署落后于源码”，但单凭版本字段不能证明白屏发生在哪一层。
- 代码路径审查发现一种可能的编码错配：新桌面端收到浏览器 `Accept-Encoding: gzip` 后会先在本机解压上游响应，再重新 gzip 以减少桌面到 Relay 的上行；新 Relay 通过 `gzipResponseUpload` 协商后才按压缩内容处理。旧 Relay 若不认识该协商字段，就必须让桌面回退为未压缩上传。工作区已加入该兼容修复，但此前关于“双重压缩就是当前白屏根因”的表述过于确定；要确认公网的实际故障层，仍需对同一次浏览器导航同时保存原始响应头、传输字节和 Relay/桌面日志。
- `packages/desktop/src/main/remote-response-encoding.test.ts` 覆盖新旧 Relay 协商、P2P 独立压缩、伪造内部头拒绝、`q=0`、SSE 和无响应体；此前已记录 Desktop/Relay typecheck、关联单测、Relay bundle 和 Electron build 通过。代码仍需发布并由维护者更新桌面端后，才能在公网完整验证。
- 生产 Relay 当前没有 ICE 配置，故客户端能力检查不通过时应直接使用 HTTPS Relay，而不是等待 12 秒后才回退。只有配置 ICE 后的 P2P 协商才有 12 秒超时。此前 Feature 与部署文档把这两种情况写反，现已更正。
- 生产资源边界：主机名义带宽为 5 Mbit/s；Relay 容器限制为 1 CPU/512 MiB；`maxSessions = 10,000` 是保留会话记录的准入上限，不是经过测量的 10,000 用户并发能力。公网目前实际仍由 Relay 承载数据；不应把尚未部署的 P2P 计入带宽节省。
- 2026-10-06 只读采样：生产健康状态为 1 个保留会话、1 个桌面在线、4 个已授权浏览器、0 个 Relay WebSocket viewer、0 个等待请求；健康响应没有新版 P2P 字段且 `persistence` 为 null。Relay 容器瞬时 CPU 约 0.17%、内存约 100 MiB/512 MiB；Docker NetIO 是进程累计值，不是实时带宽。该空闲采样不能推断并发上限，累计 `traffic` 字段也不能替代按时间差计算的出口速率或云厂商账单。
- Cloudflare Workers、Durable Objects 等 Worker 转发不纳入远程中继方案。低成本方向是让可直连浏览器尽量使用 WebRTC，保留自托管 HTTPS Relay 作为信令与可靠回退，再依据真实路径计数和服务器出口流量扩容；10,000 并发容量需要单独压测，不能从会话上限推断。

## 2026-10-06 公网白屏复查

- Kimi Bridge 打开 `https://openctrlc-remote.quniv.cn/` 后，页面主体呈现以 gzip 魔数样式字节开头的文本，随后空白；Resource Timing 记录主文档 `responseStart` 约 82 ms、`responseEnd` 约 84 ms，说明这次白屏不是主文档等待几十秒才返回。
- 同一浏览器上下文中，对根 URL 发起 `fetch(..., { cache: "no-store" })` 得到 200、`Content-Encoding: gzip`，浏览器解码后的正文以 `<!doctype html>` 开头；但页面导航的 DOM 与这个 fetch 正文不一致。该证据说明导航路径与无缓存 fetch 的响应处理存在差异，尚不能判定是桌面上传、Relay、OpenResty 缓存/压缩还是浏览器导航缓存导致。
- 同一公网域名下，`/_remote/capabilities` 返回 HTML fallback 而不是当前 Relay 源码预期的能力 JSON，`/healthz` 返回 404。这进一步表明当前公网路由/部署与工作区源码不一致；在拿到带状态码、响应头和原始传输体的导航 HAR，或查看对应服务日志前，不应将具体根因说成已确认。
- 后续核对发现此前访问的 `127.0.0.1:4096` 是 CLI 开发服务，使用 `openctrlc-local.db`，并非桌面 sidecar。桌面进程使用 `openctrlc-dev.db`；指定旧会话在该库仍有 5 条 V1 消息和 21 条 part。不能用 CLI 服务的 404 推断桌面会话丢失。早前公网采样的 6.6 MB provider 响应和 39.8 秒父会话 TTFB 也不能代表当前空白根页面。
- 线上 Relay/桌面服务未重启、未部署、未更新。下一次定位需要从同一次失败导航采集：完整请求 URL、状态码、`Content-Encoding`、`Content-Length`、`Vary`、`ETag`/缓存头、解压后和原始响应体前几十字节，以及桌面端/Relay 对应时间段日志；然后用当前发布版复测。禁止仅凭截图归因或宣称修复完成。

## 2026-10-06 认证 API 双层 gzip 根因确认

- 使用用户已登录的桌面 Chrome 页面只读检查认证后的公网 API。`/global/health` 与 `/api/health` 都返回 200 和 `Content-Encoding: gzip`；浏览器 `fetch` 解开 HTTP 标记的一层后，JS 仍拿到 gzip 魔数开头的字节。再额外解压一次才得到有效健康 JSON。这确认这些隧道 API 响应存在双层 gzip；它不等同于匿名根路径首页 HTML 的编码状态。
- 对同一旧会话只检查元数据和消息结构，不记录会话 ID 或正文：V1 `/session/:id/message` 返回 5 条消息；V2 `/api/session/:id/message` 返回空 `data`。请求耗时约 0.18–0.22 秒，说明这组 API 当前采样没有几十秒的服务端响应等待，但不能代表整页首屏耗时。
- `packages/app/src/utils/server-protocol.ts` 的探测会调用 `response.json()`；双层 gzip 导致 JSON 解析异常后被吞掉，两个健康端点都失败时默认 `v2`。旧会话在 V1 有数据、V2 没有投影数据，所以 UI 显示空白/空会话。该链路比先前“根路径导航一定双层 gzip”的说法证据更强，也把认证 API 与首页文档区分开。
- 根因来自桌面端与旧 Relay 对响应体编码约定不一致。提交 `192d2af4` 已在 `dev` 加入 `gzipResponseUpload` 能力协商：旧 Relay 未声明能力时桌面保持未压缩，让 Relay 只压缩一次；新 Relay 才接受桌面压缩上传。Desktop 与 Relay 对应压缩用例及类型检查已通过，Relay `bun typecheck` 也通过。
- 修复还没有进入用户当前长运行的桌面进程或公网旧 Relay 容器；当前部署不能据此判定已修复。它只解释这次认证 API 旧会话读空路径，不能单独解释匿名首页导航白屏。后续应在加载新桌面构建后复测健康 JSON、同一会话 V1/V2 对照、消息首屏和浏览器导航；若任一健康端点解析失败，UI 应明确显示连接/协议错误，而不是把未知状态降级成 V2 空列表。

## 2026-10-06 协议探测失败处理

- V1 与 V2 健康检查并行运行；任何已知健康签名可确定协议，两个响应都无效时抛出专用协议探测错误，不再默认为 V2。
- 错误提示提供四语本地化，并仅展示 HTTP 状态或超时、JSON 类型等探测类别，不包含请求 URL、认证信息或响应体。
- `packages/app` 中 `server-protocol.test.ts` 与 `server-errors.test.ts` 共 19 项通过；`bun typecheck` 与 `git diff --check` 通过。
- 此改动让失败状态可见，避免协议误判产生“空会话”；它不会修复部署/服务端双层 gzip，也没有更新桌面构建或公网 Relay。用户需在下一次安装包含修复的桌面版本后重新连接，才能验证实际恢复情况。

## 2026-10-06 协议探测总耗时上限

- 代码复审发现此前每轮 V1/V2 并发探测最多等 5 秒，4 次退避重试在连续超时时可把共用协议 Promise 卡近 29 秒，阻塞依赖它的页面请求。
- 现在对瞬时网络错误、超时和 5xx 最多额外重试两次，整段探测共享 8 秒截止时间，每次请求不超过 5 秒；稳定的 404/非 JSON 响应仍立即返回错误。
- 新增持续 503 的回归用例确认探测次数封顶；仍需在真实公网弱网下量首屏并检查错误页恢复交互。

## 2026-10-06 Relay 有损升级保护

- 只读核验当前线上旧 Relay 时发现有 1 个活跃桌面会话、4 个授权浏览器，但健康响应没有持久化字段；部署目录没有可验证的恢复快照。10 秒网卡采样近乎空闲，不代表可用容量。
- 完整部署脚本现在在替换容器前检查旧实例状态；活跃会话无健康持久化快照时默认拒绝部署。只有显式传 `--allow-session-reset` 才能继续；该选项意味着旧授权需重新配对。`--config-only` 保持不重启 Relay。
- 未向生产执行部署。此保护避免了本次继续排查时意外清掉现有授权；要启用新版 Relay/P2P，仍需安排维护切换并验证桌面自动恢复、浏览器重新授权、远程页面和 ICE 路径。

## 2026-10-06 Relay 部署快照校验收紧

- 复核部署保护时发现，只验证 `remote-sessions.json` 是 JSON 对象会让空对象或旧快照误通过，不能证明活跃浏览器授权能恢复。
- Relay 健康响应现在给出最近成功保存的快照时间及是否有延迟写入待处理；部署前必须匹配快照版本/时间、会话数量和凭证字段、授权浏览器数量。状态目录与快照文件的符号链接也会在读取前拒绝。
- 只做本地代码验证，不重启或更新生产 Relay。当前旧 Relay 没有这些健康字段，因此仍会安全拒绝带活跃会话的完整部署。

## 2026-10-06 Desktop 开发 CLI 缓存校验

- 代码复审发现 `predev` 只按 `resources/openctrlc` 是否存在决定是否下载；切换 `OPENCTRLC_CLI_VERSION` 或 `RUST_TARGET` 后可能继续复用旧二进制。
- 下载完成后记录版本、Rust target、文件大小和修改时间，后续启动只有在它们匹配且二进制有执行权限时才复用；元数据缺失或损坏会重新下载。
- 构建缓存递归比较源树目录与文件时间，覆盖深层源码删除/重命名，避免仅检查根目录和剩余文件而复用陈旧 bundle。
- 本地补充元数据匹配测试并检查 Desktop 类型与脚本语法；没有执行 CLI 下载或公网访问。

## 2026-10-06 P2P WebSocket 路径标记复核

- 复审近期终端的 Relay→P2P 迁移逻辑时发现，它在 WebSocket 握手前根据全局 DataChannel 状态预先标记为 P2P。该 WebSocket 后续可能自身超时回退 Relay，导致后续状态更新不再迁移终端，且可能展示错误路径。
- 现在 wrapper 在握手完成后暴露该连接实际走 P2P 或 Relay；若 P2P 在建立过程变可用且这条 WebSocket 落到 Relay，只补一次切换重连，以免不支持的端点反复循环。
- 首次 Playwright 运行中两条路径用例失败。追查发现测试假信令端可能在伪 WebSocket 创建前丢掉 offer/candidate，并非浏览器无法建立 WebRTC；增加按序缓存后，独立 Chromium 的完整 `remote-peer-channel.spec.ts` 5/5 通过，`typecheck:e2e` 通过。
- 本次仅证明本机 Chromium + 假 Relay 信令的 DataChannel、终端直连、Relay 回退和上传取消；真实桌面 hidden renderer 到手机、TURN/UDP 阻断、跨大陆网络和公网生产部署仍未验收。未重启桌面 App 或线上 Relay。

## 2026-10-06 京东云 Relay 版本核对

- 只读检查确认公网 OpenResty 将请求转发至本机 `127.0.0.1:4097` 的 `openctrlc-remote-relay` 容器；公网与 Relay 本机端口的 `GET /_remote/capabilities` 都返回 401。线上部署目录的 Relay 源文件创建于 2026-10-04，且该版本没有当前仓库中的公开能力路由。由此确认这是生产 Relay 版本落后，不是 Cloudflare Workers 或 OpenResty 路由造成；当前客户端仍通过旧 Relay 传输，但无法启用 P2P。
- 客户端现在把能力接口的 401/403/404/501 视为不可用能力，停止反复探测并继续已有 Relay 通道；网络错误及 5xx 仍退避重试。回归用例覆盖状态分类。
- 部署脚本现在在重载 OpenResty 前验证本机能力接口；公网 `remote-smoke.sh` 也检查免认证能力 JSON，避免首页/健康检查通过却仍运行旧 P2P 协议的情况。
- 线上 Relay 未更新、未重启；桌面 App 未重启。要让公网 P2P 生效，仍需在维护窗口部署当前 Relay 并配置可达的 ICE 服务，再做手机/美国路径实测。此处不将本机源码或本地测试等同于生产修复。

## 2026-10-06 公网远程根页断连复核

- 在用户截图对应的公网域名上重新捕获页面，当前状态是大面积空白，仅显示 `Desktop is disconnected`。通过 SSH 只读查询 Relay `/healthz` 得到 `sessions=1`、`connectedDesktops=0`、`authorizedBrowsers=4`、`activeViewerSockets=0`、`pendingPairings=0`。因此保留会话与浏览器授权还在，但没有桌面 WebSocket 在线；授权数不代表当前在线用户数，也不是内容丢失的证据。
- Relay 根工作区请求在该状态下返回裸 503 文本，浏览器把错误文字当成整页内容，缺少恢复说明。本地已改成四语断连说明、立即重试按钮和 5 秒自动重试；类型检查和 Relay bundle 构建通过，尚未部署或在生产浏览器验收。
- 没有为恢复页面而重启桌面或 Relay。此前只读检查确认线上仍是旧版、会话状态仅在内存；升级前必须保留授权/会话或明确安排重新配对，不能以“修 UI”为由清空现有状态。

## 2026-10-06 短暂掉线后的协议探测恢复

- Relay 健康接口会在桌面断开期间返回 `503 Desktop is disconnected`。协议探测原本只执行一次，而 Server SDK 与兼容 API 会复用该 Promise；即使桌面随后快速重连，当前页面的协议选择仍会永久保持失败。
- `packages/app/src/utils/server-protocol.ts` 现在只对超时、网络错误和 HTTP 5xx 做最多 4 次指数退避重试，健康探测仍并行发送；404、无效 JSON 等稳定的不兼容响应不会等待重试。协议成功后照常锁定 V1/V2，避免旧会话误走 V2。
- `packages/app/src/utils/server-protocol.test.ts` 覆盖首次 503、重连后恢复 V2；聚焦测试 6/6 通过。该有界重试覆盖数秒内的瞬断，不覆盖长时间桌面离线；那种情况下用户仍需重新加载页面，才能开始新一轮探测。
- 未重启桌面端或线上服务。它不能代替将 gzip 协商修复更新到长运行桌面进程和生产 Relay，也没有验证真实手机或美国网络。

## 2026-10-06 V2 服务端读取并续聊 V1 历史会话

- 原因已在本机 Electron 数据库和用户公网会话对照确认：全局服务协议为 V2，不代表每条会话已有 `session_message` 投影。指定旧会话的 V1 消息表有记录，V2 消息页却为空。仅在前端显示旧消息会造成第二个数据一致性问题：新提示若继续走 V2 runner，就会缺少旧上下文。
- App 首次打开 V2 会话时仍优先读取 V2。只有最新页为空，才请求同一桌面服务的 V1 消息列表；发现旧消息后缓存该会话为 V1，并让分页、父消息读取及提示词、命令、Shell、压缩、重命名、删除、分叉、中断、撤销暂存/清除和权限回复继续走 V1 API。V2 非空或已确认为空的会话不会反复探测 V1；404 视为没有旧历史，其他传输错误继续显示为错误。旧 V1 会话重连时跳过 V2 持久日志并使用 V1 快照同步，避免按错误的数据代际续接。
- 性能基线复用之前的本机旧历史测量：V1 20 条消息请求载荷 41,044 字节，完整耗时 3.9–8.6 ms；此前同会话公网 API 请求耗时 0.18–0.22 秒。旧会话首屏会先等 V2 空页，再请求 V1，增加一轮公网往返；后续分页直接用 V1。没有对线上新构建复测，不能宣称手机首屏更快。
- `packages/app` 聚焦测试 `bun test src/context/server-session.test.ts src/utils/server-compat.test.ts` 为 101 pass、0 fail；`bun run typecheck` 通过。覆盖旧历史回退、纯空 V2 一次探测、V1 提示路由及旧会话断线重连快照同步。
- 未重启、未部署或发版。发布前仍需新桌面进程连接浏览器验收旧会话完整历史、发送新提示后上下文、桌面/浏览器实时事件，以及新 V2 会话不受影响；任何发布操作必须遵循 `docs/release.md`。

## 2026-10-06 恢复协议提示与部署保护

- 远程工作区快照现在可携带已加载会话的 `v1`/`v2` 提示。浏览器在创建 Server SDK 前恢复提示，已知 V1 会话跳过空 V2 消息页，少一次串行 Relay 请求；没有提示的旧快照继续使用原兼容探测。App、Relay、Desktop 类型检查通过，App 的 `server-session.test.ts` 与 `remote-workspace.test.ts` 共 97 项通过。该变化只去掉一轮请求，尚无新的公网计时，不能单独认定 10 秒问题已解决。
- 桌面发布快照时，Solid 依赖通过稳定的“已加载会话协议摘要”唤醒；不能直接让快照 Effect 订阅消息数组，否则流式增量会持续重算和序列化工作区。
- 面向中国大陆的远程数据链路不使用 Cloudflare Workers、Durable Objects 或其他 Worker 转发。当前低成本方向是自有域名、自托管 Relay、WebRTC 直连优先和 HTTPS Relay 回退；P2P 的 ICE/TURN 需要先做大陆移动网络、家庭 NAT 与美国线路实测。P2P 成功率和 10,000 个会话记录上限都不是 10,000 用户容量承诺；按 5 Mbps 出口预算，实际瓶颈应按峰值 Relay 字节、并发活跃流和延迟决定。
- 生产只读检查中旧 Relay 的公开能力端点仍返回 401，STUN/TURN 未配置；当时 Relay 进程中有 1 个保留会话和 4 个浏览器授权，数据目录为空，因此这些状态仅驻留在内存。直接重启会丢失会话和授权。迁移前须实现并演练有签名/权限保护的状态导出恢复或安排用户重新配对的维护切换，再检查健康、授权恢复、现有设备重连和 P2P 回退；不能把当前部署脚本直接用于生产滚动。
- 直接只读检查旧 Relay 的快照校验函数确认，它仅保存 `projects`，会忽略/丢弃 `sessionIDs` 和 `sessionInfo`。因此浏览器完整恢复桌面标签和协议提示要求 Relay 升级；只更新 Desktop/App 不能修复线上当前版本的标签不同步。
- 尚未完成：同一浏览器导航中分段测量页面资源、协议探测、旧会话读取与消息首屏；新 Desktop/Relay 公网兼容验收；中国大陆手机及美国网络 P2P/TURN/Relay 路径验收。当前代理探测失败，因此本轮不拉取外部资源、不推送或发布。

## 2026-10-06 性能诊断脚本隐私与进程安全

- 移除硬编码的个人/公司工作区路径和真实 Session ID；探测脚本改为读取当前选中会话或显式传入目录，并只输出序号与计时。
- 默认不输出 localStorage 值、页面正文、消息响应片段和原始错误文本；URL 会隐藏会话/配对路径标识及所有查询值。完整页面截图需要显式 --screenshot。
- 页面抓取脚本默认不 reload，需显式 --reload；冷启动工具发现端口占用时退出，清理时只终止自己启动的进程组，不再按端口杀进程。
- 增加 perf/README.md 安全说明。运行 node --check 检查全部 .mjs 脚本，并单独检查 URL 脱敏输出；没有连接 CDP、读取用户会话正文、启动/关闭桌面进程或触碰公网 Relay。

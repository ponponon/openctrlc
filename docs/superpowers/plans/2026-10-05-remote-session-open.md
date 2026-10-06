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
- 当前本机桌面服务对先前指定的会话元数据与消息列表请求均返回 404，因此本轮无法针对那条会话重新测端到端加载时延。之前保存的本地 API 毫秒级基线仍然只适用于当时那条本地会话；早前公网采样的 6.6 MB provider 响应和 39.8 秒父会话 TTFB 也不能代表当前这个空白根页面。
- 线上 Relay/桌面服务未重启、未部署、未更新。下一次定位需要从同一次失败导航采集：完整请求 URL、状态码、`Content-Encoding`、`Content-Length`、`Vary`、`ETag`/缓存头、解压后和原始响应体前几十字节，以及桌面端/Relay 对应时间段日志；然后用当前发布版复测。禁止仅凭截图归因或宣称修复完成。

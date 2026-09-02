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
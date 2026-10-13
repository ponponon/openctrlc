# Desktop 自动更新 feed 发布链路实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通 electron-updater channel file（`latest*.yml`）的 rewrite → finalize → verify 发布链路，修复三平台自动更新 404，并把发布契约接入 CI。

**Architecture:** 各 build job 打包后就地按 sha512 重写 yml 的 `url` 并以 target-triple 命名上传 workflow artifact；新增 `finalize-update-feed` job 汇总合并（Windows 双架构）后在 draft 阶段上传 Release；`publish` 公开后由 `verify-update-feed` job 匿名公网校验，失败红灯。

**Tech Stack:** Bun（脚本与测试）、`yaml@2.9.0`（根 workspace 依赖）、GitHub Actions（`upload-artifact@v4.6.2` / `download-artifact@v4.3.0`，均已在 publish.yml 中 pin）、bun test。

**Spec:** `docs/superpowers/specs/2026-10-12-desktop-update-feed-release-design.md`

**通用约定（每个任务都适用）：**

- commit message 用中文 `type(scope): subject`，尾行 `edit by mimo-v2.6-flash`
- 每次 commit 前 `git diff --cached` 检查无 api key / 密码 / 私钥
- 测试从包目录跑，不从仓库根目录跑
- 代码风格：避免 `any`、避免 `else`、优先 `const` 与早返回、不加与逻辑无关的注释

---

## File Structure

| 文件                                                      | 动作 | 职责                                                                                  |
| --------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| `packages/desktop/scripts/rewrite-update-feed.ts`         | 新建 | build job 内按 sha512 重写 channel file 的 url + 结构断言                             |
| `packages/desktop/scripts/rewrite-update-feed.test.ts`    | 新建 | 上述脚本的 fixture 测试                                                               |
| `packages/desktop/scripts/finalize-latest-yml.ts`         | 修改 | 拆出 `buildOutputs`，tag 改 `RELEASE_TAG`，4 文件齐全校验，`import.meta.main` 守卫    |
| `packages/desktop/scripts/finalize-latest-yml.test.ts`    | 新建 | 合并与缺失校验测试                                                                    |
| `script/verify-update-feed.ts`                            | 新建 | Release 公开后匿名公网校验 channel file 与安装包                                      |
| `script/verify-update-feed.test.ts`                       | 新建 | 本地 `Bun.serve` 端到端测试                                                           |
| `packages/desktop/scripts/prepare.ts`                     | 修改 | prod 缺 `OPENCTRLC_VERSION` 时警告                                                    |
| `.github/workflows/publish.yml`                           | 修改 | 3 个 build job 加 rewrite+artifact；新增 `finalize-update-feed`、`verify-update-feed` |
| `script/publish-contract.test.ts`                         | 修改 | 修白名单/禁止词，加新链路断言                                                         |
| `.github/workflows/test.yml`                              | 修改 | 挂载契约测试                                                                          |
| `FEATURE.md` / `FailureExperience.md` / `docs/release.md` | 修改 | 文档与教训                                                                            |

---

### Task 1: rewrite-update-feed 脚本

**Files:**

- Create: `packages/desktop/scripts/rewrite-update-feed.ts`
- Test: `packages/desktop/scripts/rewrite-update-feed.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `packages/desktop/scripts/rewrite-update-feed.test.ts`：

```ts
import { createHash } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { parse, stringify } from "yaml"
import { rewriteFeed } from "./rewrite-update-feed"

const sha512 = (content: string) => createHash("sha512").update(content).digest("base64")

async function makeDist() {
  const dist = await mkdtemp(join(tmpdir(), "openctrlc-rewrite-"))
  await writeFile(join(dist, "openctrlc-linux-x64.deb"), "deb-bytes")
  await writeFile(join(dist, "openctrlc-linux-x64.AppImage"), "appimage-bytes")
  await writeFile(join(dist, "openctrlc-linux-x64.rpm"), "rpm-bytes")
  const yml = {
    version: "1.1.8",
    files: [
      { url: "openctrlc-linux-amd64.deb", sha512: sha512("deb-bytes"), size: 9 },
      { url: "openctrlc-linux-x86_64.AppImage", sha512: sha512("appimage-bytes"), size: 15 },
      { url: "openctrlc-linux-x86_64.rpm", sha512: sha512("rpm-bytes"), size: 9 },
    ],
    path: "openctrlc-linux-amd64.deb",
    sha512: sha512("deb-bytes"),
    releaseDate: "2026-10-12T00:00:00.000Z",
  }
  await Bun.write(join(dist, "latest-linux.yml"), stringify(yml))
  return dist
}

test("rewrites channel urls to renamed artifact names", async () => {
  const dist = await makeDist()
  try {
    const result = await rewriteFeed(dist)
    expect(result.rewritten).toEqual(["latest-linux.yml"])
    const updated = parse(await Bun.file(join(dist, "latest-linux.yml")).text())
    expect(updated.files.map((entry: { url: string }) => entry.url)).toEqual([
      "openctrlc-linux-x64.deb",
      "openctrlc-linux-x64.AppImage",
      "openctrlc-linux-x64.rpm",
    ])
    expect(updated.path).toBe("openctrlc-linux-x64.deb")
  } finally {
    await rm(dist, { recursive: true, force: true })
  }
})

test("is idempotent when urls already match", async () => {
  const dist = await makeDist()
  try {
    await rewriteFeed(dist)
    const second = await rewriteFeed(dist)
    expect(second.rewritten).toEqual([])
    expect(second.untouched).toEqual(["latest-linux.yml"])
  } finally {
    await rm(dist, { recursive: true, force: true })
  }
})

test("fails when an entry sha512 has no matching file in dist", async () => {
  const dist = await makeDist()
  try {
    const ymlPath = join(dist, "latest-linux.yml")
    const yml = parse(await Bun.file(ymlPath).text())
    yml.files[0].sha512 = sha512("ghost")
    await Bun.write(ymlPath, stringify(yml))
    await expect(rewriteFeed(dist)).rejects.toThrow("no file in dist matches")
  } finally {
    await rm(dist, { recursive: true, force: true })
  }
})

test("fails when a linux channel file misses an installer extension", async () => {
  const dist = await makeDist()
  try {
    await rm(join(dist, "openctrlc-linux-x64.rpm"))
    const ymlPath = join(dist, "latest-linux.yml")
    const yml = parse(await Bun.file(ymlPath).text())
    yml.files = yml.files.filter((entry: { url: string }) => !entry.url.endsWith(".rpm"))
    await Bun.write(ymlPath, stringify(yml))
    await expect(rewriteFeed(dist)).rejects.toThrow("missing .rpm entry")
  } finally {
    await rm(dist, { recursive: true, force: true })
  }
})

test("fails when dist has no channel file", async () => {
  const dist = await mkdtemp(join(tmpdir(), "openctrlc-rewrite-empty-"))
  try {
    await expect(rewriteFeed(dist)).rejects.toThrow("no channel file found")
  } finally {
    await rm(dist, { recursive: true, force: true })
  }
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/desktop && bun test scripts/rewrite-update-feed.test.ts`
Expected: FAIL，`Cannot find module './rewrite-update-feed'`

- [ ] **Step 3: 实现脚本**

创建 `packages/desktop/scripts/rewrite-update-feed.ts`：

```ts
#!/usr/bin/env bun
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse, stringify } from "yaml"

const packageDir = path.dirname(fileURLToPath(import.meta.url))

type FeedEntry = { url?: string; sha512?: string; size?: number }

type ChannelFile = {
  version?: string
  files?: FeedEntry[]
  path?: string
  sha512?: string
  [key: string]: unknown
}

export async function rewriteFeed(distDir: string) {
  const installerHashes = await hashInstallers(distDir)
  const ymlNames = (await Array.fromAsync(new Bun.Glob("latest*.yml").scan(distDir))).sort()
  if (ymlNames.length === 0) throw new Error(`no channel file found in ${distDir}`)

  const rewritten: string[] = []
  const untouched: string[] = []

  for (const name of ymlNames) {
    const file = path.join(distDir, name)
    const channel = parse(await Bun.file(file).text()) as ChannelFile
    const entries = channel.files ?? []
    const first = entries[0]
    if (!first?.url || !first.sha512) throw new Error(`${name}: first entry missing url or sha512`)
    const firstUrl = first.url

    let changed = false
    for (const entry of entries) {
      if (!entry.url || !entry.sha512) throw new Error(`${name}: entry missing url or sha512`)
      const actual = installerHashes.get(entry.sha512)
      if (!actual) throw new Error(`${name}: no file in dist matches sha512 of ${entry.url}`)
      if (entry.url === actual) continue
      console.log(`${name}: ${entry.url} -> ${actual}`)
      entry.url = actual
      changed = true
    }

    if (name.startsWith("latest-linux")) assertLinuxInstallers(name, entries)
    if (changed && channel.path === firstUrl) channel.path = entries[0].url

    if (changed) {
      await Bun.write(file, stringify(channel))
      rewritten.push(name)
      continue
    }
    untouched.push(name)
  }

  return { rewritten, untouched }
}

async function hashInstallers(distDir: string) {
  const hashes = new Map<string, string>()
  const names = (await Array.fromAsync(new Bun.Glob("*").scan(distDir))).sort()
  for (const name of names) {
    if (name.endsWith(".yml")) continue
    const file = path.join(distDir, name)
    if (!(await Bun.file(file).isFile())) continue
    const hasher = new Bun.CryptoHasher("sha512")
    for await (const chunk of Bun.file(file).stream()) hasher.update(chunk)
    hashes.set(Buffer.from(hasher.digest()).toString("base64"), name)
  }
  return hashes
}

function assertLinuxInstallers(name: string, entries: FeedEntry[]) {
  const urls = entries.map((entry) => entry.url?.toLowerCase() ?? "")
  for (const ext of ["deb", "appimage", "rpm"]) {
    if (!urls.some((url) => url.endsWith(`.${ext}`))) throw new Error(`${name}: missing .${ext} entry`)
  }
}

if (import.meta.main) {
  const distDir = process.argv[2] ?? path.join(packageDir, "..", "dist")
  const result = await rewriteFeed(distDir)
  console.log(`rewrote: ${result.rewritten.join(", ") || "(none)"}`)
  if (result.untouched.length > 0) console.log(`unchanged: ${result.untouched.join(", ")}`)
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/desktop && bun test scripts/rewrite-update-feed.test.ts`
Expected: 5 pass, 0 fail

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/scripts/rewrite-update-feed.ts packages/desktop/scripts/rewrite-update-feed.test.ts
git diff --cached   # 确认无敏感内容
git commit -m "feat(release): 新增 update feed url 重写脚本

edit by mimo-v2.6-flash"
```

---

### Task 2: finalize-latest-yml 改造

**Files:**

- Modify: `packages/desktop/scripts/finalize-latest-yml.ts`
- Test: `packages/desktop/scripts/finalize-latest-yml.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `packages/desktop/scripts/finalize-latest-yml.test.ts`：

```ts
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { stringify } from "yaml"
import { buildOutputs } from "./finalize-latest-yml"

async function makeFeedRoot() {
  const dir = await mkdtemp(join(tmpdir(), "openctrlc-finalize-"))
  const write = async (subdir: string, file: string, content: unknown) => {
    await mkdir(join(dir, subdir), { recursive: true })
    await Bun.write(join(dir, subdir, file), stringify(content))
  }
  const entry = (url: string) => ({ url, sha512: "c2hh", size: 1 })
  await write("latest-yml-x86_64-pc-windows-msvc", "latest.yml", {
    version: "1.1.8",
    files: [entry("openctrlc-win-x64.exe")],
    releaseDate: "2026-10-12T00:00:00.000Z",
  })
  await write("latest-yml-aarch64-pc-windows-msvc", "latest.yml", {
    version: "1.1.8",
    files: [entry("openctrlc-win-arm64.exe")],
    releaseDate: "2026-10-12T00:00:00.000Z",
  })
  await write("latest-yml-x86_64-unknown-linux-gnu", "latest-linux.yml", {
    version: "1.1.8",
    files: [entry("openctrlc-linux-x64.deb")],
    releaseDate: "2026-10-12T00:00:00.000Z",
  })
  await write("latest-yml-aarch64-unknown-linux-gnu", "latest-linux-arm64.yml", {
    version: "1.1.8",
    files: [entry("openctrlc-linux-arm64.deb")],
    releaseDate: "2026-10-12T00:00:00.000Z",
  })
  await write("latest-yml-aarch64-apple-darwin", "latest-mac.yml", {
    version: "1.1.8",
    files: [entry("openctrlc-mac-arm64.zip")],
    releaseDate: "2026-10-12T00:00:00.000Z",
  })
  return dir
}

test("merges windows arches and produces all four channel files", async () => {
  const dir = await makeFeedRoot()
  try {
    const output = await buildOutputs(dir)
    expect(Object.keys(output).sort()).toEqual([
      "latest-linux-arm64.yml",
      "latest-linux.yml",
      "latest-mac.yml",
      "latest.yml",
    ])
    expect(output["latest.yml"]).toContain("openctrlc-win-x64.exe")
    expect(output["latest.yml"]).toContain("openctrlc-win-arm64.exe")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("fails when one channel file source is missing", async () => {
  const dir = await makeFeedRoot()
  try {
    await rm(join(dir, "latest-yml-aarch64-unknown-linux-gnu"), { recursive: true })
    await expect(buildOutputs(dir)).rejects.toThrow("missing channel files: latest-linux-arm64.yml")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("takes the release tag from RELEASE_TAG instead of deriving it", async () => {
  const source = await Bun.file(join(import.meta.dirname, "finalize-latest-yml.ts")).text()
  expect(source).toContain("RELEASE_TAG")
  expect(source).toContain("missing channel files")
  expect(source).not.toContain("OPENCTRLC_CHANNEL")
  expect(source).not.toContain("OPENCTRLC_VERSION")
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/desktop && bun test scripts/finalize-latest-yml.test.ts`
Expected: FAIL，`buildOutputs` 未导出 / `RELEASE_TAG` 断言失败

- [ ] **Step 3: 改造脚本**

将 `packages/desktop/scripts/finalize-latest-yml.ts` 整体替换为：

```ts
#!/usr/bin/env bun

import { $ } from "bun"
import path from "path"

export const REQUIRED_CHANNEL_FILES = ["latest.yml", "latest-mac.yml", "latest-linux.yml", "latest-linux-arm64.yml"]

type FileEntry = {
  url: string
  sha512: string
  size: number
  blockMapSize?: number
}

type LatestYml = {
  version: string
  files: FileEntry[]
  releaseDate: string
}

function parse(content: string): LatestYml {
  const lines = content.split("\n")
  let version = ""
  let releaseDate = ""
  const files: FileEntry[] = []
  let current: Partial<FileEntry> | undefined

  const flush = () => {
    if (current?.url && current.sha512 && current.size) files.push(current as FileEntry)
    current = undefined
  }

  for (const line of lines) {
    const indented = line.startsWith("    ") || line.startsWith("  -")
    if (line.startsWith("version:")) version = line.slice("version:".length).trim()
    else if (line.startsWith("releaseDate:"))
      releaseDate = line.slice("releaseDate:".length).trim().replace(/^'|'$/g, "")
    else if (line.trim().startsWith("- url:")) {
      flush()
      current = { url: line.trim().slice("- url:".length).trim() }
    } else if (indented && current && line.trim().startsWith("sha512:"))
      current.sha512 = line.trim().slice("sha512:".length).trim()
    else if (indented && current && line.trim().startsWith("size:"))
      current.size = Number(line.trim().slice("size:".length).trim())
    else if (indented && current && line.trim().startsWith("blockMapSize:"))
      current.blockMapSize = Number(line.trim().slice("blockMapSize:".length).trim())
    else if (!indented && current) flush()
  }
  flush()

  return { version, files, releaseDate }
}

function serialize(data: LatestYml) {
  const lines = [`version: ${data.version}`, "files:"]
  for (const file of data.files) {
    lines.push(`  - url: ${file.url}`)
    lines.push(`    sha512: ${file.sha512}`)
    lines.push(`    size: ${file.size}`)
    if (file.blockMapSize) lines.push(`    blockMapSize: ${file.blockMapSize}`)
  }
  lines.push(`releaseDate: '${data.releaseDate}'`)
  return lines.join("\n") + "\n"
}

async function read(dir: string, subdir: string, filename: string): Promise<LatestYml | undefined> {
  const file = Bun.file(path.join(dir, subdir, filename))
  if (!(await file.exists())) return undefined
  return parse(await file.text())
}

export async function buildOutputs(dir: string): Promise<Record<string, string>> {
  const output: Record<string, string> = {}

  // Windows: merge arm64 + x64 into single file
  const winX64 = await read(dir, "latest-yml-x86_64-pc-windows-msvc", "latest.yml")
  const winArm64 = await read(dir, "latest-yml-aarch64-pc-windows-msvc", "latest.yml")
  if (winX64 || winArm64) {
    const base = winArm64 ?? winX64!
    output["latest.yml"] = serialize({
      version: base.version,
      files: [...(winArm64?.files ?? []), ...(winX64?.files ?? [])],
      releaseDate: base.releaseDate,
    })
  }

  // Linux x64: pass through
  const linuxX64 = await read(dir, "latest-yml-x86_64-unknown-linux-gnu", "latest-linux.yml")
  if (linuxX64) output["latest-linux.yml"] = serialize(linuxX64)

  // Linux arm64: pass through
  const linuxArm64 = await read(dir, "latest-yml-aarch64-unknown-linux-gnu", "latest-linux-arm64.yml")
  if (linuxArm64) output["latest-linux-arm64.yml"] = serialize(linuxArm64)

  // macOS: merge arm64 + x64 into single file
  const macX64 = await read(dir, "latest-yml-x86_64-apple-darwin", "latest-mac.yml")
  const macArm64 = await read(dir, "latest-yml-aarch64-apple-darwin", "latest-mac.yml")
  if (macX64 || macArm64) {
    const base = macArm64 ?? macX64!
    output["latest-mac.yml"] = serialize({
      version: base.version,
      files: [...(macArm64?.files ?? []), ...(macX64?.files ?? [])],
      releaseDate: base.releaseDate,
    })
  }

  const missing = REQUIRED_CHANNEL_FILES.filter((name) => !(name in output))
  if (missing.length > 0) throw new Error(`missing channel files: ${missing.join(", ")}`)
  return output
}

if (import.meta.main) {
  const dir = process.env.LATEST_YML_DIR
  if (!dir) throw new Error("LATEST_YML_DIR is required")
  const repo = process.env.GH_REPO
  if (!repo) throw new Error("GH_REPO is required")
  const tag = process.env.RELEASE_TAG
  if (!tag) throw new Error("RELEASE_TAG is required")

  const output = await buildOutputs(dir)
  const tmp = process.env.RUNNER_TEMP ?? "/tmp"

  for (const [filename, content] of Object.entries(output)) {
    const filepath = path.join(tmp, filename)
    await Bun.write(filepath, content)
    await $`gh release upload ${tag} ${filepath} --clobber --repo ${repo}`
    console.log(`uploaded ${filename}`)
  }

  console.log("finalized latest yml files")
}
```

要点：

- `parse`/`serialize`/merge 主体保持原样；`read` 增加 `dir` 参数；环境变量检查与 `gh` 上传移入 `import.meta.main` 守卫，脚本可被测试 import。
- 删除原 `OPENCTRLC_VERSION` 必填检查与 `beta ? "beta" : \`v${version}\``tag 推导，改为`RELEASE_TAG` 必填。
- 输出不满 4 个文件时抛 `missing channel files: ...`。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/desktop && bun test scripts/finalize-latest-yml.test.ts`
Expected: 3 pass, 0 fail

- [ ] **Step 5: 连跑 Task 1 测试防回归**

Run: `cd packages/desktop && bun test scripts/`
Expected: 全部 pass（含既有 `utils.test.ts`）

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/scripts/finalize-latest-yml.ts packages/desktop/scripts/finalize-latest-yml.test.ts
git diff --cached
git commit -m "refactor(desktop): finalize 更新 feed 校验与 tag 来源

edit by mimo-v2.6-flash"
```

---

### Task 3: verify-update-feed 脚本

**Files:**

- Create: `script/verify-update-feed.ts`
- Test: `script/verify-update-feed.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `script/verify-update-feed.test.ts`：

```ts
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { stringify } from "yaml"
import { collectResults, renderSummary } from "./verify-update-feed"

const CHANNEL_FILES = ["latest.yml", "latest-mac.yml", "latest-linux.yml", "latest-linux-arm64.yml"]

function channelYml(entryUrl: string, size: number) {
  return stringify({
    version: "1.1.8",
    files: [{ url: entryUrl, sha512: "c2hh", size }],
    path: entryUrl,
    sha512: "c2hh",
    releaseDate: "2026-10-12T00:00:00.000Z",
  })
}

async function serve(files: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), "openctrlc-verify-"))
  for (const [name, content] of Object.entries(files)) await Bun.write(join(dir, name), content)
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const name = new URL(request.url).pathname.slice(1)
      const file = Bun.file(join(dir, name))
      if (!(await file.exists())) return new Response("not found", { status: 404 })
      return new Response(file)
    },
  })
  return { dir, server, base: `http://localhost:${server.port}` }
}

test("passes when every channel file and installer is reachable", async () => {
  const files: Record<string, string> = { "app.deb": "abc" }
  for (const name of CHANNEL_FILES) files[name] = channelYml("app.deb", 3)
  const { dir, server, base } = await serve(files)
  try {
    const results = await collectResults(base)
    expect(results.length).toBeGreaterThan(4)
    expect(results.every((result) => result.ok)).toBe(true)
    expect(renderSummary(results, base)).toContain("✅")
  } finally {
    server.stop(true)
    await rm(dir, { recursive: true, force: true })
  }
})

test("fails when a channel file is missing", async () => {
  const files: Record<string, string> = { "app.deb": "abc" }
  for (const name of CHANNEL_FILES) files[name] = channelYml("app.deb", 3)
  delete files["latest-linux-arm64.yml"]
  const { dir, server, base } = await serve(files)
  try {
    const results = await collectResults(base)
    const missing = results.find((result) => result.target === "latest-linux-arm64.yml")
    expect(missing?.ok).toBe(false)
    expect(missing?.status).toBe(404)
    expect(renderSummary(results, base)).toContain("❌")
  } finally {
    server.stop(true)
    await rm(dir, { recursive: true, force: true })
  }
})

test("fails when the installer size disagrees with the channel file", async () => {
  const files: Record<string, string> = { "app.deb": "abc" }
  for (const name of CHANNEL_FILES) files[name] = channelYml("app.deb", 99)
  const { dir, server, base } = await serve(files)
  try {
    const results = await collectResults(base)
    const installer = results.find((result) => result.kind === "installer")
    expect(installer?.ok).toBe(false)
    expect(installer?.note).toContain("size mismatch")
  } finally {
    server.stop(true)
    await rm(dir, { recursive: true, force: true })
  }
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd script && bun test verify-update-feed.test.ts`
Expected: FAIL，`Cannot find module './verify-update-feed'`

- [ ] **Step 3: 实现脚本**

创建 `script/verify-update-feed.ts`：

```ts
#!/usr/bin/env bun
import { parseDocument } from "yaml"

export const CHANNEL_FILES = ["latest.yml", "latest-mac.yml", "latest-linux.yml", "latest-linux-arm64.yml"]

export type Check = {
  target: string
  kind: "channel" | "installer"
  status: number
  ms: number
  ok: boolean
  note?: string
}

type ChannelEntry = { url?: string; size?: number }
type ChannelFile = { files?: ChannelEntry[] }

async function fetchText(url: string) {
  const started = performance.now()
  const response = await fetch(url, { redirect: "follow" })
  const text = await response.text()
  return { status: response.status, text, ms: Math.round(performance.now() - started) }
}

async function fetchHead(url: string) {
  const started = performance.now()
  const response = await fetch(url, { redirect: "follow" })
  const length = response.headers.get("content-length")
  await response.body?.cancel()
  return {
    status: response.status,
    length: length === null ? undefined : Number(length),
    ms: Math.round(performance.now() - started),
  }
}

export async function collectResults(baseUrl: string): Promise<Check[]> {
  const results: Check[] = []
  for (const name of CHANNEL_FILES) {
    const channel = await fetchText(`${baseUrl}/${name}`)
    results.push({
      target: name,
      kind: "channel",
      status: channel.status,
      ms: channel.ms,
      ok: channel.status === 200,
    })
    if (channel.status !== 200) continue

    const document = parseDocument(channel.text)
    if (document.errors.length > 0) {
      results.push({
        target: `${name} (parse)`,
        kind: "channel",
        status: channel.status,
        ms: channel.ms,
        ok: false,
        note: document.errors[0].message,
      })
      continue
    }
    const parsed = document.toJS() as ChannelFile

    for (const entry of parsed.files ?? []) {
      if (!entry.url) {
        results.push({
          target: `${name} → (missing url)`,
          kind: "installer",
          status: channel.status,
          ms: channel.ms,
          ok: false,
          note: "entry missing url",
        })
        continue
      }
      const head = await fetchHead(`${baseUrl}/${entry.url}`)
      const mismatch = head.length !== undefined && entry.size !== undefined && head.length !== entry.size
      results.push({
        target: `${name} → ${entry.url}`,
        kind: "installer",
        status: head.status,
        ms: head.ms,
        ok: head.status === 200 && !mismatch,
        note: mismatch ? `size mismatch: yml ${entry.size} vs http ${head.length}` : undefined,
      })
    }
  }
  return results
}

export function renderSummary(results: Check[], baseUrl: string): string {
  const lines = [
    "## Update feed verification",
    "",
    `Base: \`${baseUrl}\``,
    "",
    "| Target | Status | Time | Result | Note |",
    "| --- | --- | --- | --- | --- |",
  ]
  for (const result of results) {
    lines.push(
      `| ${result.target} | ${result.status} | ${result.ms}ms | ${result.ok ? "✅" : "❌"} | ${result.note ?? ""} |`,
    )
  }
  const failed = results.filter((result) => !result.ok)
  lines.push("")
  lines.push(failed.length === 0 ? `All ${results.length} checks passed.` : `${failed.length} check(s) failed.`)
  return lines.join("\n")
}

if (import.meta.main) {
  const repo = process.env.GH_REPO ?? process.env.GITHUB_REPOSITORY
  if (!repo) throw new Error("GH_REPO or GITHUB_REPOSITORY is required")
  const tag = process.env.RELEASE_TAG
  if (!tag) throw new Error("RELEASE_TAG is required")
  const baseUrl = process.env.UPDATE_FEED_BASE_URL ?? `https://github.com/${repo}/releases/download/${tag}`

  const results = await collectResults(baseUrl)
  const summary = renderSummary(results, baseUrl)
  console.log(summary)

  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (summaryPath) await Bun.write(summaryPath, summary + "\n", { create: true, append: true })

  if (results.some((result) => !result.ok)) {
    console.error("update feed verification failed")
    process.exit(1)
  }
}
```

要点：

- 校验时对安装包只取响应头（`body.cancel()`），不下载几百 MB。
- 不使用 `GH_TOKEN`：Release 公开后走真实用户的匿名公网路径。
- `UPDATE_FEED_BASE_URL` 可覆盖，测试指向本地 `Bun.serve`。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd script && bun test verify-update-feed.test.ts`
Expected: 3 pass, 0 fail

- [ ] **Step 5: Commit**

```bash
git add script/verify-update-feed.ts script/verify-update-feed.test.ts
git diff --cached
git commit -m "feat(release): 新增发布后更新 feed 公网校验

edit by mimo-v2.6-flash"
```

---

### Task 4: prepare.ts 版本注入警告

**Files:**

- Modify: `packages/desktop/scripts/prepare.ts`

- [ ] **Step 1: 加警告（在 import 之后、`await import("./prebuild")` 之前）**

`packages/desktop/scripts/prepare.ts` 修改为：

```ts
#!/usr/bin/env bun
import { Script } from "@openctrlc/script"

if (process.env.OPENCTRLC_CHANNEL === "prod" && !process.env.OPENCTRLC_VERSION) {
  console.warn(
    [
      "WARNING: OPENCTRLC_CHANNEL=prod without OPENCTRLC_VERSION.",
      "The build will embed the stale package.json version, which will not match the release tag.",
      "Set OPENCTRLC_VERSION before packaging a publishable build (CI sets it automatically).",
    ].join("\n"),
  )
}

await import("./prebuild")

const pkg = await Bun.file("./package.json").json()
pkg.version = Script.version
await Bun.write("./package.json", JSON.stringify(pkg, null, 2) + "\n")
console.log(`Updated package.json version to ${Script.version}`)
```

- [ ] **Step 2: 手工验证两种路径**

Run: `cd packages/desktop && OPENCTRLC_CHANNEL=prod bun scripts/prepare.ts`
Expected: 先打印三行 `WARNING: OPENCTRLC_CHANNEL=prod without OPENCTRLC_VERSION....`，随后正常输出 `Updated package.json version to ...`（退出码 0，警告不阻断）。

注意：该命令会改写 `packages/desktop/package.json` 的 version，验证后用 `git checkout -- packages/desktop/package.json` 还原。

Run: `cd packages/desktop && OPENCTRLC_CHANNEL=prod OPENCTRLC_VERSION=9.9.9 bun scripts/prepare.ts`
Expected: **无** WARNING，输出 `Updated package.json version to 9.9.9`。随后同样还原 package.json。

- [ ] **Step 3: Commit**

```bash
git checkout -- packages/desktop/package.json
git add packages/desktop/scripts/prepare.ts
git diff --cached
git commit -m "chore(desktop): prod 打包缺版本注入时打印警告

edit by mimo-v2.6-flash"
```

---

### Task 5: publish.yml 接线 + 契约测试修复 + test.yml 挂载

**Files:**

- Modify: `.github/workflows/publish.yml`
- Modify: `script/publish-contract.test.ts`
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: 先改契约测试（此刻应失败）**

`script/publish-contract.test.ts` 三处修改：

1. job 白名单改为（顺序 = YAML 中声明顺序）：

```ts
expect(Object.keys(workflow.jobs ?? {})).toEqual([
  "version",
  "ensure-tag",
  "build-cli",
  "sign-cli-macos",
  "check-desktop-icons",
  "build-desktop-macos",
  "build-desktop-windows",
  "build-desktop-linux",
  "finalize-update-feed",
  "publish",
  "verify-update-feed",
  "sync-downloads",
  "sync-release-versions",
])
```

2. 禁止词列表删除 `"script/publish.ts",` 一行（`publish.yml:503` 现状即使用它，该禁止词已过期）。

3. 第一个 test 末尾（`expect(linuxSource).toContain('[ "$source" != "$target" ]')` 之后）追加：

```ts
expect(desktopSource).toContain("rewrite-update-feed.ts")
expect(windowsSource).toContain("rewrite-update-feed.ts")
expect(linuxSource).toContain("rewrite-update-feed.ts")

const finalize = workflow.jobs?.["finalize-update-feed"]
expect(finalize?.needs).toEqual(["version", "build-desktop-macos", "build-desktop-windows", "build-desktop-linux"])
expect(finalize?.["runs-on"]).toBe("ubuntu-24.04")
const finalizeSource = JSON.stringify(finalize?.steps ?? [])
expect(finalizeSource).toContain("latest-yml-*")
expect(finalizeSource).toContain("*.yml")
expect(finalizeSource).toContain("finalize-latest-yml.ts")
expect(finalizeSource).toContain("RELEASE_TAG")
expect(finalizeSource).toContain("GH_TOKEN")

expect(publish?.needs).toContain("finalize-update-feed")

const verify = workflow.jobs?.["verify-update-feed"]
expect(verify?.needs).toEqual(["version", "publish"])
expect(verify?.["runs-on"]).toBe("ubuntu-24.04")
const verifySource = JSON.stringify(verify?.steps ?? [])
expect(verifySource).toContain("verify-update-feed.ts")
expect(verifySource).not.toContain("secrets.GITHUB_TOKEN")
```

说明：`verify` 步骤不得携带 token（匿名校验真实用户路径）；`finalize` 步骤的 `*.yml` 断言锁定 upload-artifact 通配符写法（保证文件落在 artifact 根目录，与 download 的 `<path>/<artifact名>/` 结构对齐）。

- [ ] **Step 2: 运行契约测试确认失败**

Run: `cd script && bun test publish-contract.test.ts`
Expected: FAIL（白名单不符 —— `finalize-update-feed` 还不存在）

- [ ] **Step 3: 改 publish.yml**

`.github/workflows/publish.yml` 六处修改：

**(a) macOS job** —— 在 `Build and notarize macOS Desktop` 步骤之后、`Upload macOS Desktop assets` 之前插入：

```yaml
- name: Prepare update feed file
  run: |
    set -euo pipefail
    bun packages/desktop/scripts/rewrite-update-feed.ts
    mkdir -p packages/desktop/latest-yml-aarch64-apple-darwin
    cp packages/desktop/dist/latest-mac.yml packages/desktop/latest-yml-aarch64-apple-darwin/

- name: Upload update feed file
  uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
  with:
    name: latest-yml-aarch64-apple-darwin
    path: packages/desktop/latest-yml-aarch64-apple-darwin/*.yml
    if-no-files-found: error
```

**(b) Windows job** —— 在 `Build and package Windows Desktop` 之后、`Upload Windows Desktop assets` 之前插入：

```yaml
- name: Prepare update feed file
  id: feed
  env:
    MATRIX_ARCH: ${{ matrix.arch }}
  run: |
    set -euo pipefail
    case "$MATRIX_ARCH" in
      x64) triple=x86_64-pc-windows-msvc ;;
      arm64) triple=aarch64-pc-windows-msvc ;;
      *) echo "unknown arch $MATRIX_ARCH" >&2; exit 1 ;;
    esac
    bun packages/desktop/scripts/rewrite-update-feed.ts
    mkdir -p "packages/desktop/latest-yml-${triple}"
    cp packages/desktop/dist/latest.yml "packages/desktop/latest-yml-${triple}/"
    echo "triple=${triple}" >> "$GITHUB_OUTPUT"

- name: Upload update feed file
  uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
  with:
    name: latest-yml-${{ steps.feed.outputs.triple }}
    path: packages/desktop/latest-yml-${{ steps.feed.outputs.triple }}/*.yml
    if-no-files-found: error
```

（Windows job 已有 `defaults.run.shell: bash`，case 语法可用。）

**(c) Linux job** —— 在 `Build and package Linux Desktop` 之后、`Upload Linux Desktop assets` 之前插入：

```yaml
- name: Prepare update feed file
  id: feed
  env:
    MATRIX_ARCH: ${{ matrix.arch }}
  run: |
    set -euo pipefail
    case "$MATRIX_ARCH" in
      x64) triple=x86_64-unknown-linux-gnu ;;
      arm64) triple=aarch64-unknown-linux-gnu ;;
      *) echo "unknown arch $MATRIX_ARCH" >&2; exit 1 ;;
    esac
    bun packages/desktop/scripts/rewrite-update-feed.ts
    mkdir -p "packages/desktop/latest-yml-${triple}"
    cp packages/desktop/dist/latest-linux*.yml "packages/desktop/latest-yml-${triple}/"
    echo "triple=${triple}" >> "$GITHUB_OUTPUT"

- name: Upload update feed file
  uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
  with:
    name: latest-yml-${{ steps.feed.outputs.triple }}
    path: packages/desktop/latest-yml-${{ steps.feed.outputs.triple }}/*.yml
    if-no-files-found: error
```

注意：Linux 的重命名（`openctrlc-linux-{arch}.{ext}`）发生在 build 步骤内部，故 rewrite 必须放在其后（本插入点满足）；`cp latest-linux*.yml` 在 x64 job 匹配 `latest-linux.yml`，arm64 job 匹配 `latest-linux-arm64.yml`，glob 无匹配时 `set -euo pipefail` 使 job 失败（期望行为）。

**(d) 新增 `finalize-update-feed` job** —— 插在 `build-desktop-linux` job 结束与 `  publish:` 之间：

```yaml
finalize-update-feed:
  needs:
    - version
    - build-desktop-macos
    - build-desktop-windows
    - build-desktop-linux
  if: github.repository == 'ponponon/openctrlc'
  runs-on: ubuntu-24.04
  steps:
    - uses: actions/checkout@f43a0e5ff2bd294095638e18286ca9a3d1956744 # v3.6.0
      with:
        ref: ${{ github.sha }}

    - uses: ./.github/actions/setup-bun

    - name: Download update feed files
      uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4.3.0
      with:
        pattern: latest-yml-*
        path: update-feed

    - name: Upload update feed files to release
      env:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        GH_REPO: ${{ needs.version.outputs.repo }}
        RELEASE_TAG: ${{ needs.version.outputs.tag }}
        LATEST_YML_DIR: ${{ github.workspace }}/update-feed
      run: bun packages/desktop/scripts/finalize-latest-yml.ts
```

结构依据：`download-artifact` 默认（`merge-multiple: false`）把每个 artifact 解到 `update-feed/<artifact名>/`；upload 侧用 `path: .../*.yml` 通配符（hierarchy 从通配符所在段保留），文件落在 artifact 根 → 最终 `update-feed/latest-yml-<triple>/latest-*.yml`，与 finalize 的 `read(dir, subdir, filename)` 约定一致。

**(e) `publish` job 的 needs 增加 `finalize-update-feed`：**

```yaml
publish:
  needs:
    - version
    - build-cli
    - sign-cli-macos
    - build-desktop-macos
    - build-desktop-windows
    - build-desktop-linux
    - finalize-update-feed
```

**(f) 新增 `verify-update-feed` job** —— 插在 `publish` job 结束与 `  sync-downloads:` 之间：

```yaml
verify-update-feed:
  needs:
    - version
    - publish
  if: github.repository == 'ponponon/openctrlc'
  runs-on: ubuntu-24.04
  steps:
    - uses: actions/checkout@f43a0e5ff2bd294095638e18286ca9a3d1956744 # v3.6.0
      with:
        ref: ${{ github.sha }}

    - uses: ./.github/actions/setup-bun

    - name: Verify update feed is publicly reachable
      env:
        GH_REPO: ${{ needs.version.outputs.repo }}
        RELEASE_TAG: ${{ needs.version.outputs.tag }}
      run: bun script/verify-update-feed.ts
```

不配置 `GH_TOKEN`：匿名公网 GET，覆盖真实用户路径；失败时脚本 `exit 1` 使 job 与 workflow 红灯，`$GITHUB_STEP_SUMMARY` 写入明细表。

- [ ] **Step 4: test.yml 挂载契约测试**

`.github/workflows/test.yml` 的 `unit` job 中，在 `Run unit tests` 步骤之后、`Check generated client` 之前插入：

```yaml
- name: Run release contract tests
  if: runner.os == 'Linux'
  working-directory: script
  run: bun test publish-contract.test.ts
```

说明：只挂契约测试不挂 `script/` 全量（`translate-app.test.ts` 存在 2 个与本任务无关的既有失败，挂全量会把 CI 打红）；`working-directory: script` 避开根目录 bunfig 的 `do-not-run-tests-from-root` 守卫。

- [ ] **Step 5: 运行契约测试确认通过**

Run: `cd script && bun test publish-contract.test.ts`
Expected: 6 pass, 0 fail（该文件共 6 个 test）

- [ ] **Step 6: 全量核对 YAML 可解析 + job 拓扑**

Run:

```bash
cd script && bun test
```

Expected: `publish-contract.test.ts` 全 pass；`check-namespace.test.ts` 全 pass（`translate-app.test.ts` 的 2 个失败为既有问题，与本任务无关，不处理）。

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/publish.yml .github/workflows/test.yml script/publish-contract.test.ts
git diff --cached
git commit -m "fix(release): 接线 channel file 上传与冒烟门禁

edit by mimo-v2.6-flash"
```

---

### Task 6: 文档

**Files:**

- Modify: `FEATURE.md`（末尾追加）
- Modify: `FailureExperience.md`（末尾追加）
- Modify: `docs/release.md`（发布前检查清单追加第 7 条）

- [ ] **Step 1: FEATURE.md 末尾追加章节**

```markdown
## 桌面自动更新 feed 发布链路

electron-updater 的三平台自动更新依赖 Release 上的 channel file（`latest.yml`/`latest-mac.yml`/`latest-linux.yml`/`latest-linux-arm64.yml`）。electron-builder 在 `--publish never` 下仍会在 `dist/` 生成这些文件但不上传，发布链路因此拆成三段：各 build job 内 `rewrite-update-feed.ts` 按 sha512 把 yml 的 `url` 对齐到重命名后的安装包实际文件名（Linux CI 会把包改名为 `openctrlc-linux-{arch}.{ext}`），并断言 Linux yml 含 deb/AppImage/rpm 三种条目，sha512 对不上或缺条目直接 fail；`finalize-update-feed` job 汇总各 job 以 target-triple 命名的 workflow artifact（upload 用 `*.yml` 通配符保证文件落 artifact 根，download 按 `<path>/<artifact名>/` 解出，与脚本的 `latest-yml-<triple>/` 约定对齐），合并 Windows 双架构 `latest.yml`、校验 4 个 channel file 齐全后在 draft 阶段 `gh release upload --clobber`；`publish` 公开后 `verify-update-feed` job 用 `verify-update-feed.ts` 匿名公网 GET 4 个 channel file 并逐条校验 `files[].url` 可达（含 content-length 与 yml `size` 比对），写 job summary，任一失败 workflow 红灯。

要点：`app-update.yml` 只在 electron-builder 存在 `publish` 配置时写入，dev 通道没有 `publish` 配置故 dev 包无自动更新；Windows 两个 matrix job 都产出不带 arch 后缀的 `latest.yml`，必须在 finalize job 单点合并否则 `--clobber` 互相覆盖；mac 桌面仅构建 arm64，`latest-mac.yml` 只含 arm64 是正确的；finalize/verify 的 tag 一律取 version job 输出的 `RELEASE_TAG`，脚本不自行推导。`packages/desktop/scripts/prepare.ts` 在 prod 通道缺 `OPENCTRLC_VERSION` 时打印警告（不阻断），避免源码陈旧版本被打进可发布包造成界面版本与 Release 不符。

- 代码：`packages/desktop/scripts/{rewrite-update-feed,finalize-latest-yml}.ts`、`script/verify-update-feed.ts`、`.github/workflows/publish.yml`（`finalize-update-feed`/`verify-update-feed` job）。
- 测试：同名 `*.test.ts`；`script/publish-contract.test.ts` 锁定 job 拓扑与链路断言，由 `.github/workflows/test.yml` 的 `Run release contract tests` 步骤执行。
- 文档：`docs/release.md` 发布前检查第 7 条；教训见 FailureExperience.md「发布链路要同时验证生成了和上传了」。
```

- [ ] **Step 2: FailureExperience.md 末尾追加教训**

```markdown
## 发布链路要同时验证“生成了”和“上传了”

2026-10-12 用户报障 electron-updater 404：`Cannot find latest-linux.yml ... releases/download/v1.1.7/latest-linux.yml`。根因是 `publish.yml` 的 `--publish never` 只关闭 electron-builder 的上传，`dist/latest*.yml` 照常生成却无人上传——发布只搬了安装包，漏了更新器的 feed；唯一会上传 yml 的 `finalize-latest-yml.ts` 在 CI 中被 `OPENCTRLC_SYNC_VERSIONS_ONLY=1` 短路，`LATEST_YML_DIR` 全仓库无人设置，死代码从未执行。Windows/macOS 同样缺失，三平台自动更新全部失效，却因为“更新说明弹窗”（另一条 `changelog.json` 链路）正常而长期无人察觉。

教训：(1) 关闭工具的自动发布（`--publish never`）时，必须盘点它同时跳过了哪些**必要产物**，把缺的那部分接回手工上传链路，不能只看安装包传没传；(2) 发布产物要在公开后从**匿名公网视角**验证（本次起由 `verify-update-feed` job 自动化），job 绿灯不等于用户路径可用；(3) `script/publish-contract.test.ts` 当时既是红的（job 白名单缺 `sync-release-versions`）又没有任何 workflow 执行它——发布契约测试必须接入 CI（现挂在 `test.yml`），否则等于没有契约；(4) 界面版本 v1.18.18 与 feed tag v1.1.7 对不上，是本地打包未注入 `OPENCTRLC_VERSION` 的陈旧版本（现由 `prepare.ts` 警告兜底），排障时不要用界面版本推断 feed 版本。
```

- [ ] **Step 3: docs/release.md 发布前检查追加第 7 条**

在第 6 条（`6. 发布后验证 Release 页面、官网首页、\`/download\`、\`/changelog\` 和 \`/docs/\`。`）之后、`### 远程中继换址验收（Desktop 手工）` 之前插入：

````markdown
7. 确认 `verify-update-feed` job 绿灯：Release 公开后自动匿名校验 4 个
   `latest*.yml` 及其指向的安装包可公网访问。手动核验（`<tag>` 换成实际 tag）：

   ```bash
   for f in latest.yml latest-mac.yml latest-linux.yml latest-linux-arm64.yml; do
     curl -fsI "https://github.com/ponponon/openctrlc/releases/download/<tag>/$f" >/dev/null \
       && echo "$f OK" || echo "$f MISSING"
   done
   ```
````

````

- [ ] **Step 4: Commit**

```bash
git add FEATURE.md FailureExperience.md docs/release.md
git diff --cached
git commit -m "docs(release): 补自动更新 feed 链路文档与教训

edit by mimo-v2.6-flash"
````

---

### Task 7: 全量验证

**Files:** 无新改动（只跑验证；发现问题则修复后回到对应任务）

- [ ] **Step 1: 脚本测试全绿**

Run:

```bash
cd packages/desktop && bun test scripts/
cd ../../script && bun test publish-contract.test.ts verify-update-feed.test.ts
```

Expected: 全部 pass, 0 fail

- [ ] **Step 2: desktop typecheck**

Run: `cd packages/desktop && bun typecheck`
Expected: 0 error（若 `scripts/**` 未纳入 tsconfig，则确认既有 `utils.test.ts` 同样不在范围内后按现状记录，不擅自改 tsconfig 范围）

- [ ] **Step 3: lint**

Run: `cd /home/pon/Desktop/code/me/ai_agent/openctrlc && bun run lint`
Expected: 无新增 error（新文件相关）

- [ ] **Step 4: 本地负例实测 rewrite 断言（利用现存旧 dist）**

Run: `bun packages/desktop/scripts/rewrite-update-feed.ts`
预期（本机 `packages/desktop/dist` 只有 deb、无 AppImage/rpm 的旧产物）：进程以 `missing .appimage entry` 报错退出非 0 —— 证明三扩展名断言真实生效。若本机 `dist/` 不存在则跳过此步。

- [ ] **Step 5: git 状态与敏感内容终检**

Run: `git status --short && git log --oneline -7`
Expected: 工作区干净（或仅剩无关既有改动），7 个任务对应 commit 齐全，无敏感内容。

- [ ] **Step 6: 报告全链路验证留给真实发布**

向用户说明：全链路（finalize 上传 4 文件 → verify 绿灯 → 已装客户端「检查更新」拉到 feed）只能由下一次真实 release（如 v1.1.8）验证，发布不可逆，待用户确认后手动触发 `publish` workflow。

---

## Self-Review 记录

1. **Spec 覆盖**：Scope 全部条目均有对应任务（rewrite=T1、finalize=T2、verify=T3、警告=T4、workflow+契约测试+test.yml=T5、文档=T6、验证与发布策略=T7）；Testing 三组 fixture 测试齐全；Non-goals 未越界（R2/changelog/blockmap/警告阻断化均未触碰）。
2. **占位符扫描**：无 TBD/TODO；所有代码块、命令、期望输出均具体。
3. **类型一致性**：`rewriteFeed(distDir)`/`buildOutputs(dir)`/`collectResults(baseUrl)`/`renderSummary(results, baseUrl)` 在实现、测试、workflow 调用三方一致；`REQUIRED_CHANNEL_FILES`（finalize 输出）与 `CHANNEL_FILES`（verify 拉取）名称在各自模块内自洽；artifact 命名 `latest-yml-<triple>` 在三处 build job、finalize download pattern、契约测试断言中一致。

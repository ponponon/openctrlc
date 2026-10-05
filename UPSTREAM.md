# Upstream

OpenCtrlC is based on OpenCode and keeps the upstream project as a separate
source of updates.

- Repository: https://github.com/anomalyco/opencode
- Branch: `dev`
- Base commit: `7774461bbf7bd0600070cdede4fe8b9d9f301bf4`
- Local exact tag: `base-opencode-7774461`
- Published marker: `openctrlc-baseline-7774461`
- Imported: 2026-08-19
- Reviewed through upstream commit: `907b3bc518fa48e90e8ec24dd327d13eee71c36c`
- Last selective sync: 2026-10-05
- Upstream version at review: `1.18.34`
- OpenCtrlC version at sync: `1.18.18`

## Sync policy

The `upstream` Git remote tracks the OpenCode repository. OpenCtrlC starts with
a clean Git history, so the upstream base commit is recorded as a content
baseline rather than as a parent commit. This fork uses selective content sync:
the review cursor records the newest upstream commit that has been inspected,
while the tables below record which individual fixes were integrated or
deferred. Do not apply the complete base-to-head diff blindly, because it also
contains OpenCode server products and changes that are intentionally outside
OpenCtrlC's scope.

To review the next upstream range:

```bash
git fetch upstream dev
bash scripts/upstream-sync-report.sh
```

For a candidate commit, first run `git diff --check` and `git apply --check`,
then apply only the relevant source/test paths. Adapt `@opencode-ai/*` imports
to `@openctrlc/*`, preserve OpenCtrlC-specific branding and behavior, and
inspect generated-file changes separately. Run tests one package at a time;
some suites start random local servers and are not safe to run concurrently
with each other. After a successful selective sync, update the review cursor,
the integrated/deferred tables, and this document's date in the same commit.

Do not edit generated client files directly; regenerate them from
`packages/client` when the public Protocol or Server `HttpApi` changes.

## Integrated upstream commits

The selective syncs from 2026-09-13 through 2026-10-05 integrated the following
upstream fixes and features while preserving OpenCtrlC's independent product code.
The latest range contains 19 commits: 5 were integrated wholly or in part; the
remaining 14 and the statistics portion of `a79ecfe109` are recorded below.

### Runtime, provider, and session reliability

- `71d08e94d5` retry xAI capacity stream errors.
- `e0b9e68a68` retry raw network finish errors.
- `57fa34f235` continue unknown finish responses.
- `08faeb3893` answer permissions from descendant subagent sessions in `run`.
- `c313504c82`, `35fe5b7212` surface resumable subagent and tool errors.
- `361a71ffad` route Vertex continental multi-regions through REP endpoints.
- `3a4c253969` guard `textVerbosity` for OpenAI-compatible providers.
- `611cc73d84` send the parent session header for every provider.
- `3ef72fe8f6`, `f8b4dd70ac` route non-native Cloudflare AI Gateway models and
  normalize Anthropic model slugs.
- `517ee736b3` filter unreplayable Bedrock reasoning before caching.
- `69c172e8a7` handle SSE reader cancellation rejections.
- `ac1758c0e6` preserve Bedrock DeepSeek model IDs.
- `500c46ec79`, `02a167e048` correctly filter and compare Codex GPT versions.
- `4eb29a64f0`, `b04697366f` add configurable five-minute chunk/header timeout
  defaults.
- `7c2199d84a` map GitLab GPT and Claude reasoning variants.
- `790fb5b86f`, `733562e92a`, `216ba8f05f` add Azure CLI authentication,
  remove its Bun dependency, and keep model discovery quiet.
- `c10134729dd` restrict Bedrock tool-result image retention to Claude, Nova,
  and Llama 4 model families, hoisting unsupported images into user messages.
- `ba341c6c` makes Node package entrypoint resolution return an importable file
  URL, including packages with conditional exports.
- `f5ce4f88` breaks the filesystem search import cycle by importing schema
  constructors directly.
- `3a35b45d` allows GPT-6 Sol and GPT-6 Luna in the Codex provider.
- `82d4c890` redacts credentials from `debug config` output without changing
  the resolved configuration used by providers.
- `610df0b5` adapts Gemini thinking defaults and supported reasoning variants
  across Google, Vertex, OpenRouter, and LLMGateway while preserving legacy
  Gemini behavior and OpenCtrlC's provider-specific transform logic.
- `b471c2b4` reports MCP browser launcher failures even when the launcher exits
  before `open()` returns; the test is adapted to OpenCtrlC's current opener.
- `35fc7a776c` extracts the provider timeout-aware fetch wrapper and applies it
  to Cloudflare AI Gateway REST catalog models, preserving configured custom
  fetches while enforcing header, SSE chunk, and request timeouts. The native
  passthrough timeout path is deferred below because the local gateway SDK
  rejects its Anthropic route before dispatch.
- `e9f8a210b9` adds namespaced session and parent-session identity headers to
  both V1 and V2 provider requests while preserving all existing compatibility
  headers and OpenCtrlC's User-Agent behavior. Tests cover root/child sessions
  on OpenCode-compatible and custom providers, plus V2 compaction requests.
- `a79ecfe109` partially integrates the CLI unknown-model subprocess test's
  serial execution fix. Its statistics site changes remain deferred below.

### Statistics hardening

- `2e018f70f2` adapted to OpenCtrlC's statistics normalization: reject model
  identifiers longer than 256 characters in both in-memory aggregates and R2
  SQL, preventing oversized dimensions from breaking aggregation.
- `0f549842` attributes Hy4 preview traffic to Tencent and retires the stale
  `unknown/hy4-preview` dimensions from model and geo statistics.

### App, UI, ACP, and desktop compatibility

- `b72b50006b` recover legacy database migration history safely.
- `a57230b80b` remove archived sessions from the Home index immediately.
- `a7444bf944` restore focus handling for stacked dialogs.
- `f7da00f35e` omit empty apply-patch move metadata.
- `c0f09afef5` send the GitHub Copilot interaction header.
- `95daf90670` restore ACP durable model/variant/mode state, default effort
  handling, config updates, and reasoning-part boundaries.
- `5cd8e68fdd` add the GPT-6 Astra system prompt.
- `a9a6fad0fa` request summarized adaptive thinking for GitHub Copilot models.
- `f12e14cf16` identify desktop clients during provider OAuth.
- `97a86b7677` uses the native path separator when extracting plugin names
  from file URLs in TUI `/status`, fixing Windows directory handling.
- `9b4882db54` repairs Darwin CLI ad-hoc signatures after Bun compilation and
  before the local smoke test, using OpenCtrlC's binary name.
- `f66b86ceec` adapts Developer ID signing to OpenCtrlC's archive-only release
  artifacts and existing macOS certificate secrets. All three Darwin CLI ZIPs
  are signed, verified, repacked, and smoke-tested on the runner's native
  architecture; final publication requires the signed artifact and overlays
  it after the original CLI artifact. Temporary signing credentials are
  removed even on failure. The independent manual npm path is documented
  separately and does not automatically consume this CI artifact.

## Locally fixed upstream defects

Upstream code that is already wrong in the baseline (or in an integrated
commit) and is repaired only in OpenCtrlC. Selective sync must keep the local
fix; do not restore the upstream line when a later commit touches the same
call site.

- `titlebar.tsx` `onNavigate` `scrollIntoView` (introduced upstream in
  `9431356715` `fix(app): handle tab overflow and scrolling in titlebar`
  (#30886, 2026-06-05, Brendan Allan): the call used
  `scrollIntoView({ behavior: "instant" })` with default `block: "start"`.
  Clicking an offscreen leading tab therefore also scrolled overflow ancestors
  vertically and clipped the v2 titlebar chips (`省流` / lite-network). Fixed
  locally in `b5f3983a` by passing `{ block: "nearest", inline: "nearest" }`
  and setting `overflow-y-hidden` on `[data-slot="titlebar-tabs-scroll"]`.
  Regression: `packages/app/e2e/regression/titlebar-tab-scroll-anchor.spec.ts`.

## Deferred upstream commits

These were reviewed but intentionally left for an isolated follow-up because
they require dependency patches, generated lockfile changes, or broader
OpenCtrlC-specific adaptation:

- `3f39a329c3`, `9a71624d2d`, `68abdce1a0`: Anthropic thinking block binding;
  requires newer patched Anthropic/Bedrock SDKs and careful model-version
  gating.
- `e2ec62d073`: Bedrock provider bump; dependency and lockfile changes should
  be tested separately from behavioral fixes.
- `03afae5b95`: V2 config compatibility in V1; large config boundary change
  that must be reconciled with OpenCtrlC's config extensions.
- `15537a41d2`: config snapshot JSON comparison; small but coupled to the
  deferred V2 config boundary work.
- `199a4cdbea`: Gateway SDK upgrade; the upstream lockfile assumes dependency
  versions and package patches that do not match OpenCtrlC's current lockfile.
- `8bf288ecb1`: Together AI SDK upgrade for stream usage; defer with the
  dependency refresh so the patched AI SDK graph is validated as one unit.
- `a6183af6f3`: Union Alpha hiding; this is OpenCode Zen/Go-specific and has
  no corresponding OpenCtrlC provider surface.
- `45ad8dc38a`, `d870e22c70`: R2 SQL pagination and transient retry changes;
  the local R2 SQL layer predates the upstream pagination interface and needs
  an isolated adaptation with its own tests.
- `29f07e0c`: shared browser opener refactor; broad core/TUI dependency changes
  are not required for the browser failure fix and remain deferred.
- `45719acebb`, `79e8eee5`: GitLab AI provider dependency bumps; defer until
  the lockfile and provider patch graph can be validated together.
- `0f549842`: Hy4 preview statistics attribution was integrated separately;
  the remaining stats comparison-radar work in `6df0d5d9` is deferred.
- `fe3f3a41`: upstream release-version sync; OpenCtrlC keeps an independent
  release/version cadence.
- `35fc7a776c` native Cloudflare AI Gateway passthrough timeout path: with the
  local `ai-gateway-provider@3.2.0`, Anthropic models are rejected as
  `anthropic.messages` unsupported before the custom fetch is called. The
  REST catalog timeout path passes locally; do not enable the binding-based
  native path until the SDK route and a regression test are resolved.
- `1eacc1bdb9`: changelog entry for OpenCode-hosted GPT-6 Luna; the hosted model
  is not an OpenCtrlC provider model.
- `661b7c5548`, `d6963bdf24`, `03e67171ab`, `ddbeaa17c0`, `725e4ba4b8`,
  `482a1cdf0d`, `083ed266e0`, `f416138844`, `b76bbb3692`, `3c893f0a16`,
  `ad6c72c706`, `d1dc00d83d`, `90853b2121`, `8d05153965`, `9f9e73ae0f`:
  OpenCode Go/Go Plus rankings, product pages, docs, translations, and generated
  assets; these product surfaces do not exist in OpenCtrlC.
- `acb6859b06`: usage attribution depends on OpenCode's hosted model catalog and
  deletes stale `unknown` dimensions from its stats database. OpenCtrlC needs a
  separate catalog/source and data-migration design before adapting this.
- `7f964bbb00`: Go ranking tooltip contrast; its CSS patch does not apply cleanly
  to the locally customized stats chart, so defer rather than transplanting
  selectors by guesswork.
- `75e1e7ae31`, `09a3aa0b4c`, `d03d6e28d6`: OpenCode Black subscription,
  Zen privacy, and referral-program product copy; not applicable to this fork.
- `90e65205f6`: upstream `1.18.33` release/version synchronization; OpenCtrlC
  continues to use its own release cadence.
- `2fa3363c92`, `c42ae0d56b`, `907b3bc518`: hosted GPT-6.1 Sol pricing and
  Zen Ling/Fledge model product copy; not OpenCtrlC provider/config changes.
- `82ea3a3a63`: upstream `1.18.34` release/version synchronization; local
  package versions remain `1.18.18` until an OpenCtrlC release is requested.
- `28e13d9fd0`, `62ac31eb7a`, `0112a92c41`: upstream contributor compliance
  grace periods and triage-owner assignments, not this fork's maintenance policy.
- `63cf236140`, `cff9078bb3`: generated upstream Nix dependency hashes; they
  do not describe OpenCtrlC's current dependency graph.
- `8bb2ccf829`, `dc31828006`, `1ddb0873ae`: retirement of the hosted S3 data
  lake, ingestion server, and SST resources. Do not delete OpenCtrlC's
  infrastructure as part of a client fix; adapt it with the deferred R2 work.
- `aa481b8f56`, statistics portion of `a79ecfe109`: canonical URLs, 404/SEO,
  sitemap coverage, and agent-readable data formats for the upstream stats
  site; broad site/catalog changes require independent local adaptation.
- `108b988a08`: hidden-model filtering requires a new SST secret and removes
  retired model dimensions from stored statistics. Defer with the hosted
  catalog attribution and R2 migration rather than silently changing local data.

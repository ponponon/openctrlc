# Upstream

OpenCtrlC is based on OpenCode and keeps the upstream project as a separate
source of updates.

- Repository: https://github.com/anomalyco/opencode
- Branch: `dev`
- Base commit: `7774461bbf7bd0600070cdede4fe8b9d9f301bf4`
- Local exact tag: `base-opencode-7774461`
- Published marker: `openctrlc-baseline-7774461`
- Imported: 2026-08-19
- Reviewed through upstream commit: `c10134729dd2ce00beb18604ec91f10319f59a78`
- Last selective sync: 2026-09-21
- Upstream version at review: `1.18.31`
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

The 2026-09-13 and 2026-09-21 syncs integrated the following upstream fixes and
features while preserving OpenCtrlC's independent product code:

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

### Statistics hardening

- `2e018f70f2` adapted to OpenCtrlC's statistics normalization: reject model
  identifiers longer than 256 characters in both in-memory aggregates and R2
  SQL, preventing oversized dimensions from breaking aggregation.

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

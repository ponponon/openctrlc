# Upstream

OpenCtrlC is based on OpenCode and keeps the upstream project as a separate
source of updates.

- Repository: https://github.com/anomalyco/opencode
- Branch: `dev`
- Base commit: `7774461bbf7bd0600070cdede4fe8b9d9f301bf4`
- Local exact tag: `base-opencode-7774461`
- Published marker: `openctrlc-baseline-7774461`
- Imported: 2026-08-19

## Sync policy

The `upstream` Git remote tracks the OpenCode repository. OpenCtrlC starts with
a clean Git history, so the upstream base commit is recorded as a content
baseline rather than as a parent commit. To sync later, fetch upstream and
apply the upstream delta from the recorded base commit:

```bash
git fetch upstream dev
git diff --binary 7774461bbf7bd0600070cdede4fe8b9d9f301bf4 upstream/dev | git apply --3way
git add -A
git commit -m "chore(sync): sync upstream dev"
```

Resolve conflicts and run the affected package checks after each sync. Do not
edit generated client files directly; regenerate them from `packages/client`
when the public Protocol or Server API changes.

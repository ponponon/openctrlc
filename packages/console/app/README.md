# OpenCtrlC marketing site

This package builds the public OpenCtrlC marketing and download site. It
contains the localized homepage, release/download routes, changelog, support
entrypoints, and the Cloudflare Pages worker used for the public site.

- Public site: <https://openctrlc.pages.dev/>
- Downloads: <https://openctrlc.pages.dev/download/>
- Repository: <https://github.com/ponponon/openctrlc>

## Local development

From the repository root:

```bash
bun install
bun run --cwd packages/console/app dev
```

## Checks and production build

```bash
bun run --cwd packages/console/app typecheck
bun run --cwd packages/console/app build
```

The build generates the route sitemap and the runtime configuration consumed
by the Cloudflare deployment workflow. The documentation site under `/docs/`
is maintained separately in `packages/web`.

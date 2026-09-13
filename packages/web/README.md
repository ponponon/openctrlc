# OpenCtrlC documentation site

This package builds the public OpenCtrlC documentation site. It contains the
multilingual documentation pages, the share viewer, and the Cloudflare Pages
server entrypoint.

- Public site: <https://openctrlc.pages.dev/>
- Documentation: <https://openctrlc.pages.dev/docs/>
- Repository: <https://github.com/ponponon/openctrlc>

## Local development

Install dependencies from the repository root, then start the documentation
site from this package:

```bash
bun install
bun run --cwd packages/web dev
```

The local server is available at <http://localhost:4321/docs/>.

## Production build

The production build uses the `production` stage so that the generated site
uses the public Cloudflare Pages configuration:

```bash
SST_STAGE=production bun run --cwd packages/web build
```

Use `bun run --cwd packages/web preview` to inspect the generated output
locally before deployment.

## Project structure

- `src/content/docs/` — English documentation and localized page content.
- `src/content/i18n/` — Starlight interface translations.
- `src/components/` — shared header, footer, language selector, and share UI.
- `src/pages/` — Astro server routes, including the share viewer.
- `src/styles/` — documentation theme overrides.
- `astro.config.mjs` — locales, sidebar, branding, and Cloudflare adapter setup.

The marketing homepage and download page are maintained in
`packages/console/app`; this package owns the documentation site under
`/docs/`.

## Content guidelines

When changing public documentation:

1. Use OpenCtrlC's current product names and commands.
2. Keep compatibility references clearly separated from user-facing branding.
3. Update the relevant localized page when a translated route exists.
4. Verify both the default and Chinese documentation routes after building.

See the repository [contribution guide](../../CONTRIBUTING.md) for the complete
development and review workflow.

// @ts-check
import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"
import solidJs from "@astrojs/solid-js"
import cloudflare from "@astrojs/cloudflare"
import theme from "toolbeam-docs-theme"
import config from "./config.mjs"
import { rehypeHeadingIds } from "@astrojs/markdown-remark"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import { copyFile } from "node:fs/promises"
import { spawnSync } from "child_process"

// https://astro.build/config
export default defineConfig({
  site: config.url,
  base: "/docs",
  output: "server",
  adapter: cloudflare({
    imageService: "passthrough",
  }),
  devToolbar: {
    enabled: false,
  },
  server: {
    host: "0.0.0.0",
  },
  markdown: {
    rehypePlugins: [rehypeHeadingIds, [rehypeAutolinkHeadings, { behavior: "wrap" }]],
  },
  build: {},
  integrations: [
    configSchema(),
    solidJs(),
    starlight({
      title: "OpenCtrlC",
      defaultLocale: "root",
      locales: {
        root: {
          label: "English",
          lang: "en",
          dir: "ltr",
        },
        ja: {
          label: "日本語",
          lang: "ja-JP",
          dir: "ltr",
        },
        ko: {
          label: "한국어",
          lang: "ko-KR",
          dir: "ltr",
        },
        "zh-cn": {
          label: "简体中文",
          lang: "zh-CN",
          dir: "ltr",
        },
      },
      favicon: "/favicon-v3.svg",
      head: [
        {
          tag: "link",
          attrs: {
            rel: "icon",
            href: "/favicon-v3.ico",
            sizes: "32x32",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "icon",
            type: "image/png",
            href: "/favicon-96x96-v3.png",
            sizes: "96x96",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "apple-touch-icon",
            href: "/apple-touch-icon-v3.png",
            sizes: "180x180",
          },
        },
      ],
      lastUpdated: true,
      expressiveCode: { themes: ["github-light", "github-dark"] },
      social: [{ icon: "github", label: "GitHub", href: config.github }],
      editLink: {
        baseUrl: `${config.github}/edit/dev/packages/web/`,
      },
      markdown: {
        headingLinks: false,
      },
      customCss: ["./src/styles/custom.css"],
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        replacesTitle: true,
      },
      sidebar: [
        "",
        "config",
        "providers",
        "network",
        "troubleshooting",
        {
          label: "Windows",
          translations: {
            en: "Windows",
            "ja-JP": "Windows",
            "ko-KR": "Windows",
            "zh-CN": "Windows",
          },
          link: "windows-wsl",
        },
        {
          label: "Usage",
          translations: {
            en: "Usage",
            "ja-JP": "使い方",
            "ko-KR": "사용",
            "zh-CN": "使用",
          },
          items: ["tui", "cli", "web", "ide", "share", "github", "gitlab"],
        },

        {
          label: "Configure",
          translations: {
            en: "Configure",
            "ja-JP": "設定",
            "ko-KR": "구성",
            "zh-CN": "配置",
          },
          items: [
            "tools",
            "rules",
            "agents",
            "models",
            "themes",
            "keybinds",
            "commands",
            "formatters",
            "permissions",
            "policies",
            "lsp",
            "mcp-servers",
            "acp",
            "skills",
            "references",
            "custom-tools",
          ],
        },

        {
          label: "Develop",
          translations: {
            en: "Develop",
            "ja-JP": "開発",
            "ko-KR": "개발",
            "zh-CN": "开发",
          },
          items: ["sdk", "server", "plugins", "ecosystem"],
        },
      ],
      components: {
        Hero: "./src/components/Hero.astro",
        Head: "./src/components/Head.astro",
        Header: "./src/components/Header.astro",
        Footer: "./src/components/Footer.astro",
        LanguageSelect: "./src/components/LanguageSelect.astro",
        SiteTitle: "./src/components/SiteTitle.astro",
      },
      plugins: [
        theme({
          headerLinks: config.headerLinks,
        }),
      ],
    }),
  ],
})

function configSchema() {
  return {
    name: "configSchema",
    hooks: {
      "astro:build:done": async () => {
        console.log("generating config schema")
        spawnSync("../opencode/script/schema.ts", ["./dist/config.json", "./dist/tui.json"])
        await copyFile("./dist/docs/index.html", "./dist/index.html")
      },
    },
  }
}

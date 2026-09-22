import "./index.css"
import { Title, Meta } from "@solidjs/meta"
import { createAsync } from "@solidjs/router"
import { Header } from "~/component/header"
import { Footer } from "~/component/footer"
import { Legal } from "~/component/legal"
import { changelog } from "~/lib/changelog"
import type { HighlightGroup } from "~/lib/changelog"
import { For, Show } from "solid-js"
import { useI18n } from "~/context/i18n"
import { useLanguage } from "~/context/language"
import { LocaleLinks } from "~/component/locale-links"

function formatDate(dateString: string, locale: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function HighlightSection(props: { group: HighlightGroup }) {
  return (
    <div data-component="highlight">
      <h4>{props.group.source}</h4>
      <hr />
      <For each={props.group.items}>
        {(item) => (
          <div data-slot="highlight-item">
            <p data-slot="title">{item.title}</p>
            <p>{item.description}</p>
            <Show when={item.media.type === "video"}>
              <video src={item.media.src} controls autoplay loop muted playsinline />
            </Show>
            <Show when={item.media.type === "image"}>
              <img
                src={item.media.src}
                alt={item.title}
                width={(item.media as { width: string }).width}
                height={(item.media as { height: string }).height}
              />
            </Show>
          </div>
        )}
      </For>
    </div>
  )
}

export default function Changelog() {
  const i18n = useI18n()
  const language = useLanguage()
  const data = createAsync(() => changelog())
  const releases = () => data() ?? []

  return (
    <main data-page="changelog">
      <Title>{i18n.t("changelog.title")}</Title>
      <LocaleLinks path="/changelog" />
      <Meta name="description" content={i18n.t("changelog.meta.description")} />

      <div data-component="container">
        <Header />

        <div data-component="content">
          <section data-component="changelog-hero">
            <h1>{i18n.t("changelog.hero.title")}</h1>
            <p>{i18n.t("changelog.hero.subtitle")}</p>
          </section>

          <section data-component="releases">
            <Show when={releases().length === 0}>
              <p>
                {i18n.t("changelog.empty")}{" "}
                <a href={language.route("/changelog.json")}>{i18n.t("changelog.viewJson")}</a>
              </p>
            </Show>
            <For each={releases()}>
              {(release) => {
                return (
                  <article data-component="release">
                    <header>
                      <div data-slot="version">
                        <a href={release.url} target="_blank" rel="noopener noreferrer">
                          {release.tag}
                        </a>
                      </div>
                      <time dateTime={release.date}>{formatDate(release.date, language.tag(language.locale()))}</time>
                    </header>
                    <div data-slot="content">
                      <Show when={release.highlights.length > 0}>
                        <div data-component="highlights">
                          <For each={release.highlights}>{(group) => <HighlightSection group={group} />}</For>
                        </div>
                      </Show>
                      <Show when={release.content}>
                        <div data-component="markdown" innerHTML={release.content} />
                      </Show>
                    </div>
                  </article>
                )
              }}
            </For>
          </section>
        </div>

        <Footer />
      </div>

      <Legal />
    </main>
  )
}

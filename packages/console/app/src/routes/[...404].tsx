import "./[...404].css"
import { Title } from "@solidjs/meta"
import { HttpStatusCode } from "@solidjs/start"
import { Logo } from "@openctrlc/ui/logo"
import { useI18n } from "~/context/i18n"
import { useLanguage } from "~/context/language"
import "../component/header.css"

export default function NotFound() {
  const i18n = useI18n()
  const language = useLanguage()
  return (
    <main data-page="not-found">
      <Title>{i18n.t("notFound.title")}</Title>
      <HttpStatusCode code={404} />
      <div data-component="content">
        <section data-component="top">
          <a href={language.route("/")} data-slot="logo-link" aria-label={i18n.t("nav.logoAlt")}>
            <span data-slot="site-logo" aria-hidden="true">
              <Logo class="not-found-logo" />
            </span>
          </a>
          <h1 data-slot="title">{i18n.t("notFound.heading")}</h1>
        </section>

        <section data-component="actions">
          <div data-slot="action">
            <a href={language.route("/")}>{i18n.t("notFound.home")}</a>
          </div>
          <div data-slot="action">
            <a href={language.route("/docs")}>{i18n.t("notFound.docs")}</a>
          </div>
          <div data-slot="action">
            <a href="https://github.com/ponponon/openctrlc">{i18n.t("notFound.github")}</a>
          </div>
        </section>
      </div>
    </main>
  )
}

import { config } from "~/config"
import { useLanguage } from "~/context/language"
import { useI18n } from "~/context/i18n"

export function Footer() {
  const language = useLanguage()
  const i18n = useI18n()

  return (
    <footer data-component="footer">
      <div data-slot="cell">
        <a href={config.github.repoUrl} target="_blank" rel="noreferrer">
          {i18n.t("footer.github")}
        </a>
      </div>
      <div data-slot="cell">
        <a href={language.route("/docs")}>{i18n.t("footer.docs")}</a>
      </div>
      <div data-slot="cell">
        <a href={language.route("/changelog")}>{i18n.t("footer.changelog")}</a>
      </div>
      <div data-slot="cell">
        <a href={language.route("/download")}>{i18n.t("nav.free")}</a>
      </div>
    </footer>
  )
}

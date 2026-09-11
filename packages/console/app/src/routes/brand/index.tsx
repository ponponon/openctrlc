import "./index.css"
import { Meta, Title } from "@solidjs/meta"
import { Footer } from "~/component/footer"
import { Header } from "~/component/header"
import { Legal } from "~/component/legal"
import { LocaleLinks } from "~/component/locale-links"
import { config } from "~/config"
import { useLanguage } from "~/context/language"

export default function Brand() {
  const language = useLanguage()

  return (
    <main data-page="enterprise">
      <Title>OpenCtrlC brand</Title>
      <LocaleLinks path="/brand" />
      <Meta name="description" content="OpenCtrlC project identity and source links." />
      <div data-component="container">
        <Header hideGetStarted />
        <div data-component="content">
          <section data-component="brand-content">
            <h1>OpenCtrlC brand</h1>
            <p>
              OpenCtrlC is an independent open-source project. The canonical project name, source code, and release
              materials live in the repository.
            </p>
            <p>
              <a href={config.github.repoUrl} target="_blank" rel="noreferrer">
                View the project on GitHub
              </a>
            </p>
            <p>
              <a href={language.route("/")}>Return to the homepage</a>
            </p>
          </section>
        </div>
        <Footer />
        <Legal />
      </div>
    </main>
  )
}

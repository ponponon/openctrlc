import "../../brand/index.css"
import "./index.css"
import { Meta, Title } from "@solidjs/meta"
import { Header } from "~/component/header"
import { Footer } from "~/component/footer"
import { Legal } from "~/component/legal"
import { LocaleLinks } from "~/component/locale-links"
import { useLanguage } from "~/context/language"

export default function PrivacyPolicy() {
  const language = useLanguage()

  return (
    <main data-page="legal">
      <Title>OpenCtrlC | Privacy Policy</Title>
      <LocaleLinks path="/legal/privacy-policy" />
      <Meta name="description" content="How OpenCtrlC handles website and software data." />
      <div data-component="container">
        <Header />

        <div data-component="content">
          <section data-component="brand-content">
            <article data-component="privacy-policy">
              <h1>Privacy Policy</h1>
              <p class="effective-date">Effective date: September 10, 2026</p>

              <p>
                OpenCtrlC is open-source software. The desktop and terminal applications run on your machine and do not
                send your source code to OpenCtrlC by default. This page explains the limited data involved when you
                visit this website or use optional features.
              </p>

              <h2 id="website">This website</h2>
              <p>
                The website is hosted on Cloudflare Pages. Cloudflare may process standard connection information such
                as an IP address, browser details, and request timestamps to deliver and protect the site. OpenCtrlC
                does not operate an account system, advertising tracker, or hosted inference service on this website.
              </p>

              <h2 id="application">The application</h2>
              <p>
                OpenCtrlC stores local configuration, sessions, and project data on your device according to the files
                and settings in your checkout. Requests to language-model providers are sent directly through the
                provider configuration you choose. Those providers have their own privacy policies and retention rules.
              </p>

              <h2 id="sharing">Optional sharing</h2>
              <p>
                If you explicitly use the share feature, the selected conversation is sent to the share service
                configured for your deployment. Do not share secrets or private source code unless you have reviewed
                that service's terms and retention policy. You can disable sharing in your OpenCtrlC configuration.
              </p>

              <h2 id="third-party">Third-party services</h2>
              <p>
                Downloads, source code, package distribution, model providers, and issue discussions may be handled by
                third-party services such as GitHub, npm, or your selected model provider. Their terms apply to the data
                you submit to them.
              </p>

              <h2 id="contact">Questions</h2>
              <p>
                For privacy questions or corrections, open a discussion in the{" "}
                <a href="https://github.com/ponponon/openctrlc/discussions" target="_blank" rel="noreferrer">
                  OpenCtrlC GitHub repository
                </a>
                . We may update this page when the website or optional services change.
              </p>

              <p>
                See also our <a href={language.route("/legal/terms-of-service")}>Terms of Use</a> and the repository
                license for the software itself.
              </p>
            </article>
          </section>
        </div>

        <Footer />
      </div>
      <Legal />
    </main>
  )
}

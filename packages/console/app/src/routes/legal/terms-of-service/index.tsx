import "../../brand/index.css"
import "./index.css"
import { Meta, Title } from "@solidjs/meta"
import { Header } from "~/component/header"
import { Footer } from "~/component/footer"
import { Legal } from "~/component/legal"
import { LocaleLinks } from "~/component/locale-links"

export default function TermsOfService() {
  return (
    <main data-page="legal">
      <Title>OpenCtrlC | Terms of Use</Title>
      <LocaleLinks path="/legal/terms-of-service" />
      <Meta name="description" content="Terms for using the OpenCtrlC website and open-source software." />
      <div data-component="container">
        <Header />

        <div data-component="content">
          <section data-component="brand-content">
            <article data-component="terms-of-service">
              <h1>Terms of Use</h1>
              <p class="effective-date">Effective date: September 10, 2026</p>

              <p>
                OpenCtrlC is an independently maintained open-source project. By using this website or downloading the
                software, you agree to use it lawfully and to follow the license and notices included in the repository
                and in each release.
              </p>

              <h2 id="software">Open-source software</h2>
              <p>
                The application is provided under the license published in the OpenCtrlC repository. The repository
                license controls copying, modification, and redistribution of the software. These website terms do not
                replace that license.
              </p>

              <h2 id="providers">Models and providers</h2>
              <p>
                OpenCtrlC is a client and does not provide a model subscription, hosted inference, or guaranteed access
                to any third-party provider. You are responsible for the providers, API keys, models, prompts, and data
                you configure, as well as their applicable terms and costs.
              </p>

              <h2 id="sharing">Optional services</h2>
              <p>
                Some integrations, including optional conversation sharing, may send data to a service you configure.
                Review the destination before enabling an integration and do not upload information you are not permitted
                to share.
              </p>

              <h2 id="availability">Availability and warranty</h2>
              <p>
                The website and software are provided on an “as is” and “as available” basis. The project is not a
                managed service and does not promise uninterrupted operation, compatibility with every provider, or that
                the software will be free of defects. You remain responsible for backups, review of generated changes,
                and the security of your environment.
              </p>

              <h2 id="changes">Changes</h2>
              <p>
                The project may change as it is developed. Material changes to these website terms will be reflected on
                this page. Release-specific behavior is described in the corresponding GitHub release and documentation.
              </p>

              <h2 id="contact">Contact</h2>
              <p>
                Questions and project discussions belong in the{" "}
                <a href="https://github.com/ponponon/openctrlc/discussions" target="_blank" rel="noreferrer">
                  OpenCtrlC GitHub Discussions
                </a>
                .
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

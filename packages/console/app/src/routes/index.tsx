import "./index.css"
import { Meta, Title } from "@solidjs/meta"
import { A } from "@solidjs/router"
import { createSignal, For } from "solid-js"
import { Footer } from "~/component/footer"
import { Header } from "~/component/header"
import { Legal } from "~/component/legal"
import { LocaleLinks } from "~/component/locale-links"
import { useLanguage } from "~/context/language"

type Feature = {
  label: string
  title: string
  body: string
}

type Copy = {
  title: string
  description: string
  announcement: string
  announcementLink: string
  heroEyebrow: string
  heroTitle: string
  heroBody: string
  primaryCta: string
  secondaryCta: string
  installLabel: string
  installHint: string
  workflowTitle: string
  workflowBody: string
  workflows: Feature[]
  featuresTitle: string
  featuresBody: string
  features: Feature[]
  docsCta: string
  downloadCta: string
  faqTitle: string
  faq: Array<{ question: string; answer: string }>
  finalTitle: string
  finalBody: string
  finalCta: string
}

const COPY: Record<string, Copy> = {
  en: {
    title: "OpenCtrlC — an open source AI coding agent",
    description:
      "OpenCtrlC is an open source AI coding agent for terminal and desktop workflows. Bring your own model provider and keep your project context close.",
    announcement: "Open source, local-first, and available on three desktop platforms.",
    announcementLink: "See downloads",
    heroEyebrow: "An AI coding agent for people who own their workflow",
    heroTitle: "Build with an agent that stays close to your code.",
    heroBody:
      "OpenCtrlC helps you understand a codebase, make changes, run commands, and review the result from one focused workflow. Use the terminal or the desktop app, with the provider you choose.",
    primaryCta: "Download OpenCtrlC",
    secondaryCta: "Read the docs",
    installLabel: "Start in your terminal",
    installHint: "The install script detects your operating system and architecture.",
    workflowTitle: "One project context. Two ways to work.",
    workflowBody:
      "Move between a fast terminal loop and a calm desktop workspace without losing the session context that matters.",
    workflows: [
      {
        label: "01 / Terminal",
        title: "Fast when the keyboard is all you need.",
        body: "Ask questions, plan work, edit files, and run commands from a native TUI that stays out of your way.",
      },
      {
        label: "02 / Desktop",
        title: "A clearer view of the whole session.",
        body: "Use a dedicated desktop window for project navigation, session history, exports, and long-running work.",
      },
      {
        label: "03 / Project",
        title: "Keep the important context inspectable.",
        body: "OpenCtrlC works with your local project files and lets you inspect the context, tools, and output behind each step.",
      },
    ],
    featuresTitle: "The useful parts are visible.",
    featuresBody:
      "OpenCtrlC is built around the moments that make an agent dependable: knowing what it sees, keeping history intact, and making the result easy to take away.",
    features: [
      {
        label: "Context",
        title: "Understand before you change.",
        body: "Inspect the effective system prompt, skills, and context usage when you need to know why an agent is behaving a certain way.",
      },
      {
        label: "Sessions",
        title: "Return to work without starting over.",
        body: "Navigate session history, search through turns, collapse completed activity, and keep the conversation readable.",
      },
      {
        label: "Output",
        title: "Take the result with you.",
        body: "Export a clean Markdown summary, a complete transcript, or structured JSON for your own tools and records.",
      },
      {
        label: "Platforms",
        title: "Use the machine you already have.",
        body: "The release pipeline publishes CLI and Desktop packages for macOS, Windows, and Linux, including x64 and arm64 builds where supported.",
      },
    ],
    docsCta: "Explore the documentation",
    downloadCta: "View all downloads",
    faqTitle: "A few clear answers.",
    faq: [
      {
        question: "What is OpenCtrlC?",
        answer:
          "OpenCtrlC is an independent open-source AI coding agent. It provides terminal and desktop workflows for exploring projects, editing files, running commands, and reviewing changes.",
      },
      {
        question: "Do I need an OpenCtrlC account or subscription?",
        answer:
          "No. OpenCtrlC does not require an OpenCtrlC-hosted model subscription. Configure the model provider and credentials that fit your workflow.",
      },
      {
        question: "Where does my code go?",
        answer:
          "OpenCtrlC runs against your local project and sends requests to the provider you configure. Check the provider's own data policy, and use the optional sharing features only when you intend to share a session.",
      },
      {
        question: "Which systems are supported?",
        answer:
          "CLI packages are published for macOS, Windows, and Linux. Desktop installers are published for macOS, Windows, and Linux with x64 and arm64 targets in the release workflow.",
      },
    ],
    finalTitle: "Make your next codebase easier to work with.",
    finalBody: "OpenCtrlC is open source, inspectable, and ready for the workflow you already use.",
    finalCta: "Get started",
  },
  zh: {
    title: "OpenCtrlC —— 开源 AI 编程代理",
    description: "OpenCtrlC 是面向终端和桌面工作流的开源 AI 编程代理，让项目上下文留在你能看见、能掌控的地方。",
    announcement: "开源、本地优先，并为三大桌面平台提供安装包。",
    announcementLink: "查看下载",
    heroEyebrow: "为真正掌控工作流的人打造的 AI 编程代理",
    heroTitle: "让 AI 代理，始终贴近你的代码。",
    heroBody:
      "OpenCtrlC 帮你理解代码库、修改文件、运行命令并检查结果。你可以在终端或桌面端使用它，并连接自己选择的模型服务商。",
    primaryCta: "下载 OpenCtrlC",
    secondaryCta: "阅读文档",
    installLabel: "从终端开始",
    installHint: "安装脚本会自动识别你的操作系统和 CPU 架构。",
    workflowTitle: "同一份项目上下文，两种工作方式。",
    workflowBody: "在高效的终端循环和清晰的桌面工作区之间切换，不丢失真正重要的会话上下文。",
    workflows: [
      {
        label: "01 / 终端",
        title: "只需要键盘时，保持高效。",
        body: "在原生 TUI 中提问、规划、编辑文件和运行命令，不让界面打断你的思路。",
      },
      {
        label: "02 / 桌面",
        title: "完整看清一次会话。",
        body: "使用独立桌面窗口浏览项目、管理会话历史、导出结果，并处理较长时间运行的任务。",
      },
      {
        label: "03 / 项目",
        title: "把关键上下文保持可检查。",
        body: "OpenCtrlC 直接围绕本地项目文件工作，你可以检查每一步实际看到的上下文、工具和输出。",
      },
    ],
    featuresTitle: "有用的部分，都应该看得见。",
    featuresBody: "OpenCtrlC 关注让代理变得可靠的细节：知道它看到了什么、保留完整历史、让结果方便带走。",
    features: [
      {
        label: "上下文",
        title: "先理解，再修改。",
        body: "需要知道代理为什么这样工作时，可以检查生效的系统提示词、Skills 和上下文占用。",
      },
      {
        label: "会话",
        title: "回来时不用从头开始。",
        body: "浏览会话历史、搜索对话、折叠已经完成的活动，让长会话依然清晰。",
      },
      {
        label: "输出",
        title: "把结果真正带走。",
        body: "可以导出简洁的 Markdown 总结、完整执行记录或结构化 JSON，接入自己的工具和记录流程。",
      },
      {
        label: "平台",
        title: "使用你手头的设备。",
        body: "发布流程覆盖 macOS、Windows 和 Linux，并为支持的平台提供 x64 与 arm64 构建。",
      },
    ],
    docsCta: "浏览完整文档",
    downloadCta: "查看全部下载",
    faqTitle: "几个直接的答案。",
    faq: [
      {
        question: "OpenCtrlC 是什么？",
        answer: "OpenCtrlC 是独立维护的开源 AI 编程代理，提供终端和桌面工作流，用于探索项目、修改文件、运行命令和检查变更。",
      },
      {
        question: "需要购买 OpenCtrlC 账号或订阅吗？",
        answer: "不需要。OpenCtrlC 不要求使用由 OpenCtrlC 托管的模型订阅，你可以配置适合自己工作流的模型服务商和凭据。",
      },
      {
        question: "我的代码会发送到哪里？",
        answer: "OpenCtrlC 围绕本地项目运行，并把请求发送给你配置的服务商。请同时查看服务商的数据政策；只有在你明确需要时才使用可选的会话分享功能。",
      },
      {
        question: "支持哪些系统？",
        answer: "CLI 支持 macOS、Windows 和 Linux。桌面版发布流程覆盖 macOS、Windows 和 Linux，并提供 x64 与 arm64 目标。",
      },
    ],
    finalTitle: "让下一个代码库，更容易开始工作。",
    finalBody: "OpenCtrlC 开源、可检查，也能贴合你已经习惯的开发方式。",
    finalCta: "开始使用",
  },
  zht: {
    title: "OpenCtrlC —— 開源 AI 編程代理",
    description: "OpenCtrlC 是面向終端與桌面工作流的開源 AI 編程代理，讓專案上下文留在你能看見、能掌控的地方。",
    announcement: "開源、本地優先，並為三大桌面平台提供安裝包。",
    announcementLink: "查看下載",
    heroEyebrow: "為真正掌控工作流的人打造的 AI 編程代理",
    heroTitle: "讓 AI 代理，始終貼近你的程式碼。",
    heroBody:
      "OpenCtrlC 幫你理解程式碼庫、修改檔案、執行命令並檢查結果。你可以在終端或桌面端使用它，並連接自己選擇的模型服務商。",
    primaryCta: "下載 OpenCtrlC",
    secondaryCta: "閱讀文件",
    installLabel: "從終端開始",
    installHint: "安裝腳本會自動識別你的作業系統和 CPU 架構。",
    workflowTitle: "同一份專案上下文，兩種工作方式。",
    workflowBody: "在高效的終端循環和清晰的桌面工作區之間切換，不丟失真正重要的會話上下文。",
    workflows: [
      { label: "01 / 終端", title: "只需要鍵盤時，保持高效。", body: "在原生 TUI 中提問、規劃、編輯檔案和執行命令，不讓介面打斷你的思路。" },
      { label: "02 / 桌面", title: "完整看清一次會話。", body: "使用獨立桌面視窗瀏覽專案、管理會話歷史、匯出結果，並處理較長時間運行的任務。" },
      { label: "03 / 專案", title: "把關鍵上下文保持可檢查。", body: "OpenCtrlC 直接圍繞本地專案檔案工作，你可以檢查每一步實際看到的上下文、工具和輸出。" },
    ],
    featuresTitle: "有用的部分，都應該看得見。",
    featuresBody: "OpenCtrlC 關注讓代理變得可靠的細節：知道它看到了什麼、保留完整歷史、讓結果方便帶走。",
    features: [
      { label: "上下文", title: "先理解，再修改。", body: "需要知道代理為什麼這樣工作時，可以檢查生效的系統提示詞、Skills 和上下文佔用。" },
      { label: "會話", title: "回來時不用從頭開始。", body: "瀏覽會話歷史、搜尋對話、折疊已經完成的活動，讓長會話依然清晰。" },
      { label: "輸出", title: "把結果真正帶走。", body: "可以匯出簡潔的 Markdown 總結、完整執行記錄或結構化 JSON，接入自己的工具和記錄流程。" },
      { label: "平台", title: "使用你手頭的裝置。", body: "發布流程覆蓋 macOS、Windows 和 Linux，並為支援的平台提供 x64 與 arm64 建置。" },
    ],
    docsCta: "瀏覽完整文件",
    downloadCta: "查看全部下載",
    faqTitle: "幾個直接的答案。",
    faq: [
      { question: "OpenCtrlC 是什麼？", answer: "OpenCtrlC 是獨立維護的開源 AI 編程代理，提供終端和桌面工作流，用於探索專案、修改檔案、執行命令和檢查變更。" },
      { question: "需要購買 OpenCtrlC 帳號或訂閱嗎？", answer: "不需要。OpenCtrlC 不要求使用由 OpenCtrlC 託管的模型訂閱，你可以配置適合自己工作流的模型服務商和憑據。" },
      { question: "我的程式碼會發送到哪裡？", answer: "OpenCtrlC 圍繞本地專案運行，並把請求發送給你配置的服務商。請同時查看服務商的資料政策；只有在你明確需要時才使用可選的會話分享功能。" },
      { question: "支援哪些系統？", answer: "CLI 支援 macOS、Windows 和 Linux。桌面版發布流程覆蓋 macOS、Windows 和 Linux，並提供 x64 與 arm64 目標。" },
    ],
    finalTitle: "讓下一個程式碼庫，更容易開始工作。",
    finalBody: "OpenCtrlC 開源、可檢查，也能貼合你已經習慣的開發方式。",
    finalCta: "開始使用",
  },
}

function CopyButton(props: { value: string }) {
  const [copied, setCopied] = createSignal(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button type="button" data-component="copy-button" data-copied={copied()} onClick={copy} aria-label="Copy command">
      <span>{copied() ? "Copied" : "Copy"}</span>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M5.5 5.5V3.75C5.5 3.06 6.06 2.5 6.75 2.5H12.25C12.94 2.5 13.5 3.06 13.5 3.75V9.25C13.5 9.94 12.94 10.5 12.25 10.5H10.5" stroke="currentColor" stroke-width="1.25" />
        <rect x="2.5" y="5.5" width="8" height="8" rx="1.25" stroke="currentColor" stroke-width="1.25" />
      </svg>
    </button>
  )
}

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3.75 9H14.25M10.25 4.75L14.5 9L10.25 13.25" stroke="currentColor" stroke-width="1.25" />
    </svg>
  )
}

export default function Home() {
  const language = useLanguage()
  const copy = () => COPY[language.locale()] ?? COPY.en
  const installCommand = "curl -fsSL https://raw.githubusercontent.com/ponponon/openctrlc/dev/install | bash"

  return (
    <main data-page="openctrlc">
      <Title>{copy().title}</Title>
      <LocaleLinks path="/" />
      <Meta name="description" content={copy().description} />
      <Meta property="og:title" content={copy().title} />
      <Meta property="og:description" content={copy().description} />
      <Meta property="og:image" content="/social-share.svg" />
      <div data-component="container">
        <Header />

        <div data-component="content">
          <div data-component="announcement">
            <span data-slot="dot"></span>
            <span>{copy().announcement}</span>
            <A href={language.route("/download")} data-slot="link">
              {copy().announcementLink} <Arrow />
            </A>
          </div>

          <section data-component="hero">
            <div data-slot="hero-copy">
              <p data-slot="eyebrow">{copy().heroEyebrow}</p>
              <h1>{copy().heroTitle}</h1>
              <p data-slot="hero-body">{copy().heroBody}</p>
              <div data-slot="hero-actions">
                <A href={language.route("/download")} data-slot="primary-button">
                  {copy().primaryCta} <Arrow />
                </A>
                <A href={language.route("/docs")} data-slot="secondary-button">
                  {copy().secondaryCta}
                </A>
              </div>
              <div data-slot="platform-note">
                <span>macOS</span>
                <span>Windows</span>
                <span>Linux</span>
                <span>·</span>
                <span>MIT licensed</span>
              </div>
            </div>

            <div data-slot="hero-art" aria-label="OpenCtrlC terminal preview">
              <div data-component="terminal-window">
                <div data-slot="window-bar">
                  <span data-slot="window-dots"><i></i><i></i><i></i></span>
                  <span>openctrlc · ~/project</span>
                  <span data-slot="window-status">● connected</span>
                </div>
                <div data-slot="terminal-body">
                  <p><span data-slot="muted">›</span> <span data-slot="accent">openctrlc</span></p>
                  <p data-slot="muted">Ready to work in your project.</p>
                  <p class="terminal-gap"><span data-slot="prompt">you</span> Find the safest place to add this feature.</p>
                  <p data-slot="muted">I’ll inspect the project structure and trace the existing pattern first.</p>
                  <div data-slot="terminal-progress"><span></span><span></span><span></span></div>
                  <p class="terminal-gap"><span data-slot="prompt">openctrlc</span> 4 files inspected · context ready</p>
                  <p data-slot="cursor"><span>▌</span></p>
                </div>
              </div>
              <div data-slot="hero-art-caption">A focused loop from question to change.</div>
            </div>
          </section>

          <section data-component="install-card">
            <div data-slot="section-kicker">{copy().installLabel}</div>
            <div data-slot="install-copy">
              <h2>Install once. Keep your workflow.</h2>
              <p>{copy().installHint}</p>
            </div>
            <div data-component="command">
              <code>{installCommand}</code>
              <CopyButton value={installCommand} />
            </div>
          </section>

          <section data-component="workflow" id="workflow">
            <div data-slot="section-heading">
              <p data-slot="eyebrow">How it fits</p>
              <h2>{copy().workflowTitle}</h2>
              <p>{copy().workflowBody}</p>
            </div>
            <div data-slot="workflow-grid">
              <For each={copy().workflows}>
                {(item, index) => (
                  <article data-component="workflow-card">
                    <span data-slot="card-index">{item.label}</span>
                    <span data-slot="number">0{index() + 1}</span>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </article>
                )}
              </For>
            </div>
          </section>

          <section data-component="features" id="features">
            <div data-slot="section-heading">
              <p data-slot="eyebrow">Built for trust</p>
              <h2>{copy().featuresTitle}</h2>
              <p>{copy().featuresBody}</p>
            </div>
            <div data-slot="feature-grid">
              <For each={copy().features}>
                {(item) => (
                  <article data-component="feature-card">
                    <span data-slot="feature-label">{item.label}</span>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </article>
                )}
              </For>
            </div>
            <div data-slot="section-actions">
              <A href={language.route("/docs")} data-slot="text-link">
                {copy().docsCta} <Arrow />
              </A>
              <A href={language.route("/download")} data-slot="text-link">
                {copy().downloadCta} <Arrow />
              </A>
            </div>
          </section>

          <section data-component="faq" id="faq">
            <div data-slot="section-heading">
              <p data-slot="eyebrow">FAQ</p>
              <h2>{copy().faqTitle}</h2>
            </div>
            <div data-slot="faq-list">
              <For each={copy().faq}>
                {(item) => (
                  <details>
                    <summary>
                      <span>{item.question}</span>
                      <span data-slot="plus">+</span>
                    </summary>
                    <p>{item.answer}</p>
                  </details>
                )}
              </For>
            </div>
          </section>

          <section data-component="final-cta">
            <p data-slot="eyebrow">OpenCtrlC</p>
            <h2>{copy().finalTitle}</h2>
            <p>{copy().finalBody}</p>
            <A href={language.route("/download")} data-slot="primary-button">
              {copy().finalCta} <Arrow />
            </A>
          </section>
        </div>

        <Footer />
        <Legal />
      </div>
    </main>
  )
}

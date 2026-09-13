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
  platformNote: string
  heroArtLabel: string
  terminalStatus: string
  terminalUserLabel: string
  terminalReady: string
  terminalPrompt: string
  terminalResponse: string
  terminalProgress: string
  heroArtCaption: string
  primaryCta: string
  secondaryCta: string
  installLabel: string
  installHint: string
  installTitle: string
  workflowTitle: string
  workflowBody: string
  workflowEyebrow: string
  workflows: Feature[]
  featuresTitle: string
  featuresBody: string
  featuresEyebrow: string
  features: Feature[]
  docsCta: string
  downloadCta: string
  faqTitle: string
  faqEyebrow: string
  faq: Array<{ question: string; answer: string }>
  finalTitle: string
  finalBody: string
  finalEyebrow: string
  finalCta: string
  copyLabel: string
  copiedLabel: string
  copyCommandLabel: string
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
    platformNote: "MIT licensed",
    heroArtLabel: "OpenCtrlC terminal preview",
    terminalStatus: "● connected",
    terminalUserLabel: "you",
    terminalReady: "Ready to work in your project.",
    terminalPrompt: "Find the safest place to add this feature.",
    terminalResponse: "I’ll inspect the project structure and trace the existing pattern first.",
    terminalProgress: "4 files inspected · context ready",
    heroArtCaption: "A focused loop from question to change.",
    primaryCta: "Download OpenCtrlC",
    secondaryCta: "Read the docs",
    installLabel: "Start in your terminal",
    installHint: "The install script detects your operating system and architecture.",
    installTitle: "Install once. Keep your workflow.",
    workflowTitle: "One project context. Two ways to work.",
    workflowBody:
      "Move between a fast terminal loop and a calm desktop workspace without losing the session context that matters.",
    workflowEyebrow: "How it fits",
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
    featuresEyebrow: "Built for trust",
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
    faqEyebrow: "FAQ",
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
    finalEyebrow: "OpenCtrlC",
    finalCta: "Get started",
    copyLabel: "Copy",
    copiedLabel: "Copied",
    copyCommandLabel: "Copy command",
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
    platformNote: "MIT 许可",
    heroArtLabel: "OpenCtrlC 终端预览",
    terminalStatus: "● 已连接",
    terminalUserLabel: "你",
    terminalReady: "已准备好在你的项目中工作。",
    terminalPrompt: "找出最适合安全添加这个功能的位置。",
    terminalResponse: "我会先检查项目结构，并追踪现有的实现模式。",
    terminalProgress: "已检查 4 个文件 · 上下文就绪",
    heroArtCaption: "从提问到修改，保持专注的工作循环。",
    primaryCta: "下载 OpenCtrlC",
    secondaryCta: "阅读文档",
    installLabel: "从终端开始",
    installHint: "安装脚本会自动识别你的操作系统和 CPU 架构。",
    installTitle: "安装一次，保留你的工作方式。",
    workflowTitle: "同一份项目上下文，两种工作方式。",
    workflowBody: "在高效的终端循环和清晰的桌面工作区之间切换，不丢失真正重要的会话上下文。",
    workflowEyebrow: "它如何融入工作流",
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
    featuresEyebrow: "为可靠性而设计",
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
    faqEyebrow: "常见问题",
    faq: [
      {
        question: "OpenCtrlC 是什么？",
        answer:
          "OpenCtrlC 是独立维护的开源 AI 编程代理，提供终端和桌面工作流，用于探索项目、修改文件、运行命令和检查变更。",
      },
      {
        question: "需要购买 OpenCtrlC 账号或订阅吗？",
        answer: "不需要。OpenCtrlC 不要求使用由 OpenCtrlC 托管的模型订阅，你可以配置适合自己工作流的模型服务商和凭据。",
      },
      {
        question: "我的代码会发送到哪里？",
        answer:
          "OpenCtrlC 围绕本地项目运行，并把请求发送给你配置的服务商。请同时查看服务商的数据政策；只有在你明确需要时才使用可选的会话分享功能。",
      },
      {
        question: "支持哪些系统？",
        answer:
          "CLI 支持 macOS、Windows 和 Linux。桌面版发布流程覆盖 macOS、Windows 和 Linux，并提供 x64 与 arm64 目标。",
      },
    ],
    finalTitle: "让下一个代码库，更容易开始工作。",
    finalBody: "OpenCtrlC 开源、可检查，也能贴合你已经习惯的开发方式。",
    finalEyebrow: "OpenCtrlC",
    finalCta: "开始使用",
    copyLabel: "复制",
    copiedLabel: "已复制",
    copyCommandLabel: "复制命令",
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
    platformNote: "MIT 授權",
    heroArtLabel: "OpenCtrlC 終端預覽",
    terminalStatus: "● 已連接",
    terminalUserLabel: "你",
    terminalReady: "已準備好在你的專案中工作。",
    terminalPrompt: "找出最適合安全加入這項功能的位置。",
    terminalResponse: "我會先檢查專案結構，並追蹤現有的實作模式。",
    terminalProgress: "已檢查 4 個檔案 · 上下文就緒",
    heroArtCaption: "從提問到修改，保持專注的工作循環。",
    primaryCta: "下載 OpenCtrlC",
    secondaryCta: "閱讀文件",
    installLabel: "從終端開始",
    installHint: "安裝腳本會自動識別你的作業系統和 CPU 架構。",
    installTitle: "安裝一次，保留你的工作方式。",
    workflowTitle: "同一份專案上下文，兩種工作方式。",
    workflowBody: "在高效的終端循環和清晰的桌面工作區之間切換，不丟失真正重要的會話上下文。",
    workflowEyebrow: "它如何融入工作流",
    workflows: [
      {
        label: "01 / 終端",
        title: "只需要鍵盤時，保持高效。",
        body: "在原生 TUI 中提問、規劃、編輯檔案和執行命令，不讓介面打斷你的思路。",
      },
      {
        label: "02 / 桌面",
        title: "完整看清一次會話。",
        body: "使用獨立桌面視窗瀏覽專案、管理會話歷史、匯出結果，並處理較長時間運行的任務。",
      },
      {
        label: "03 / 專案",
        title: "把關鍵上下文保持可檢查。",
        body: "OpenCtrlC 直接圍繞本地專案檔案工作，你可以檢查每一步實際看到的上下文、工具和輸出。",
      },
    ],
    featuresTitle: "有用的部分，都應該看得見。",
    featuresBody: "OpenCtrlC 關注讓代理變得可靠的細節：知道它看到了什麼、保留完整歷史、讓結果方便帶走。",
    featuresEyebrow: "為可靠性而設計",
    features: [
      {
        label: "上下文",
        title: "先理解，再修改。",
        body: "需要知道代理為什麼這樣工作時，可以檢查生效的系統提示詞、Skills 和上下文佔用。",
      },
      {
        label: "會話",
        title: "回來時不用從頭開始。",
        body: "瀏覽會話歷史、搜尋對話、折疊已經完成的活動，讓長會話依然清晰。",
      },
      {
        label: "輸出",
        title: "把結果真正帶走。",
        body: "可以匯出簡潔的 Markdown 總結、完整執行記錄或結構化 JSON，接入自己的工具和記錄流程。",
      },
      {
        label: "平台",
        title: "使用你手頭的裝置。",
        body: "發布流程覆蓋 macOS、Windows 和 Linux，並為支援的平台提供 x64 與 arm64 建置。",
      },
    ],
    docsCta: "瀏覽完整文件",
    downloadCta: "查看全部下載",
    faqTitle: "幾個直接的答案。",
    faqEyebrow: "常見問題",
    faq: [
      {
        question: "OpenCtrlC 是什麼？",
        answer:
          "OpenCtrlC 是獨立維護的開源 AI 編程代理，提供終端和桌面工作流，用於探索專案、修改檔案、執行命令和檢查變更。",
      },
      {
        question: "需要購買 OpenCtrlC 帳號或訂閱嗎？",
        answer: "不需要。OpenCtrlC 不要求使用由 OpenCtrlC 託管的模型訂閱，你可以配置適合自己工作流的模型服務商和憑據。",
      },
      {
        question: "我的程式碼會發送到哪裡？",
        answer:
          "OpenCtrlC 圍繞本地專案運行，並把請求發送給你配置的服務商。請同時查看服務商的資料政策；只有在你明確需要時才使用可選的會話分享功能。",
      },
      {
        question: "支援哪些系統？",
        answer:
          "CLI 支援 macOS、Windows 和 Linux。桌面版發布流程覆蓋 macOS、Windows 和 Linux，並提供 x64 與 arm64 目標。",
      },
    ],
    finalTitle: "讓下一個程式碼庫，更容易開始工作。",
    finalBody: "OpenCtrlC 開源、可檢查，也能貼合你已經習慣的開發方式。",
    finalEyebrow: "OpenCtrlC",
    finalCta: "開始使用",
    copyLabel: "複製",
    copiedLabel: "已複製",
    copyCommandLabel: "複製命令",
  },
}

const LOCALIZED_COPY: Record<string, Partial<Copy>> = {
  de: {
    title: "OpenCtrlC — ein Open-Source-KI-Coding-Agent",
    description:
      "OpenCtrlC ist ein Open-Source-KI-Coding-Agent für Terminal- und Desktop-Workflows. Wähle deinen Modellanbieter und behalte den Projektkontext bei dir.",
    announcement: "Open Source, lokal ausgerichtet und für drei Desktop-Plattformen verfügbar.",
    announcementLink: "Downloads ansehen",
    heroEyebrow: "Ein KI-Coding-Agent für Menschen, die ihren Workflow selbst bestimmen",
    heroTitle: "Arbeite mit einem Agenten, der nah an deinem Code bleibt.",
    heroBody:
      "OpenCtrlC hilft dir, eine Codebasis zu verstehen, Änderungen vorzunehmen, Befehle auszuführen und Ergebnisse in einem fokussierten Workflow zu prüfen. Nutze Terminal oder Desktop-App mit dem Anbieter deiner Wahl.",
    platformNote: "MIT-Lizenz",
    heroArtLabel: "OpenCtrlC-Terminalvorschau",
    terminalStatus: "● verbunden",
    terminalUserLabel: "du",
    terminalReady: "Bereit, in deinem Projekt zu arbeiten.",
    terminalPrompt: "Finde den sichersten Ort, um dieses Feature hinzuzufügen.",
    terminalResponse: "Ich prüfe zuerst die Projektstruktur und verfolge das bestehende Muster.",
    terminalProgress: "4 Dateien geprüft · Kontext bereit",
    heroArtCaption: "Ein fokussierter Ablauf von der Frage bis zur Änderung.",
    primaryCta: "OpenCtrlC herunterladen",
    secondaryCta: "Dokumentation lesen",
    installLabel: "Im Terminal starten",
    installHint: "Das Installationsskript erkennt Betriebssystem und Architektur automatisch.",
    installTitle: "Einmal installieren. Deinen Workflow behalten.",
    workflowTitle: "Ein Projektkontext. Zwei Arbeitsweisen.",
    workflowBody:
      "Wechsle zwischen schnellem Terminal-Loop und ruhigem Desktop-Arbeitsbereich, ohne wichtigen Sitzungskontext zu verlieren.",
    workflowEyebrow: "So passt es hinein",
    workflows: [
      {
        label: "01 / Terminal",
        title: "Schnell, wenn die Tastatur reicht.",
        body: "Fragen stellen, Arbeit planen, Dateien bearbeiten und Befehle in einer nativen TUI ausführen.",
      },
      {
        label: "02 / Desktop",
        title: "Die ganze Sitzung klarer sehen.",
        body: "Nutze ein eigenes Fenster für Projektnavigation, Sitzungsverlauf, Exporte und lange Aufgaben.",
      },
      {
        label: "03 / Projekt",
        title: "Wichtigen Kontext prüfbar halten.",
        body: "Arbeite mit lokalen Projektdateien und prüfe Kontext, Tools und Ausgabe hinter jedem Schritt.",
      },
    ],
    featuresTitle: "Die wichtigen Teile bleiben sichtbar.",
    featuresBody:
      "OpenCtrlC konzentriert sich auf das, was einen Agenten zuverlässig macht: sehen, was er sieht, Verlauf bewahren und Ergebnisse mitnehmen.",
    featuresEyebrow: "Für Vertrauen gebaut",
    features: [
      {
        label: "Kontext",
        title: "Erst verstehen, dann ändern.",
        body: "Prüfe System-Prompt, Skills und Kontextverbrauch, wenn du das Verhalten des Agenten nachvollziehen willst.",
      },
      {
        label: "Sitzungen",
        title: "Ohne Neustart weiterarbeiten.",
        body: "Navigiere im Verlauf, durchsuche Turns, klappe erledigte Aktivitäten ein und halte Gespräche lesbar.",
      },
      {
        label: "Ausgabe",
        title: "Nimm das Ergebnis mit.",
        body: "Exportiere eine Markdown-Zusammenfassung, ein vollständiges Transkript oder strukturiertes JSON.",
      },
      {
        label: "Plattformen",
        title: "Nutze deinen vorhandenen Rechner.",
        body: "Die Pipeline veröffentlicht CLI- und Desktop-Pakete für macOS, Windows und Linux, wo unterstützt auch für x64 und arm64.",
      },
    ],
    docsCta: "Dokumentation öffnen",
    downloadCta: "Alle Downloads ansehen",
    faqTitle: "Ein paar klare Antworten.",
    faqEyebrow: "FAQ",
    faq: [
      {
        question: "Was ist OpenCtrlC?",
        answer:
          "OpenCtrlC ist ein unabhängig gepflegter Open-Source-KI-Coding-Agent für Terminal- und Desktop-Workflows zum Erkunden von Projekten, Bearbeiten von Dateien, Ausführen von Befehlen und Prüfen von Änderungen.",
      },
      {
        question: "Brauche ich ein OpenCtrlC-Konto oder ein Abo?",
        answer:
          "Nein. OpenCtrlC verlangt kein von OpenCtrlC gehostetes Modell-Abo. Konfiguriere den Modellanbieter und die Zugangsdaten, die zu deinem Workflow passen.",
      },
      {
        question: "Wohin geht mein Code?",
        answer:
          "OpenCtrlC arbeitet mit deinem lokalen Projekt und sendet Anfragen an den von dir konfigurierten Anbieter. Prüfe dessen Datenrichtlinie und teile Sitzungen nur bewusst.",
      },
      {
        question: "Welche Systeme werden unterstützt?",
        answer:
          "CLI-Pakete gibt es für macOS, Windows und Linux. Desktop-Installer werden für macOS, Windows und Linux mit x64- und arm64-Zielen veröffentlicht.",
      },
    ],
    finalTitle: "Mach deine nächste Codebasis leichter bearbeitbar.",
    finalBody: "OpenCtrlC ist Open Source, prüfbar und bereit für deinen bestehenden Workflow.",
    finalEyebrow: "OpenCtrlC",
    finalCta: "Jetzt starten",
    copyLabel: "Kopieren",
    copiedLabel: "Kopiert",
    copyCommandLabel: "Befehl kopieren",
  },
  es: {
    title: "OpenCtrlC — un agente de código con IA de código abierto",
    description:
      "OpenCtrlC es un agente de código con IA de código abierto para flujos de trabajo en terminal y escritorio. Elige tu proveedor de modelos y conserva el contexto del proyecto.",
    announcement: "Código abierto, local por diseño y disponible para tres plataformas de escritorio.",
    announcementLink: "Ver descargas",
    heroEyebrow: "Un agente de código con IA para quienes controlan su flujo de trabajo",
    heroTitle: "Desarrolla con un agente que permanece cerca de tu código.",
    heroBody:
      "OpenCtrlC te ayuda a entender una base de código, hacer cambios, ejecutar comandos y revisar el resultado en un flujo enfocado. Usa la terminal o la aplicación de escritorio con el proveedor que elijas.",
    platformNote: "Licencia MIT",
    heroArtLabel: "Vista previa de la terminal de OpenCtrlC",
    terminalStatus: "● conectado",
    terminalUserLabel: "tú",
    terminalReady: "Listo para trabajar en tu proyecto.",
    terminalPrompt: "Encuentra el lugar más seguro para añadir esta función.",
    terminalResponse: "Primero revisaré la estructura del proyecto y seguiré el patrón existente.",
    terminalProgress: "4 archivos revisados · contexto listo",
    heroArtCaption: "Un ciclo enfocado de la pregunta al cambio.",
    primaryCta: "Descargar OpenCtrlC",
    secondaryCta: "Leer la documentación",
    installLabel: "Empieza en tu terminal",
    installHint: "El script de instalación detecta tu sistema operativo y arquitectura.",
    installTitle: "Instala una vez. Conserva tu flujo.",
    workflowTitle: "Un contexto de proyecto. Dos formas de trabajar.",
    workflowBody:
      "Cambia entre un ciclo rápido en la terminal y un espacio de escritorio claro sin perder el contexto importante de la sesión.",
    workflowEyebrow: "Cómo encaja",
    workflows: [
      {
        label: "01 / Terminal",
        title: "Rápido cuando solo necesitas el teclado.",
        body: "Haz preguntas, planifica, edita archivos y ejecuta comandos desde una TUI nativa.",
      },
      {
        label: "02 / Escritorio",
        title: "Una vista más clara de toda la sesión.",
        body: "Usa una ventana dedicada para navegar por el proyecto, consultar el historial y exportar resultados.",
      },
      {
        label: "03 / Proyecto",
        title: "Mantén el contexto importante visible.",
        body: "Trabaja con tus archivos locales e inspecciona el contexto, las herramientas y la salida de cada paso.",
      },
    ],
    featuresTitle: "Las partes útiles están a la vista.",
    featuresBody:
      "OpenCtrlC se centra en lo que hace fiable a un agente: saber qué ve, conservar el historial y facilitar el uso del resultado.",
    featuresEyebrow: "Diseñado para generar confianza",
    features: [
      {
        label: "Contexto",
        title: "Entiende antes de cambiar.",
        body: "Inspecciona el prompt del sistema, las Skills y el uso del contexto para entender el comportamiento del agente.",
      },
      {
        label: "Sesiones",
        title: "Vuelve al trabajo sin empezar de cero.",
        body: "Navega por el historial, busca turnos, contrae la actividad terminada y mantén la conversación legible.",
      },
      {
        label: "Salida",
        title: "Llévate el resultado.",
        body: "Exporta un resumen Markdown, una transcripción completa o JSON estructurado para tus propias herramientas.",
      },
      {
        label: "Plataformas",
        title: "Usa el equipo que ya tienes.",
        body: "La canalización publica paquetes CLI y Desktop para macOS, Windows y Linux, incluidos x64 y arm64 cuando están disponibles.",
      },
    ],
    docsCta: "Explorar la documentación",
    downloadCta: "Ver todas las descargas",
    faqTitle: "Algunas respuestas claras.",
    faqEyebrow: "Preguntas frecuentes",
    faq: [
      {
        question: "¿Qué es OpenCtrlC?",
        answer:
          "OpenCtrlC es un agente de código con IA de código abierto mantenido de forma independiente. Ofrece flujos de trabajo de terminal y escritorio para explorar proyectos, editar archivos, ejecutar comandos y revisar cambios.",
      },
      {
        question: "¿Necesito una cuenta o suscripción de OpenCtrlC?",
        answer:
          "No. OpenCtrlC no requiere una suscripción de modelos alojada por OpenCtrlC. Configura el proveedor y las credenciales que se adapten a tu flujo.",
      },
      {
        question: "¿Adónde va mi código?",
        answer:
          "OpenCtrlC trabaja con tu proyecto local y envía solicitudes al proveedor que configures. Consulta su política de datos y comparte sesiones solo cuando quieras hacerlo.",
      },
      {
        question: "¿Qué sistemas son compatibles?",
        answer:
          "Hay paquetes CLI para macOS, Windows y Linux. Los instaladores de escritorio se publican para las tres plataformas con objetivos x64 y arm64.",
      },
    ],
    finalTitle: "Haz que tu próxima base de código sea más fácil de trabajar.",
    finalBody: "OpenCtrlC es de código abierto, inspeccionable y está listo para tu flujo actual.",
    finalEyebrow: "OpenCtrlC",
    finalCta: "Empezar",
    copyLabel: "Copiar",
    copiedLabel: "Copiado",
    copyCommandLabel: "Copiar comando",
  },
  fr: {
    title: "OpenCtrlC — un agent de code IA open source",
    description:
      "OpenCtrlC est un agent de code IA open source pour les workflows dans le terminal et sur le bureau. Choisissez votre fournisseur de modèles et gardez le contexte du projet près de vous.",
    announcement: "Open source, local par défaut et disponible sur trois plateformes de bureau.",
    announcementLink: "Voir les téléchargements",
    heroEyebrow: "Un agent de code IA pour celles et ceux qui maîtrisent leur workflow",
    heroTitle: "Développez avec un agent qui reste proche de votre code.",
    heroBody:
      "OpenCtrlC vous aide à comprendre une base de code, effectuer des changements, lancer des commandes et vérifier le résultat dans un workflow concentré. Utilisez le terminal ou l’application de bureau avec le fournisseur de votre choix.",
    platformNote: "Licence MIT",
    heroArtLabel: "Aperçu du terminal OpenCtrlC",
    terminalStatus: "● connecté",
    terminalUserLabel: "vous",
    terminalReady: "Prêt à travailler dans votre projet.",
    terminalPrompt: "Trouvez l’endroit le plus sûr pour ajouter cette fonctionnalité.",
    terminalResponse: "Je vais d’abord inspecter la structure du projet et suivre le modèle existant.",
    terminalProgress: "4 fichiers inspectés · contexte prêt",
    heroArtCaption: "Un cycle concentré, de la question au changement.",
    primaryCta: "Télécharger OpenCtrlC",
    secondaryCta: "Lire la documentation",
    installLabel: "Commencer dans le terminal",
    installHint: "Le script d’installation détecte votre système et votre architecture.",
    installTitle: "Installez une fois. Gardez votre workflow.",
    workflowTitle: "Un contexte de projet. Deux façons de travailler.",
    workflowBody:
      "Passez d’un cycle rapide dans le terminal à un espace de travail sur le bureau sans perdre le contexte de session important.",
    workflowEyebrow: "Comment l’utiliser",
    workflows: [
      {
        label: "01 / Terminal",
        title: "Rapide quand le clavier suffit.",
        body: "Posez des questions, planifiez, modifiez des fichiers et lancez des commandes depuis une TUI native.",
      },
      {
        label: "02 / Bureau",
        title: "Une vue plus claire de la session.",
        body: "Utilisez une fenêtre dédiée pour naviguer dans le projet, consulter l’historique et exporter les résultats.",
      },
      {
        label: "03 / Projet",
        title: "Gardez le contexte important inspectable.",
        body: "Travaillez avec vos fichiers locaux et examinez le contexte, les outils et la sortie de chaque étape.",
      },
    ],
    featuresTitle: "Les éléments utiles restent visibles.",
    featuresBody:
      "OpenCtrlC se concentre sur ce qui rend un agent fiable : savoir ce qu’il voit, conserver l’historique et emporter le résultat.",
    featuresEyebrow: "Conçu pour la confiance",
    features: [
      {
        label: "Contexte",
        title: "Comprendre avant de modifier.",
        body: "Inspectez le prompt système, les Skills et l’utilisation du contexte pour comprendre le comportement de l’agent.",
      },
      {
        label: "Sessions",
        title: "Reprendre sans recommencer.",
        body: "Parcourez l’historique, recherchez les tours, repliez l’activité terminée et gardez la conversation lisible.",
      },
      {
        label: "Sortie",
        title: "Emportez le résultat.",
        body: "Exportez un résumé Markdown, une transcription complète ou du JSON structuré pour vos propres outils.",
      },
      {
        label: "Plateformes",
        title: "Utilisez la machine que vous avez déjà.",
        body: "Le pipeline publie des paquets CLI et Desktop pour macOS, Windows et Linux, avec x64 et arm64 lorsque disponibles.",
      },
    ],
    docsCta: "Explorer la documentation",
    downloadCta: "Voir tous les téléchargements",
    faqTitle: "Quelques réponses claires.",
    faqEyebrow: "FAQ",
    faq: [
      {
        question: "Qu’est-ce qu’OpenCtrlC ?",
        answer:
          "OpenCtrlC est un agent de code IA open source maintenu indépendamment. Il fournit des workflows terminal et bureau pour explorer des projets, modifier des fichiers, lancer des commandes et vérifier les changements.",
      },
      {
        question: "Ai-je besoin d’un compte ou d’un abonnement OpenCtrlC ?",
        answer:
          "Non. OpenCtrlC ne nécessite pas d’abonnement à un modèle hébergé par OpenCtrlC. Configurez le fournisseur et les identifiants adaptés à votre workflow.",
      },
      {
        question: "Où va mon code ?",
        answer:
          "OpenCtrlC travaille sur votre projet local et envoie les requêtes au fournisseur que vous configurez. Consultez sa politique de données et ne partagez une session que volontairement.",
      },
      {
        question: "Quels systèmes sont pris en charge ?",
        answer:
          "Des paquets CLI sont publiés pour macOS, Windows et Linux. Les installateurs Desktop couvrent les trois plateformes avec des cibles x64 et arm64.",
      },
    ],
    finalTitle: "Rendez votre prochaine base de code plus facile à travailler.",
    finalBody: "OpenCtrlC est open source, inspectable et prêt pour votre workflow actuel.",
    finalEyebrow: "OpenCtrlC",
    finalCta: "Commencer",
    copyLabel: "Copier",
    copiedLabel: "Copié",
    copyCommandLabel: "Copier la commande",
  },
  it: {
    title: "OpenCtrlC — un agente di coding AI open source",
    description:
      "OpenCtrlC è un agente di coding AI open source per i flussi di lavoro da terminale e desktop. Scegli il tuo provider di modelli e mantieni vicino il contesto del progetto.",
    announcement: "Open source, locale e disponibile su tre piattaforme desktop.",
    announcementLink: "Vedi i download",
    heroEyebrow: "Un agente di coding AI per chi controlla il proprio flusso di lavoro",
    heroTitle: "Costruisci con un agente che resta vicino al tuo codice.",
    heroBody:
      "OpenCtrlC ti aiuta a capire una codebase, apportare modifiche, eseguire comandi e verificare il risultato in un unico flusso concentrato. Usa il terminale o l’app desktop con il provider che preferisci.",
    platformNote: "Licenza MIT",
    heroArtLabel: "Anteprima del terminale OpenCtrlC",
    terminalStatus: "● connesso",
    terminalUserLabel: "tu",
    terminalReady: "Pronto a lavorare nel tuo progetto.",
    terminalPrompt: "Trova il posto più sicuro per aggiungere questa funzione.",
    terminalResponse: "Prima analizzerò la struttura del progetto e seguirò il modello esistente.",
    terminalProgress: "4 file analizzati · contesto pronto",
    heroArtCaption: "Un ciclo concentrato dalla domanda alla modifica.",
    primaryCta: "Scarica OpenCtrlC",
    secondaryCta: "Leggi la documentazione",
    installLabel: "Inizia dal terminale",
    installHint: "Lo script di installazione rileva sistema operativo e architettura.",
    installTitle: "Installa una volta. Mantieni il tuo flusso.",
    workflowTitle: "Un contesto di progetto. Due modi di lavorare.",
    workflowBody: "Passa dal terminale al desktop senza perdere il contesto importante della sessione.",
    workflowEyebrow: "Come si integra",
    workflows: [
      {
        label: "01 / Terminale",
        title: "Veloce quando basta la tastiera.",
        body: "Fai domande, pianifica, modifica file ed esegui comandi da una TUI nativa.",
      },
      {
        label: "02 / Desktop",
        title: "Una visione più chiara della sessione.",
        body: "Usa una finestra dedicata per navigare il progetto, consultare la cronologia ed esportare i risultati.",
      },
      {
        label: "03 / Progetto",
        title: "Mantieni il contesto importante verificabile.",
        body: "Lavora con i file locali e controlla contesto, strumenti e output di ogni passaggio.",
      },
    ],
    featuresTitle: "Le parti utili restano visibili.",
    featuresBody:
      "OpenCtrlC si concentra su ciò che rende affidabile un agente: sapere cosa vede, conservare la cronologia e portare via il risultato.",
    featuresEyebrow: "Progettato per la fiducia",
    features: [
      {
        label: "Contesto",
        title: "Capisci prima di modificare.",
        body: "Controlla prompt di sistema, Skills e uso del contesto per capire il comportamento dell’agente.",
      },
      {
        label: "Sessioni",
        title: "Riprendi senza ricominciare.",
        body: "Naviga la cronologia, cerca nei turni, comprimi le attività completate e mantieni leggibile la conversazione.",
      },
      {
        label: "Output",
        title: "Porta con te il risultato.",
        body: "Esporta un riepilogo Markdown, una trascrizione completa o JSON strutturato per i tuoi strumenti.",
      },
      {
        label: "Piattaforme",
        title: "Usa il computer che hai già.",
        body: "La pipeline pubblica pacchetti CLI e Desktop per macOS, Windows e Linux, inclusi x64 e arm64 quando supportati.",
      },
    ],
    docsCta: "Esplora la documentazione",
    downloadCta: "Vedi tutti i download",
    faqTitle: "Qualche risposta chiara.",
    faqEyebrow: "FAQ",
    faq: [
      {
        question: "Che cos’è OpenCtrlC?",
        answer:
          "OpenCtrlC è un agente di coding AI open source mantenuto in modo indipendente. Offre flussi terminale e desktop per esplorare progetti, modificare file, eseguire comandi e verificare le modifiche.",
      },
      {
        question: "Servono un account o un abbonamento OpenCtrlC?",
        answer:
          "No. OpenCtrlC non richiede un abbonamento a modelli ospitati da OpenCtrlC. Configura il provider e le credenziali adatti al tuo flusso.",
      },
      {
        question: "Dove viene inviato il mio codice?",
        answer:
          "OpenCtrlC lavora sul progetto locale e invia le richieste al provider configurato. Controlla la sua politica sui dati e condividi le sessioni solo quando lo desideri.",
      },
      {
        question: "Quali sistemi sono supportati?",
        answer:
          "I pacchetti CLI sono pubblicati per macOS, Windows e Linux. Gli installer desktop coprono le tre piattaforme con destinazioni x64 e arm64.",
      },
    ],
    finalTitle: "Rendi più semplice lavorare sulla tua prossima codebase.",
    finalBody: "OpenCtrlC è open source, verificabile e pronto per il flusso che già usi.",
    finalEyebrow: "OpenCtrlC",
    finalCta: "Inizia ora",
    copyLabel: "Copia",
    copiedLabel: "Copiato",
    copyCommandLabel: "Copia comando",
  },
  da: {
    title: "OpenCtrlC — en open source AI-kodeagent",
    description:
      "OpenCtrlC er en open source AI-kodeagent til terminal- og desktop-workflows. Vælg din modeludbyder, og behold projektkonteksten tæt på.",
    announcement: "Open source, lokal først og tilgængelig på tre desktop-platforme.",
    announcementLink: "Se downloads",
    heroEyebrow: "En AI-kodeagent til dig, der selv ejer dit workflow",
    heroTitle: "Byg med en agent, der bliver tæt på din kode.",
    heroBody:
      "OpenCtrlC hjælper dig med at forstå en kodebase, lave ændringer, køre kommandoer og gennemgå resultatet i ét fokuseret workflow. Brug terminalen eller desktop-appen med den udbyder, du vælger.",
    platformNote: "MIT-licens",
    heroArtLabel: "OpenCtrlC-terminalvisning",
    terminalStatus: "● forbundet",
    terminalUserLabel: "dig",
    terminalReady: "Klar til at arbejde i dit projekt.",
    terminalPrompt: "Find det sikreste sted at tilføje denne funktion.",
    terminalResponse: "Jeg undersøger først projektstrukturen og følger det eksisterende mønster.",
    terminalProgress: "4 filer undersøgt · kontekst klar",
    heroArtCaption: "Et fokuseret loop fra spørgsmål til ændring.",
    primaryCta: "Download OpenCtrlC",
    secondaryCta: "Læs dokumentationen",
    installLabel: "Start i terminalen",
    installHint: "Installationsscriptet finder automatisk dit operativsystem og din arkitektur.",
    installTitle: "Installer én gang. Behold dit workflow.",
    workflowTitle: "Én projektkontekst. To måder at arbejde på.",
    workflowBody:
      "Skift mellem et hurtigt terminalloop og et roligt desktop-arbejdsområde uden at miste vigtig sessionskontekst.",
    workflowEyebrow: "Sådan passer det ind",
    workflows: [
      {
        label: "01 / Terminal",
        title: "Hurtig, når tastaturet er nok.",
        body: "Stil spørgsmål, planlæg, rediger filer og kør kommandoer fra en indbygget TUI.",
      },
      {
        label: "02 / Desktop",
        title: "Et tydeligere overblik over sessionen.",
        body: "Brug et dedikeret vindue til projektnavigation, historik og eksport af resultater.",
      },
      {
        label: "03 / Projekt",
        title: "Hold vigtig kontekst synlig.",
        body: "Arbejd med lokale projektfiler, og inspicér kontekst, værktøjer og output bag hvert trin.",
      },
    ],
    featuresTitle: "De nyttige dele er synlige.",
    featuresBody:
      "OpenCtrlC fokuserer på det, der gør en agent pålidelig: at vide hvad den ser, bevare historikken og gøre resultatet let at tage med.",
    featuresEyebrow: "Bygget til tillid",
    features: [
      {
        label: "Kontekst",
        title: "Forstå før du ændrer.",
        body: "Undersøg systemprompt, Skills og kontekstforbrug, når du vil vide hvorfor agenten opfører sig sådan.",
      },
      {
        label: "Sessioner",
        title: "Vend tilbage uden at starte forfra.",
        body: "Navigér i historikken, søg i turns, fold færdig aktivitet sammen og hold samtalen læsbar.",
      },
      {
        label: "Output",
        title: "Tag resultatet med dig.",
        body: "Eksportér en Markdown-opsummering, en fuld transskription eller struktureret JSON.",
      },
      {
        label: "Platforme",
        title: "Brug den maskine du allerede har.",
        body: "Release-pipelinen udgiver CLI- og desktop-pakker til macOS, Windows og Linux, med x64 og arm64 hvor det understøttes.",
      },
    ],
    docsCta: "Udforsk dokumentationen",
    downloadCta: "Se alle downloads",
    faqTitle: "Nogle klare svar.",
    faqEyebrow: "FAQ",
    faq: [
      {
        question: "Hvad er OpenCtrlC?",
        answer:
          "OpenCtrlC er en uafhængigt vedligeholdt open source AI-kodeagent. Den giver terminal- og desktop-workflows til at udforske projekter, redigere filer, køre kommandoer og gennemgå ændringer.",
      },
      {
        question: "Skal jeg have en OpenCtrlC-konto eller et abonnement?",
        answer:
          "Nej. OpenCtrlC kræver ikke et modelabonnement hostet af OpenCtrlC. Konfigurér den modeludbyder og de legitimationsoplysninger, der passer til dit workflow.",
      },
      {
        question: "Hvor sendes min kode hen?",
        answer:
          "OpenCtrlC arbejder med dit lokale projekt og sender forespørgsler til den udbyder, du konfigurerer. Tjek udbyderens datapolitik, og del kun sessioner når du ønsker det.",
      },
      {
        question: "Hvilke systemer understøttes?",
        answer:
          "CLI-pakker udgives til macOS, Windows og Linux. Desktop-installere udgives til de tre platforme med x64- og arm64-mål.",
      },
    ],
    finalTitle: "Gør din næste kodebase lettere at arbejde med.",
    finalBody: "OpenCtrlC er open source, gennemskuelig og klar til det workflow, du allerede bruger.",
    finalEyebrow: "OpenCtrlC",
    finalCta: "Kom i gang",
    copyLabel: "Kopiér",
    copiedLabel: "Kopieret",
    copyCommandLabel: "Kopiér kommando",
  },
  ja: {
    title: "OpenCtrlC — オープンソースの AI コーディングエージェント",
    description:
      "OpenCtrlC は、ターミナルとデスクトップのワークフロー向けオープンソース AI コーディングエージェントです。モデルプロバイダーを選び、プロジェクトのコンテキストを手元に保てます。",
    announcement: "オープンソース、ローカルファースト。3 つのデスクトッププラットフォームに対応。",
    announcementLink: "ダウンロードを見る",
    heroEyebrow: "自分のワークフローを大切にする人のための AI コーディングエージェント",
    heroTitle: "コードのそばにいるエージェントと開発しよう。",
    heroBody:
      "OpenCtrlC は、コードベースの理解、変更、コマンド実行、結果の確認をひとつの集中したワークフローにまとめます。選択したプロバイダーを使い、ターミナルまたはデスクトップアプリで利用できます。",
    platformNote: "MIT ライセンス",
    heroArtLabel: "OpenCtrlC ターミナルプレビュー",
    terminalStatus: "● 接続済み",
    terminalUserLabel: "あなた",
    terminalReady: "プロジェクトで作業する準備ができました。",
    terminalPrompt: "この機能を安全に追加できる場所を見つけて。",
    terminalResponse: "まずプロジェクト構造を確認し、既存のパターンを追跡します。",
    terminalProgress: "4 ファイルを確認 · コンテキスト準備完了",
    heroArtCaption: "質問から変更まで、集中したループを保ちます。",
    primaryCta: "OpenCtrlC をダウンロード",
    secondaryCta: "ドキュメントを読む",
    installLabel: "ターミナルから始める",
    installHint: "インストールスクリプトが OS と CPU アーキテクチャを自動検出します。",
    installTitle: "一度インストールして、いつものワークフローを保つ。",
    workflowTitle: "ひとつのプロジェクトコンテキスト。ふたつの使い方。",
    workflowBody:
      "大切なセッションコンテキストを失わず、ターミナルの速いループと落ち着いたデスクトップ環境を行き来できます。",
    workflowEyebrow: "ワークフローへの組み込み方",
    workflows: [
      {
        label: "01 / ターミナル",
        title: "キーボードだけで素早く進める。",
        body: "ネイティブ TUI で質問、計画、ファイル編集、コマンド実行を行えます。",
      },
      {
        label: "02 / デスクトップ",
        title: "セッション全体を見渡す。",
        body: "専用ウィンドウでプロジェクト、履歴、エクスポート、長時間の作業を管理できます。",
      },
      {
        label: "03 / プロジェクト",
        title: "重要なコンテキストを確認可能にする。",
        body: "ローカルファイルを使い、各ステップのコンテキスト、ツール、出力を確認できます。",
      },
    ],
    featuresTitle: "役立つ部分を、見えるままに。",
    featuresBody:
      "OpenCtrlC は、信頼できるエージェントに必要な瞬間を中心に作られています。何を見ているか、履歴、持ち出せる結果を確認できます。",
    featuresEyebrow: "信頼のために設計",
    features: [
      {
        label: "コンテキスト",
        title: "変更する前に理解する。",
        body: "動作の理由を知りたいときは、システムプロンプト、Skills、コンテキスト使用量を確認できます。",
      },
      {
        label: "セッション",
        title: "最初からやり直さない。",
        body: "履歴を移動し、ターンを検索し、完了した活動を折りたたんで会話を読みやすく保ちます。",
      },
      {
        label: "出力",
        title: "結果を持ち帰る。",
        body: "Markdown の要約、完全なトランスクリプト、構造化 JSON を自分のツールに渡せます。",
      },
      {
        label: "プラットフォーム",
        title: "手元のマシンで使う。",
        body: "macOS、Windows、Linux 向けの CLI と Desktop パッケージを公開し、対応環境では x64 と arm64 を提供します。",
      },
    ],
    docsCta: "ドキュメントを見る",
    downloadCta: "すべてのダウンロードを見る",
    faqTitle: "よくある質問への答え。",
    faqEyebrow: "FAQ",
    faq: [
      {
        question: "OpenCtrlC とは？",
        answer:
          "OpenCtrlC は独立してメンテナンスされているオープンソース AI コーディングエージェントです。プロジェクトの探索、ファイル編集、コマンド実行、変更確認のためのターミナルとデスクトップ環境を提供します。",
      },
      {
        question: "OpenCtrlC のアカウントやサブスクリプションは必要？",
        answer:
          "必要ありません。OpenCtrlC がホストするモデルのサブスクリプションは不要です。ワークフローに合うプロバイダーと認証情報を設定してください。",
      },
      {
        question: "コードはどこへ送られますか？",
        answer:
          "OpenCtrlC はローカルプロジェクトを対象に動作し、設定したプロバイダーへリクエストを送ります。プロバイダーのデータポリシーを確認し、共有機能は意図した場合だけ使ってください。",
      },
      {
        question: "対応しているシステムは？",
        answer:
          "CLI パッケージは macOS、Windows、Linux 向けに公開されています。Desktop インストーラーは 3 つの OS の x64 と arm64 を対象にしています。",
      },
    ],
    finalTitle: "次のコードベースを、もっと扱いやすく。",
    finalBody: "OpenCtrlC はオープンソースで、動作を確認でき、今のワークフローにすぐ使えます。",
    finalEyebrow: "OpenCtrlC",
    finalCta: "始める",
    copyLabel: "コピー",
    copiedLabel: "コピーしました",
    copyCommandLabel: "コマンドをコピー",
  },
  ko: {
    title: "OpenCtrlC — 오픈 소스 AI 코딩 에이전트",
    description:
      "OpenCtrlC는 터미널과 데스크톱 워크플로를 위한 오픈 소스 AI 코딩 에이전트입니다. 원하는 모델 프로바이더를 선택하고 프로젝트 컨텍스트를 가까이 유지하세요.",
    announcement: "오픈 소스, 로컬 우선, 세 가지 데스크톱 플랫폼 지원.",
    announcementLink: "다운로드 보기",
    heroEyebrow: "자신의 워크플로를 직접 관리하는 사람을 위한 AI 코딩 에이전트",
    heroTitle: "코드 가까이에 머무는 에이전트와 함께 만드세요.",
    heroBody:
      "OpenCtrlC는 코드베이스를 이해하고, 파일을 수정하고, 명령을 실행하고, 결과를 검토하는 과정을 하나의 집중된 워크플로로 연결합니다. 원하는 프로바이더와 함께 터미널이나 데스크톱 앱에서 사용할 수 있습니다.",
    platformNote: "MIT 라이선스",
    heroArtLabel: "OpenCtrlC 터미널 미리보기",
    terminalStatus: "● 연결됨",
    terminalUserLabel: "나",
    terminalReady: "프로젝트에서 작업할 준비가 되었습니다.",
    terminalPrompt: "이 기능을 안전하게 추가할 위치를 찾아줘.",
    terminalResponse: "먼저 프로젝트 구조를 살펴보고 기존 패턴을 추적하겠습니다.",
    terminalProgress: "파일 4개 확인 · 컨텍스트 준비됨",
    heroArtCaption: "질문에서 변경까지 집중된 흐름을 유지합니다.",
    primaryCta: "OpenCtrlC 다운로드",
    secondaryCta: "문서 읽기",
    installLabel: "터미널에서 시작",
    installHint: "설치 스크립트가 운영체제와 아키텍처를 자동으로 감지합니다.",
    installTitle: "한 번 설치하고, 나만의 워크플로를 유지하세요.",
    workflowTitle: "하나의 프로젝트 컨텍스트. 두 가지 작업 방식.",
    workflowBody: "중요한 세션 컨텍스트를 잃지 않고 빠른 터미널 루프와 편안한 데스크톱 작업 공간을 오갈 수 있습니다.",
    workflowEyebrow: "워크플로에 맞추는 방법",
    workflows: [
      {
        label: "01 / 터미널",
        title: "키보드만 필요할 때 빠르게.",
        body: "네이티브 TUI에서 질문하고, 계획하고, 파일을 편집하고, 명령을 실행하세요.",
      },
      {
        label: "02 / 데스크톱",
        title: "세션 전체를 더 선명하게 보기.",
        body: "전용 창에서 프로젝트 탐색, 세션 기록, 내보내기와 긴 작업을 관리하세요.",
      },
      {
        label: "03 / 프로젝트",
        title: "중요한 컨텍스트를 직접 확인하기.",
        body: "로컬 프로젝트 파일을 사용하며 각 단계의 컨텍스트, 도구와 출력을 확인할 수 있습니다.",
      },
    ],
    featuresTitle: "유용한 부분은 모두 보입니다.",
    featuresBody:
      "OpenCtrlC는 에이전트를 믿고 쓸 수 있게 하는 순간에 집중합니다. 무엇을 보는지 알고, 기록을 보존하고, 결과를 쉽게 가져가세요.",
    featuresEyebrow: "신뢰를 위해 설계",
    features: [
      {
        label: "컨텍스트",
        title: "바꾸기 전에 이해하세요.",
        body: "에이전트의 동작 이유가 궁금할 때 시스템 프롬프트, Skills와 컨텍스트 사용량을 확인할 수 있습니다.",
      },
      {
        label: "세션",
        title: "처음부터 다시 시작하지 않기.",
        body: "세션 기록을 탐색하고 턴을 검색하고 완료된 활동을 접어 대화를 읽기 쉽게 유지하세요.",
      },
      {
        label: "출력",
        title: "결과를 가져가기.",
        body: "Markdown 요약, 전체 트랜스크립트 또는 구조화된 JSON을 내 도구와 기록에 활용하세요.",
      },
      {
        label: "플랫폼",
        title: "이미 가진 기기에서 사용하기.",
        body: "macOS, Windows, Linux용 CLI와 Desktop 패키지를 제공하며 지원되는 환경에는 x64와 arm64 빌드가 포함됩니다.",
      },
    ],
    docsCta: "문서 살펴보기",
    downloadCta: "전체 다운로드 보기",
    faqTitle: "명확한 답변 몇 가지.",
    faqEyebrow: "자주 묻는 질문",
    faq: [
      {
        question: "OpenCtrlC란 무엇인가요?",
        answer:
          "OpenCtrlC는 독립적으로 유지 관리되는 오픈 소스 AI 코딩 에이전트입니다. 프로젝트 탐색, 파일 수정, 명령 실행과 변경 검토를 위한 터미널 및 데스크톱 워크플로를 제공합니다.",
      },
      {
        question: "OpenCtrlC 계정이나 구독이 필요한가요?",
        answer:
          "아니요. OpenCtrlC가 호스팅하는 모델 구독은 필요하지 않습니다. 워크플로에 맞는 프로바이더와 인증 정보를 설정하면 됩니다.",
      },
      {
        question: "내 코드는 어디로 전송되나요?",
        answer:
          "OpenCtrlC는 로컬 프로젝트를 대상으로 동작하며 설정한 프로바이더로 요청을 보냅니다. 프로바이더의 데이터 정책을 확인하고 세션 공유는 의도한 경우에만 사용하세요.",
      },
      {
        question: "어떤 시스템을 지원하나요?",
        answer:
          "CLI 패키지는 macOS, Windows와 Linux용으로 제공됩니다. Desktop 설치 파일은 세 플랫폼의 x64 및 arm64 대상을 지원합니다.",
      },
    ],
    finalTitle: "다음 코드베이스를 더 쉽게 다뤄보세요.",
    finalBody: "OpenCtrlC는 오픈 소스이며 직접 확인할 수 있고, 지금 사용하는 워크플로에 바로 맞출 수 있습니다.",
    finalEyebrow: "OpenCtrlC",
    finalCta: "시작하기",
    copyLabel: "복사",
    copiedLabel: "복사됨",
    copyCommandLabel: "명령 복사",
  },
  pl: {
    title: "OpenCtrlC — otwartoźródłowy agent programistyczny AI",
    description:
      "OpenCtrlC to otwartoźródłowy agent programistyczny AI do pracy w terminalu i na komputerze. Wybierz dostawcę modeli i zachowaj kontekst projektu blisko siebie.",
    announcement: "Open source, lokalnie z założenia i dostępny na trzech platformach desktopowych.",
    announcementLink: "Zobacz pliki do pobrania",
    heroEyebrow: "Agent AI dla osób, które chcą mieć własny workflow",
    heroTitle: "Twórz z agentem, który pozostaje blisko twojego kodu.",
    heroBody:
      "OpenCtrlC pomaga zrozumieć bazę kodu, wprowadzać zmiany, uruchamiać polecenia i sprawdzać wynik w jednym skupionym przepływie pracy. Używaj terminala lub aplikacji desktopowej z wybranym dostawcą.",
    platformNote: "Licencja MIT",
    heroArtLabel: "Podgląd terminala OpenCtrlC",
    terminalStatus: "● połączono",
    terminalUserLabel: "ty",
    terminalReady: "Gotowe do pracy w projekcie.",
    terminalPrompt: "Znajdź najbezpieczniejsze miejsce, aby dodać tę funkcję.",
    terminalResponse: "Najpierw sprawdzę strukturę projektu i prześledzę istniejący wzorzec.",
    terminalProgress: "Sprawdzono 4 pliki · kontekst gotowy",
    heroArtCaption: "Skupiona pętla od pytania do zmiany.",
    primaryCta: "Pobierz OpenCtrlC",
    secondaryCta: "Przeczytaj dokumentację",
    installLabel: "Zacznij w terminalu",
    installHint: "Skrypt instalacyjny wykrywa system i architekturę procesora.",
    installTitle: "Zainstaluj raz. Zachowaj swój workflow.",
    workflowTitle: "Jeden kontekst projektu. Dwa sposoby pracy.",
    workflowBody: "Przełączaj się między szybkim terminalem a spokojnym pulpitem bez utraty ważnego kontekstu sesji.",
    workflowEyebrow: "Jak to działa",
    workflows: [
      {
        label: "01 / Terminal",
        title: "Szybko, gdy wystarczy klawiatura.",
        body: "Zadawaj pytania, planuj, edytuj pliki i uruchamiaj polecenia w natywnym TUI.",
      },
      {
        label: "02 / Desktop",
        title: "Wyraźniejszy widok całej sesji.",
        body: "Użyj osobnego okna do nawigacji po projekcie, historii sesji i eksportu wyników.",
      },
      {
        label: "03 / Projekt",
        title: "Zachowaj widoczny ważny kontekst.",
        body: "Pracuj z lokalnymi plikami i sprawdzaj kontekst, narzędzia oraz wynik każdego kroku.",
      },
    ],
    featuresTitle: "Przydatne elementy są widoczne.",
    featuresBody:
      "OpenCtrlC skupia się na tym, co czyni agenta godnym zaufania: pokazuje co widzi, zachowuje historię i ułatwia zabranie wyniku ze sobą.",
    featuresEyebrow: "Zaprojektowany dla zaufania",
    features: [
      {
        label: "Kontekst",
        title: "Najpierw zrozum, potem zmieniaj.",
        body: "Sprawdź prompt systemowy, Skills i zużycie kontekstu, gdy chcesz zrozumieć zachowanie agenta.",
      },
      {
        label: "Sesje",
        title: "Wróć do pracy bez zaczynania od zera.",
        body: "Przeglądaj historię, wyszukuj tury, zwijaj ukończoną aktywność i zachowaj czytelność rozmowy.",
      },
      {
        label: "Wynik",
        title: "Zabierz wynik ze sobą.",
        body: "Eksportuj podsumowanie Markdown, pełny transkrypt albo uporządkowany JSON.",
      },
      {
        label: "Platformy",
        title: "Użyj komputera, który już masz.",
        body: "Pipeline publikuje pakiety CLI i Desktop dla macOS, Windows i Linux, w tym x64 i arm64 tam, gdzie są obsługiwane.",
      },
    ],
    docsCta: "Otwórz dokumentację",
    downloadCta: "Zobacz wszystkie pliki",
    faqTitle: "Kilka prostych odpowiedzi.",
    faqEyebrow: "FAQ",
    faq: [
      {
        question: "Czym jest OpenCtrlC?",
        answer:
          "OpenCtrlC to niezależnie rozwijany otwartoźródłowy agent programistyczny AI. Udostępnia pracę w terminalu i na pulpicie do poznawania projektów, edycji plików, uruchamiania poleceń i sprawdzania zmian.",
      },
      {
        question: "Czy potrzebuję konta lub subskrypcji OpenCtrlC?",
        answer:
          "Nie. OpenCtrlC nie wymaga subskrypcji modelu hostowanego przez OpenCtrlC. Skonfiguruj dostawcę modeli i dane dostępowe odpowiednie dla twojego workflow.",
      },
      {
        question: "Gdzie trafia mój kod?",
        answer:
          "OpenCtrlC działa na lokalnym projekcie i wysyła żądania do skonfigurowanego dostawcy. Sprawdź jego politykę danych i udostępniaj sesje tylko świadomie.",
      },
      {
        question: "Jakie systemy są obsługiwane?",
        answer:
          "Pakiety CLI są publikowane dla macOS, Windows i Linux. Instalatory Desktop są publikowane dla tych platform z celami x64 i arm64.",
      },
    ],
    finalTitle: "Spraw, by z następną bazą kodu pracowało się łatwiej.",
    finalBody: "OpenCtrlC jest open source, możliwy do sprawdzenia i gotowy na twój obecny workflow.",
    finalEyebrow: "OpenCtrlC",
    finalCta: "Zacznij",
    copyLabel: "Kopiuj",
    copiedLabel: "Skopiowano",
    copyCommandLabel: "Kopiuj polecenie",
  },
  ru: {
    title: "OpenCtrlC — открытый AI-агент для программирования",
    description:
      "OpenCtrlC — открытый AI-агент для работы в терминале и на компьютере. Выберите провайдера моделей и держите контекст проекта рядом.",
    announcement: "Открытый исходный код, локальный подход и поддержка трёх настольных платформ.",
    announcementLink: "Смотреть загрузки",
    heroEyebrow: "AI-агент для тех, кто хочет управлять своим рабочим процессом",
    heroTitle: "Создавайте с агентом, который остаётся рядом с вашим кодом.",
    heroBody:
      "OpenCtrlC помогает понять кодовую базу, внести изменения, запустить команды и проверить результат в одном сосредоточенном процессе. Используйте терминал или настольное приложение с выбранным провайдером.",
    platformNote: "Лицензия MIT",
    heroArtLabel: "Предпросмотр терминала OpenCtrlC",
    terminalStatus: "● подключено",
    terminalUserLabel: "вы",
    terminalReady: "Готово к работе в проекте.",
    terminalPrompt: "Найди самое безопасное место для добавления этой функции.",
    terminalResponse: "Сначала я изучу структуру проекта и прослежу существующий подход.",
    terminalProgress: "Проверено 4 файла · контекст готов",
    heroArtCaption: "Сосредоточенный путь от вопроса к изменению.",
    primaryCta: "Скачать OpenCtrlC",
    secondaryCta: "Открыть документацию",
    installLabel: "Начать в терминале",
    installHint: "Скрипт установки автоматически определит ОС и архитектуру.",
    installTitle: "Установите один раз. Сохраните свой рабочий процесс.",
    workflowTitle: "Один контекст проекта. Два способа работы.",
    workflowBody:
      "Переходите от быстрого терминального цикла к спокойному рабочему месту на компьютере, не теряя важный контекст сессии.",
    workflowEyebrow: "Как это работает",
    workflows: [
      {
        label: "01 / Терминал",
        title: "Быстро, когда достаточно клавиатуры.",
        body: "Задавайте вопросы, планируйте, редактируйте файлы и запускайте команды в нативном TUI.",
      },
      {
        label: "02 / Desktop",
        title: "Вся сессия как на ладони.",
        body: "Используйте отдельное окно для навигации по проекту, истории сессий и экспорта результатов.",
      },
      {
        label: "03 / Проект",
        title: "Держите важный контекст проверяемым.",
        body: "Работайте с локальными файлами и проверяйте контекст, инструменты и вывод каждого шага.",
      },
    ],
    featuresTitle: "Важные части остаются видимыми.",
    featuresBody:
      "OpenCtrlC сосредоточен на том, что делает агента надёжным: он показывает, что видит, сохраняет историю и помогает забрать результат.",
    featuresEyebrow: "Создан для доверия",
    features: [
      {
        label: "Контекст",
        title: "Сначала понять, потом менять.",
        body: "Проверяйте системный промпт, Skills и использование контекста, когда хотите понять поведение агента.",
      },
      {
        label: "Сессии",
        title: "Возвращайтесь к работе без начала с нуля.",
        body: "Перемещайтесь по истории, ищите сообщения, сворачивайте завершённые действия и сохраняйте читаемость.",
      },
      {
        label: "Результат",
        title: "Забирайте результат с собой.",
        body: "Экспортируйте сводку Markdown, полный транскрипт или структурированный JSON.",
      },
      {
        label: "Платформы",
        title: "Используйте свой компьютер.",
        body: "Пайплайн публикует CLI- и Desktop-пакеты для macOS, Windows и Linux, включая x64 и arm64 там, где они поддерживаются.",
      },
    ],
    docsCta: "Изучить документацию",
    downloadCta: "Все загрузки",
    faqTitle: "Несколько простых ответов.",
    faqEyebrow: "Частые вопросы",
    faq: [
      {
        question: "Что такое OpenCtrlC?",
        answer:
          "OpenCtrlC — независимо поддерживаемый открытый AI-агент для программирования. Он даёт терминальный и настольный рабочий процесс для изучения проектов, редактирования файлов, запуска команд и проверки изменений.",
      },
      {
        question: "Нужна ли учётная запись или подписка OpenCtrlC?",
        answer:
          "Нет. OpenCtrlC не требует подписки на модели, размещённые OpenCtrlC. Настройте подходящего провайдера и учётные данные.",
      },
      {
        question: "Куда отправляется мой код?",
        answer:
          "OpenCtrlC работает с локальным проектом и отправляет запросы выбранному вами провайдеру. Изучите его политику данных и делитесь сессиями только осознанно.",
      },
      {
        question: "Какие системы поддерживаются?",
        answer:
          "CLI-пакеты публикуются для macOS, Windows и Linux. Настольные установщики выпускаются для этих платформ с целями x64 и arm64.",
      },
    ],
    finalTitle: "Сделайте следующую кодовую базу удобнее.",
    finalBody: "OpenCtrlC открыт, прозрачен и готов к вашему привычному рабочему процессу.",
    finalEyebrow: "OpenCtrlC",
    finalCta: "Начать",
    copyLabel: "Копировать",
    copiedLabel: "Скопировано",
    copyCommandLabel: "Копировать команду",
  },
  uk: {
    title: "OpenCtrlC — відкритий AI-агент для програмування",
    description:
      "OpenCtrlC — відкритий AI-агент для роботи в терміналі та на комп’ютері. Оберіть провайдера моделей і тримайте контекст проєкту поруч.",
    announcement: "Відкритий код, локальний підхід і підтримка трьох настільних платформ.",
    announcementLink: "Переглянути завантаження",
    heroEyebrow: "AI-агент для тих, хто керує власним робочим процесом",
    heroTitle: "Створюйте з агентом, який залишається поруч із вашим кодом.",
    heroBody:
      "OpenCtrlC допомагає зрозуміти кодову базу, внести зміни, виконати команди й перевірити результат в одному зосередженому процесі. Використовуйте термінал або настільну програму з обраним провайдером.",
    platformNote: "Ліцензія MIT",
    heroArtLabel: "Попередній перегляд термінала OpenCtrlC",
    terminalStatus: "● підключено",
    terminalUserLabel: "ви",
    terminalReady: "Готово до роботи у вашому проєкті.",
    terminalPrompt: "Знайди найбезпечніше місце для додавання цієї функції.",
    terminalResponse: "Спочатку я перевірю структуру проєкту та простежу наявний підхід.",
    terminalProgress: "Перевірено 4 файли · контекст готовий",
    heroArtCaption: "Зосереджений шлях від запитання до зміни.",
    primaryCta: "Завантажити OpenCtrlC",
    secondaryCta: "Відкрити документацію",
    installLabel: "Почати в терміналі",
    installHint: "Скрипт встановлення автоматично визначить ОС та архітектуру.",
    installTitle: "Встановіть один раз. Збережіть свій робочий процес.",
    workflowTitle: "Один контекст проєкту. Два способи роботи.",
    workflowBody:
      "Переходьте від швидкого термінального циклу до спокійного робочого простору, не втрачаючи важливий контекст сесії.",
    workflowEyebrow: "Як це працює",
    workflows: [
      {
        label: "01 / Термінал",
        title: "Швидко, коли достатньо клавіатури.",
        body: "Ставте запитання, плануйте, редагуйте файли й виконуйте команди у нативному TUI.",
      },
      {
        label: "02 / Desktop",
        title: "Чіткіше бачення всієї сесії.",
        body: "Використовуйте окреме вікно для навігації проєктом, історії сесій та експорту результатів.",
      },
      {
        label: "03 / Проєкт",
        title: "Зберігайте важливий контекст перевірюваним.",
        body: "Працюйте з локальними файлами й перевіряйте контекст, інструменти та вивід кожного кроку.",
      },
    ],
    featuresTitle: "Важливі частини залишаються видимими.",
    featuresBody:
      "OpenCtrlC зосереджений на тому, що робить агента надійним: показує, що він бачить, зберігає історію та допомагає забрати результат.",
    featuresEyebrow: "Створено для довіри",
    features: [
      {
        label: "Контекст",
        title: "Спочатку зрозуміти, потім змінювати.",
        body: "Перевіряйте системний промпт, Skills і використання контексту, коли потрібно зрозуміти поведінку агента.",
      },
      {
        label: "Сесії",
        title: "Повертайтеся до роботи без початку з нуля.",
        body: "Переглядайте історію, шукайте повідомлення, згортайте завершену активність і зберігайте читабельність.",
      },
      {
        label: "Результат",
        title: "Забирайте результат із собою.",
        body: "Експортуйте підсумок Markdown, повну транскрипцію або структурований JSON.",
      },
      {
        label: "Платформи",
        title: "Використовуйте свій комп’ютер.",
        body: "Пайплайн публікує CLI- та Desktop-пакети для macOS, Windows і Linux, з x64 та arm64 там, де вони підтримуються.",
      },
    ],
    docsCta: "Переглянути документацію",
    downloadCta: "Усі завантаження",
    faqTitle: "Кілька простих відповідей.",
    faqEyebrow: "Поширені запитання",
    faq: [
      {
        question: "Що таке OpenCtrlC?",
        answer:
          "OpenCtrlC — незалежно підтримуваний відкритий AI-агент для програмування. Він надає термінальний і настільний робочий процес для дослідження проєктів, редагування файлів, виконання команд і перевірки змін.",
      },
      {
        question: "Чи потрібні обліковий запис або підписка OpenCtrlC?",
        answer:
          "Ні. OpenCtrlC не вимагає підписки на моделі, розміщені OpenCtrlC. Налаштуйте провайдера та облікові дані, які підходять вашому процесу.",
      },
      {
        question: "Куди надсилається мій код?",
        answer:
          "OpenCtrlC працює з локальним проєктом і надсилає запити налаштованому провайдеру. Перевірте його політику даних і діліться сесіями лише свідомо.",
      },
      {
        question: "Які системи підтримуються?",
        answer:
          "CLI-пакети публікуються для macOS, Windows і Linux. Настільні інсталятори випускаються для цих платформ із цілями x64 та arm64.",
      },
    ],
    finalTitle: "Зробіть наступну кодову базу зручнішою.",
    finalBody: "OpenCtrlC відкритий, прозорий і готовий до вашого звичного робочого процесу.",
    finalEyebrow: "OpenCtrlC",
    finalCta: "Почати",
    copyLabel: "Копіювати",
    copiedLabel: "Скопійовано",
    copyCommandLabel: "Копіювати команду",
  },
  no: {
    title: "OpenCtrlC — en åpen AI-kodeagent",
    description:
      "OpenCtrlC er en åpen AI-kodeagent for arbeidsflyter i terminalen og på skrivebordet. Velg modellleverandør og behold prosjektkonteksten nær deg.",
    announcement: "Åpen kildekode, lokal først og tilgjengelig på tre skrivebordsplattformer.",
    announcementLink: "Se nedlastinger",
    heroEyebrow: "En AI-kodeagent for deg som eier arbeidsflyten din",
    heroTitle: "Bygg med en agent som holder seg nær koden din.",
    heroBody:
      "OpenCtrlC hjelper deg å forstå en kodebase, gjøre endringer, kjøre kommandoer og kontrollere resultatet i én fokusert arbeidsflyt. Bruk terminalen eller skrivebordsappen med leverandøren du velger.",
    platformNote: "MIT-lisens",
    heroArtLabel: "OpenCtrlC-terminalforhåndsvisning",
    terminalStatus: "● tilkoblet",
    terminalUserLabel: "deg",
    terminalReady: "Klar til å jobbe i prosjektet ditt.",
    terminalPrompt: "Finn det tryggeste stedet å legge til denne funksjonen.",
    terminalResponse: "Jeg undersøker først prosjektstrukturen og følger det eksisterende mønsteret.",
    terminalProgress: "4 filer undersøkt · kontekst klar",
    heroArtCaption: "En fokusert loop fra spørsmål til endring.",
    primaryCta: "Last ned OpenCtrlC",
    secondaryCta: "Les dokumentasjonen",
    installLabel: "Start i terminalen",
    installHint: "Installasjonsskriptet finner operativsystem og arkitektur automatisk.",
    installTitle: "Installer én gang. Behold arbeidsflyten.",
    workflowTitle: "Én prosjektkontekst. To måter å jobbe på.",
    workflowBody: "Bytt mellom en rask terminalloop og en rolig skrivebordsflate uten å miste viktig sesjonskontekst.",
    workflowEyebrow: "Slik passer det inn",
    workflows: [
      {
        label: "01 / Terminal",
        title: "Rask når tastaturet er nok.",
        body: "Still spørsmål, planlegg, rediger filer og kjør kommandoer fra en innebygd TUI.",
      },
      {
        label: "02 / Skrivebord",
        title: "Et klarere bilde av hele økten.",
        body: "Bruk et eget vindu til prosjektnavigasjon, økthistorikk og eksport av resultater.",
      },
      {
        label: "03 / Prosjekt",
        title: "Hold viktig kontekst synlig.",
        body: "Jobb med lokale prosjektfiler og inspiser kontekst, verktøy og resultatet bak hvert steg.",
      },
    ],
    featuresTitle: "De nyttige delene er synlige.",
    featuresBody:
      "OpenCtrlC fokuserer på det som gjør en agent pålitelig: vite hva den ser, bevare historikken og gjøre resultatet lett å ta med.",
    featuresEyebrow: "Bygget for tillit",
    features: [
      {
        label: "Kontekst",
        title: "Forstå før du endrer.",
        body: "Se systemprompt, Skills og kontekstbruk når du trenger å vite hvorfor agenten oppfører seg slik.",
      },
      {
        label: "Økter",
        title: "Fortsett uten å starte på nytt.",
        body: "Naviger i historikken, søk i turer, skjul ferdig aktivitet og hold samtalen lesbar.",
      },
      {
        label: "Resultat",
        title: "Ta resultatet med deg.",
        body: "Eksporter et Markdown-sammendrag, en full transkripsjon eller strukturert JSON.",
      },
      {
        label: "Plattformer",
        title: "Bruk maskinen du allerede har.",
        body: "Pipeline publiserer CLI- og Desktop-pakker for macOS, Windows og Linux, med x64 og arm64 der det støttes.",
      },
    ],
    docsCta: "Utforsk dokumentasjonen",
    downloadCta: "Se alle nedlastinger",
    faqTitle: "Noen klare svar.",
    faqEyebrow: "Vanlige spørsmål",
    faq: [
      {
        question: "Hva er OpenCtrlC?",
        answer:
          "OpenCtrlC er en uavhengig vedlikeholdt åpen AI-kodeagent. Den tilbyr terminal- og skrivebordsflyter for å utforske prosjekter, redigere filer, kjøre kommandoer og kontrollere endringer.",
      },
      {
        question: "Trenger jeg en OpenCtrlC-konto eller et abonnement?",
        answer:
          "Nei. OpenCtrlC krever ikke et modellabonnement driftet av OpenCtrlC. Konfigurer leverandøren og legitimasjonen som passer arbeidsflyten din.",
      },
      {
        question: "Hvor sendes koden min?",
        answer:
          "OpenCtrlC arbeider med det lokale prosjektet og sender forespørsler til leverandøren du konfigurerer. Sjekk leverandørens datapolicy og del økter bare når du ønsker det.",
      },
      {
        question: "Hvilke systemer støttes?",
        answer:
          "CLI-pakker publiseres for macOS, Windows og Linux. Skrivebordsinstallatører publiseres for alle tre med x64- og arm64-mål.",
      },
    ],
    finalTitle: "Gjør neste kodebase enklere å jobbe med.",
    finalBody: "OpenCtrlC er åpen, etterprøvbar og klar for arbeidsflyten du allerede bruker.",
    finalEyebrow: "OpenCtrlC",
    finalCta: "Kom i gang",
    copyLabel: "Kopier",
    copiedLabel: "Kopiert",
    copyCommandLabel: "Kopier kommando",
  },
  br: {
    title: "OpenCtrlC — um agente de programação com IA de código aberto",
    description:
      "OpenCtrlC é um agente de programação com IA de código aberto para fluxos de trabalho no terminal e no desktop. Escolha seu provedor de modelos e mantenha o contexto do projeto por perto.",
    announcement: "Código aberto, local por padrão e disponível em três plataformas desktop.",
    announcementLink: "Ver downloads",
    heroEyebrow: "Um agente de programação com IA para quem controla o próprio fluxo de trabalho",
    heroTitle: "Desenvolva com um agente que fica perto do seu código.",
    heroBody:
      "O OpenCtrlC ajuda você a entender uma base de código, fazer alterações, executar comandos e revisar o resultado em um fluxo focado. Use o terminal ou o aplicativo desktop com o provedor que escolher.",
    platformNote: "Licença MIT",
    heroArtLabel: "Prévia do terminal do OpenCtrlC",
    terminalStatus: "● conectado",
    terminalUserLabel: "você",
    terminalReady: "Pronto para trabalhar no seu projeto.",
    terminalPrompt: "Encontre o lugar mais seguro para adicionar este recurso.",
    terminalResponse: "Vou verificar primeiro a estrutura do projeto e seguir o padrão existente.",
    terminalProgress: "4 arquivos verificados · contexto pronto",
    heroArtCaption: "Um ciclo focado da pergunta à alteração.",
    primaryCta: "Baixar OpenCtrlC",
    secondaryCta: "Ler a documentação",
    installLabel: "Comece no terminal",
    installHint: "O script de instalação detecta o sistema operacional e a arquitetura automaticamente.",
    installTitle: "Instale uma vez. Mantenha seu fluxo.",
    workflowTitle: "Um contexto de projeto. Duas formas de trabalhar.",
    workflowBody:
      "Alterne entre um ciclo rápido no terminal e um espaço desktop tranquilo sem perder o contexto importante da sessão.",
    workflowEyebrow: "Como se encaixa",
    workflows: [
      {
        label: "01 / Terminal",
        title: "Rápido quando só o teclado basta.",
        body: "Faça perguntas, planeje, edite arquivos e execute comandos em uma TUI nativa.",
      },
      {
        label: "02 / Desktop",
        title: "Uma visão mais clara da sessão inteira.",
        body: "Use uma janela dedicada para navegar no projeto, consultar o histórico e exportar resultados.",
      },
      {
        label: "03 / Projeto",
        title: "Mantenha o contexto importante visível.",
        body: "Trabalhe com os arquivos locais e inspecione o contexto, as ferramentas e a saída de cada etapa.",
      },
    ],
    featuresTitle: "As partes úteis ficam visíveis.",
    featuresBody:
      "O OpenCtrlC é construído em torno do que torna um agente confiável: saber o que ele vê, preservar o histórico e facilitar o uso do resultado.",
    featuresEyebrow: "Feito para gerar confiança",
    features: [
      {
        label: "Contexto",
        title: "Entenda antes de alterar.",
        body: "Inspecione o prompt do sistema, as Skills e o uso de contexto quando precisar entender o comportamento do agente.",
      },
      {
        label: "Sessões",
        title: "Retome sem começar de novo.",
        body: "Navegue pelo histórico, pesquise turnos, recolha atividades concluídas e mantenha a conversa legível.",
      },
      {
        label: "Saída",
        title: "Leve o resultado com você.",
        body: "Exporte um resumo em Markdown, uma transcrição completa ou JSON estruturado para suas ferramentas.",
      },
      {
        label: "Plataformas",
        title: "Use a máquina que você já tem.",
        body: "O pipeline publica pacotes CLI e Desktop para macOS, Windows e Linux, incluindo x64 e arm64 quando compatível.",
      },
    ],
    docsCta: "Explorar a documentação",
    downloadCta: "Ver todos os downloads",
    faqTitle: "Algumas respostas claras.",
    faqEyebrow: "Perguntas frequentes",
    faq: [
      {
        question: "O que é o OpenCtrlC?",
        answer:
          "OpenCtrlC é um agente de programação com IA de código aberto mantido de forma independente. Ele oferece fluxos de terminal e desktop para explorar projetos, editar arquivos, executar comandos e revisar alterações.",
      },
      {
        question: "Preciso de uma conta ou assinatura do OpenCtrlC?",
        answer:
          "Não. O OpenCtrlC não exige uma assinatura de modelos hospedada pelo OpenCtrlC. Configure o provedor e as credenciais adequados ao seu fluxo.",
      },
      {
        question: "Para onde meu código vai?",
        answer:
          "O OpenCtrlC trabalha com seu projeto local e envia solicitações ao provedor configurado. Consulte a política de dados dele e compartilhe sessões apenas quando quiser.",
      },
      {
        question: "Quais sistemas são compatíveis?",
        answer:
          "Pacotes CLI são publicados para macOS, Windows e Linux. Instaladores Desktop são publicados para as três plataformas com destinos x64 e arm64.",
      },
    ],
    finalTitle: "Deixe a próxima base de código mais fácil de trabalhar.",
    finalBody: "OpenCtrlC é aberto, inspecionável e pronto para o fluxo que você já usa.",
    finalEyebrow: "OpenCtrlC",
    finalCta: "Começar",
    copyLabel: "Copiar",
    copiedLabel: "Copiado",
    copyCommandLabel: "Copiar comando",
  },
  tr: {
    title: "OpenCtrlC — açık kaynaklı yapay zekâ kodlama aracısı",
    description:
      "OpenCtrlC, terminal ve masaüstü iş akışları için açık kaynaklı bir yapay zekâ kodlama aracısıdır. Model sağlayıcınızı seçin ve proje bağlamını yakınınızda tutun.",
    announcement: "Açık kaynaklı, yerel öncelikli ve üç masaüstü platformunda kullanılabilir.",
    announcementLink: "İndirmeleri gör",
    heroEyebrow: "İş akışını kendisi yönetmek isteyenler için yapay zekâ kodlama aracısı",
    heroTitle: "Kodunuzdan uzaklaşmayan bir aracıyla geliştirin.",
    heroBody:
      "OpenCtrlC kod tabanını anlamanıza, değişiklik yapmanıza, komut çalıştırmanıza ve sonucu tek bir odaklı iş akışında incelemenize yardımcı olur. Seçtiğiniz sağlayıcıyla terminali veya masaüstü uygulamasını kullanın.",
    platformNote: "MIT lisansı",
    heroArtLabel: "OpenCtrlC terminal önizlemesi",
    terminalStatus: "● bağlı",
    terminalUserLabel: "siz",
    terminalReady: "Projenizde çalışmaya hazır.",
    terminalPrompt: "Bu özelliği eklemek için en güvenli yeri bul.",
    terminalResponse: "Önce proje yapısını inceleyip mevcut deseni takip edeceğim.",
    terminalProgress: "4 dosya incelendi · bağlam hazır",
    heroArtCaption: "Sorudan değişikliğe odaklı bir döngü.",
    primaryCta: "OpenCtrlC indir",
    secondaryCta: "Belgeleri oku",
    installLabel: "Terminalde başla",
    installHint: "Kurulum betiği işletim sisteminizi ve mimarinizi otomatik algılar.",
    installTitle: "Bir kez kurun. İş akışınızı koruyun.",
    workflowTitle: "Tek proje bağlamı. İki çalışma şekli.",
    workflowBody:
      "Önemli oturum bağlamını kaybetmeden hızlı terminal döngüsü ile sakin masaüstü çalışma alanı arasında geçiş yapın.",
    workflowEyebrow: "İş akışına nasıl uyar",
    workflows: [
      {
        label: "01 / Terminal",
        title: "Klavye yeterliyse hızlı olun.",
        body: "Yerel bir TUI üzerinden soru sorun, planlayın, dosya düzenleyin ve komut çalıştırın.",
      },
      {
        label: "02 / Masaüstü",
        title: "Oturumun tamamını daha net görün.",
        body: "Proje gezintisi, oturum geçmişi ve dışa aktarma için özel bir pencere kullanın.",
      },
      {
        label: "03 / Proje",
        title: "Önemli bağlamı incelenebilir tutun.",
        body: "Yerel proje dosyalarıyla çalışın ve her adımın bağlamını, araçlarını ve çıktısını inceleyin.",
      },
    ],
    featuresTitle: "Yararlı kısımlar görünür kalır.",
    featuresBody:
      "OpenCtrlC, bir aracıyı güvenilir yapan anlara odaklanır: ne gördüğünü bilmek, geçmişi korumak ve sonucu yanınıza alabilmek.",
    featuresEyebrow: "Güven için tasarlandı",
    features: [
      {
        label: "Bağlam",
        title: "Değiştirmeden önce anlayın.",
        body: "Aracının neden böyle davrandığını anlamak için sistem istemini, Skills'i ve bağlam kullanımını inceleyin.",
      },
      {
        label: "Oturumlar",
        title: "Sıfırdan başlamadan dönün.",
        body: "Oturum geçmişinde gezinin, turlarda arama yapın, tamamlanan etkinlikleri daraltın ve konuşmayı okunabilir tutun.",
      },
      {
        label: "Çıktı",
        title: "Sonucu yanınıza alın.",
        body: "Kendi araçlarınız için Markdown özeti, tam döküm veya yapılandırılmış JSON dışa aktarın.",
      },
      {
        label: "Platformlar",
        title: "Zaten sahip olduğunuz makineyi kullanın.",
        body: "Yayın hattı macOS, Windows ve Linux için CLI ve Desktop paketleri yayımlar; desteklenen yerlerde x64 ve arm64 dahildir.",
      },
    ],
    docsCta: "Belgeleri keşfet",
    downloadCta: "Tüm indirmeleri gör",
    faqTitle: "Birkaç net cevap.",
    faqEyebrow: "SSS",
    faq: [
      {
        question: "OpenCtrlC nedir?",
        answer:
          "OpenCtrlC bağımsız olarak sürdürülen açık kaynaklı bir yapay zekâ kodlama aracısıdır. Projeleri incelemek, dosyaları düzenlemek, komut çalıştırmak ve değişiklikleri gözden geçirmek için terminal ve masaüstü iş akışları sunar.",
      },
      {
        question: "OpenCtrlC hesabına veya aboneliğine ihtiyacım var mı?",
        answer:
          "Hayır. OpenCtrlC tarafından barındırılan bir model aboneliği gerekmez. İş akışınıza uygun sağlayıcıyı ve kimlik bilgilerini yapılandırın.",
      },
      {
        question: "Kodum nereye gider?",
        answer:
          "OpenCtrlC yerel projeniz üzerinde çalışır ve istekleri yapılandırdığınız sağlayıcıya gönderir. Sağlayıcının veri politikasını inceleyin ve oturumları yalnızca isteyerek paylaşın.",
      },
      {
        question: "Hangi sistemler destekleniyor?",
        answer:
          "CLI paketleri macOS, Windows ve Linux için yayımlanır. Desktop kurulumları üç platformda x64 ve arm64 hedefleriyle sunulur.",
      },
    ],
    finalTitle: "Bir sonraki kod tabanınızla çalışmayı kolaylaştırın.",
    finalBody: "OpenCtrlC açık kaynaklı, incelenebilir ve kullandığınız iş akışına hazırdır.",
    finalEyebrow: "OpenCtrlC",
    finalCta: "Başlayın",
    copyLabel: "Kopyala",
    copiedLabel: "Kopyalandı",
    copyCommandLabel: "Komutu kopyala",
  },
  th: {
    title: "OpenCtrlC — เอเจนต์เขียนโค้ด AI แบบโอเพนซอร์ส",
    description:
      "OpenCtrlC คือเอเจนต์เขียนโค้ด AI แบบโอเพนซอร์สสำหรับการทำงานบนเทอร์มินัลและเดสก์ท็อป เลือกผู้ให้บริการโมเดลของคุณและเก็บบริบทของโปรเจกต์ไว้ใกล้ตัว",
    announcement: "โอเพนซอร์ส, ให้ความสำคัญกับการทำงานในเครื่อง และรองรับเดสก์ท็อปสามแพลตฟอร์ม",
    announcementLink: "ดูรายการดาวน์โหลด",
    heroEyebrow: "เอเจนต์เขียนโค้ด AI สำหรับคนที่ควบคุมเวิร์กโฟลว์ของตัวเอง",
    heroTitle: "สร้างงานด้วยเอเจนต์ที่อยู่ใกล้โค้ดของคุณ",
    heroBody:
      "OpenCtrlC ช่วยให้คุณทำความเข้าใจโค้ดเบส แก้ไขไฟล์ รันคำสั่ง และตรวจสอบผลลัพธ์ในเวิร์กโฟลว์เดียวที่มีสมาธิ ใช้ผ่านเทอร์มินัลหรือแอปเดสก์ท็อปกับผู้ให้บริการที่คุณเลือก",
    platformNote: "สัญญาอนุญาต MIT",
    heroArtLabel: "ตัวอย่างเทอร์มินัล OpenCtrlC",
    terminalStatus: "● เชื่อมต่อแล้ว",
    terminalUserLabel: "คุณ",
    terminalReady: "พร้อมทำงานในโปรเจกต์ของคุณ",
    terminalPrompt: "ค้นหาจุดที่ปลอดภัยที่สุดในการเพิ่มฟีเจอร์นี้",
    terminalResponse: "ฉันจะตรวจสอบโครงสร้างโปรเจกต์และติดตามรูปแบบเดิมก่อน",
    terminalProgress: "ตรวจสอบ 4 ไฟล์แล้ว · บริบทพร้อม",
    heroArtCaption: "ลูปการทำงานที่มีสมาธิ ตั้งแต่คำถามจนถึงการแก้ไข",
    primaryCta: "ดาวน์โหลด OpenCtrlC",
    secondaryCta: "อ่านเอกสาร",
    installLabel: "เริ่มจากเทอร์มินัล",
    installHint: "สคริปต์ติดตั้งจะตรวจหาระบบปฏิบัติการและสถาปัตยกรรมโดยอัตโนมัติ",
    installTitle: "ติดตั้งครั้งเดียว รักษาเวิร์กโฟลว์ของคุณ",
    workflowTitle: "บริบทโปรเจกต์เดียว สองวิธีทำงาน",
    workflowBody: "สลับระหว่างลูปเทอร์มินัลที่รวดเร็วและพื้นที่ทำงานบนเดสก์ท็อป โดยไม่เสียบริบทสำคัญของเซสชัน",
    workflowEyebrow: "ทำงานร่วมกับคุณอย่างไร",
    workflows: [
      {
        label: "01 / เทอร์มินัล",
        title: "เร็วเมื่อคุณต้องการแค่คีย์บอร์ด",
        body: "ถามคำถาม วางแผน แก้ไขไฟล์ และรันคำสั่งจาก TUI แบบเนทีฟ",
      },
      {
        label: "02 / เดสก์ท็อป",
        title: "เห็นภาพรวมของเซสชันชัดขึ้น",
        body: "ใช้หน้าต่างเฉพาะสำหรับนำทางโปรเจกต์ ประวัติเซสชัน และการส่งออกผลลัพธ์",
      },
      {
        label: "03 / โปรเจกต์",
        title: "ทำให้บริบทสำคัญตรวจสอบได้",
        body: "ทำงานกับไฟล์ในเครื่องและตรวจสอบบริบท เครื่องมือ และผลลัพธ์ของแต่ละขั้นตอน",
      },
    ],
    featuresTitle: "ส่วนที่มีประโยชน์ยังคงมองเห็นได้",
    featuresBody:
      "OpenCtrlC สร้างขึ้นโดยเน้นสิ่งที่ทำให้เอเจนต์น่าเชื่อถือ: รู้ว่ามองเห็นอะไร เก็บประวัติ และนำผลลัพธ์ไปใช้ต่อได้ง่าย",
    featuresEyebrow: "ออกแบบมาเพื่อความไว้วางใจ",
    features: [
      {
        label: "บริบท",
        title: "ทำความเข้าใจก่อนเปลี่ยนแปลง",
        body: "ตรวจสอบ system prompt, Skills และการใช้บริบทเมื่อต้องการรู้ว่าเอเจนต์ทำงานเช่นนั้นเพราะอะไร",
      },
      {
        label: "เซสชัน",
        title: "กลับมาทำงานต่อโดยไม่เริ่มใหม่",
        body: "นำทางประวัติ ค้นหาแต่ละเทิร์น ยุบกิจกรรมที่เสร็จแล้ว และรักษาความอ่านง่ายของบทสนทนา",
      },
      {
        label: "ผลลัพธ์",
        title: "นำผลลัพธ์ติดตัวไปด้วย",
        body: "ส่งออกสรุป Markdown, ทรานสคริปต์เต็ม หรือ JSON แบบมีโครงสร้างสำหรับเครื่องมือของคุณ",
      },
      {
        label: "แพลตฟอร์ม",
        title: "ใช้เครื่องที่คุณมีอยู่แล้ว",
        body: "ไปป์ไลน์เผยแพร่แพ็กเกจ CLI และ Desktop สำหรับ macOS, Windows และ Linux รวมถึง x64 และ arm64 เมื่อรองรับ",
      },
    ],
    docsCta: "สำรวจเอกสาร",
    downloadCta: "ดูรายการดาวน์โหลดทั้งหมด",
    faqTitle: "คำตอบที่ชัดเจนบางส่วน",
    faqEyebrow: "คำถามที่พบบ่อย",
    faq: [
      {
        question: "OpenCtrlC คืออะไร",
        answer:
          "OpenCtrlC คือเอเจนต์เขียนโค้ด AI แบบโอเพนซอร์สที่ดูแลอย่างอิสระ มีเวิร์กโฟลว์บนเทอร์มินัลและเดสก์ท็อปสำหรับสำรวจโปรเจกต์ แก้ไขไฟล์ รันคำสั่ง และตรวจสอบการเปลี่ยนแปลง",
      },
      {
        question: "ต้องมีบัญชีหรือการสมัครสมาชิก OpenCtrlC ไหม",
        answer:
          "ไม่ต้อง OpenCtrlC ไม่บังคับให้ใช้บริการโมเดลที่โฮสต์โดย OpenCtrlC เพียงกำหนดค่าผู้ให้บริการและข้อมูลรับรองที่เหมาะกับเวิร์กโฟลว์ของคุณ",
      },
      {
        question: "โค้ดของฉันถูกส่งไปที่ไหน",
        answer:
          "OpenCtrlC ทำงานกับโปรเจกต์ในเครื่องและส่งคำขอไปยังผู้ให้บริการที่คุณกำหนดค่าไว้ ตรวจสอบนโยบายข้อมูลของผู้ให้บริการ และใช้การแชร์เซสชันเมื่อคุณตั้งใจเท่านั้น",
      },
      {
        question: "รองรับระบบใดบ้าง",
        answer:
          "มีแพ็กเกจ CLI สำหรับ macOS, Windows และ Linux ส่วนตัวติดตั้ง Desktop เผยแพร่สำหรับทั้งสามแพลตฟอร์ม โดยมีเป้าหมาย x64 และ arm64",
      },
    ],
    finalTitle: "ทำให้โค้ดเบสถัดไปของคุณทำงานได้ง่ายขึ้น",
    finalBody: "OpenCtrlC เป็นโอเพนซอร์ส ตรวจสอบได้ และพร้อมกับเวิร์กโฟลว์ที่คุณใช้อยู่",
    finalEyebrow: "OpenCtrlC",
    finalCta: "เริ่มต้นใช้งาน",
    copyLabel: "คัดลอก",
    copiedLabel: "คัดลอกแล้ว",
    copyCommandLabel: "คัดลอกคำสั่ง",
  },
  ar: {
    title: "OpenCtrlC — وكيل برمجة بالذكاء الاصطناعي مفتوح المصدر",
    description:
      "OpenCtrlC هو وكيل برمجة بالذكاء الاصطناعي مفتوح المصدر للعمل في الطرفية وسطح المكتب. اختر مزود النماذج الذي تريده واحتفظ بسياق المشروع قريباً منك.",
    announcement: "مفتوح المصدر، محلي أولاً، ومتاح على ثلاث منصات لسطح المكتب.",
    announcementLink: "عرض التنزيلات",
    heroEyebrow: "وكيل برمجة بالذكاء الاصطناعي لمن يريد التحكم في سير عمله",
    heroTitle: "طوّر باستخدام وكيل يبقى قريباً من شفرتك.",
    heroBody:
      "يساعدك OpenCtrlC على فهم قاعدة الشفرة وإجراء التغييرات وتشغيل الأوامر ومراجعة النتيجة ضمن سير عمل واحد واضح. استخدم الطرفية أو تطبيق سطح المكتب مع المزود الذي تختاره.",
    platformNote: "ترخيص MIT",
    heroArtLabel: "معاينة طرفية OpenCtrlC",
    terminalStatus: "● متصل",
    terminalUserLabel: "أنت",
    terminalReady: "جاهز للعمل في مشروعك.",
    terminalPrompt: "اعثر على المكان الأكثر أماناً لإضافة هذه الميزة.",
    terminalResponse: "سأفحص بنية المشروع أولاً وأتتبع النمط الموجود.",
    terminalProgress: "تم فحص 4 ملفات · السياق جاهز",
    heroArtCaption: "حلقة مركزة من السؤال إلى التغيير.",
    primaryCta: "تنزيل OpenCtrlC",
    secondaryCta: "قراءة الوثائق",
    installLabel: "ابدأ من الطرفية",
    installHint: "يكتشف برنامج التثبيت نظام التشغيل والمعمارية تلقائياً.",
    installTitle: "ثبّت مرة واحدة. واحتفظ بسير عملك.",
    workflowTitle: "سياق مشروع واحد. طريقتان للعمل.",
    workflowBody: "انتقل بين حلقة الطرفية السريعة ومساحة سطح المكتب الهادئة دون فقدان سياق الجلسة المهم.",
    workflowEyebrow: "كيف ينسجم معك",
    workflows: [
      {
        label: "01 / الطرفية",
        title: "سريع عندما تكون لوحة المفاتيح كافية.",
        body: "اطرح الأسئلة وخطط وعدّل الملفات وشغّل الأوامر من واجهة TUI أصلية.",
      },
      {
        label: "02 / سطح المكتب",
        title: "رؤية أوضح للجلسة كاملة.",
        body: "استخدم نافذة مخصصة للتنقل في المشروع وسجل الجلسة وتصدير النتائج.",
      },
      {
        label: "03 / المشروع",
        title: "أبقِ السياق المهم قابلاً للفحص.",
        body: "اعمل على ملفات مشروعك المحلية وافحص السياق والأدوات والمخرجات خلف كل خطوة.",
      },
    ],
    featuresTitle: "تبقى الأجزاء المفيدة ظاهرة.",
    featuresBody:
      "صُمم OpenCtrlC حول ما يجعل الوكيل موثوقاً: معرفة ما يراه، والحفاظ على السجل، وسهولة أخذ النتيجة معك.",
    featuresEyebrow: "مصمم للثقة",
    features: [
      {
        label: "السياق",
        title: "افهم قبل أن تغيّر.",
        body: "افحص موجه النظام وSkills واستخدام السياق عندما تريد معرفة سبب سلوك الوكيل.",
      },
      {
        label: "الجلسات",
        title: "عد إلى العمل دون البدء من جديد.",
        body: "تنقل في السجل وابحث في الأدوار واطوِ النشاط المكتمل وحافظ على وضوح المحادثة.",
      },
      {
        label: "المخرجات",
        title: "خذ النتيجة معك.",
        body: "صدّر ملخص Markdown أو نصاً كاملاً أو JSON منظماً لأدواتك وسجلاتك.",
      },
      {
        label: "المنصات",
        title: "استخدم الجهاز الذي تملكه.",
        body: "ينشر خط الإصدار حزم CLI وDesktop لنظام macOS وWindows وLinux، مع x64 وarm64 حيثما كان ذلك مدعوماً.",
      },
    ],
    docsCta: "استكشف الوثائق",
    downloadCta: "عرض كل التنزيلات",
    faqTitle: "بعض الإجابات الواضحة.",
    faqEyebrow: "الأسئلة الشائعة",
    faq: [
      {
        question: "ما هو OpenCtrlC؟",
        answer:
          "OpenCtrlC هو وكيل برمجة بالذكاء الاصطناعي مفتوح المصدر تتم صيانته بشكل مستقل. يوفر سير عمل في الطرفية وسطح المكتب لاستكشاف المشاريع وتعديل الملفات وتشغيل الأوامر ومراجعة التغييرات.",
      },
      {
        question: "هل أحتاج إلى حساب أو اشتراك OpenCtrlC؟",
        answer:
          "لا. لا يتطلب OpenCtrlC اشتراكاً في نماذج مستضافة من OpenCtrlC. اضبط مزود النماذج وبيانات الاعتماد المناسبة لسير عملك.",
      },
      {
        question: "إلى أين تنتقل شفراتي؟",
        answer:
          "يعمل OpenCtrlC على مشروعك المحلي ويرسل الطلبات إلى المزود الذي تضبطه. راجع سياسة البيانات الخاصة به، ولا تشارك الجلسات إلا عندما تقصد ذلك.",
      },
      {
        question: "ما الأنظمة المدعومة؟",
        answer:
          "تُنشر حزم CLI لنظام macOS وWindows وLinux. تُنشر مثبتات سطح المكتب للمنصات الثلاث مع أهداف x64 وarm64.",
      },
    ],
    finalTitle: "اجعل قاعدة شفرتك التالية أسهل في العمل.",
    finalBody: "OpenCtrlC مفتوح المصدر وقابل للفحص وجاهز لسير العمل الذي تستخدمه الآن.",
    finalEyebrow: "OpenCtrlC",
    finalCta: "ابدأ الآن",
    copyLabel: "نسخ",
    copiedLabel: "تم النسخ",
    copyCommandLabel: "نسخ الأمر",
  },
}

function CopyButton(props: { value: string; label: string; copiedLabel: string; ariaLabel: string }) {
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
    <button
      type="button"
      data-component="copy-button"
      data-copied={copied()}
      onClick={copy}
      aria-label={props.ariaLabel}
    >
      <span>{copied() ? props.copiedLabel : props.label}</span>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M5.5 5.5V3.75C5.5 3.06 6.06 2.5 6.75 2.5H12.25C12.94 2.5 13.5 3.06 13.5 3.75V9.25C13.5 9.94 12.94 10.5 12.25 10.5H10.5"
          stroke="currentColor"
          stroke-width="1.25"
        />
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
  const copy = () => {
    const locale = language.locale()
    if (locale in COPY) return COPY[locale]
    return { ...COPY.en, ...LOCALIZED_COPY[locale] }
  }
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
              <div data-slot="platform-note" aria-label={copy().platformNote}>
                <span>macOS</span>
                <span>Windows</span>
                <span>Linux</span>
                <span>·</span>
                <span>{copy().platformNote}</span>
              </div>
            </div>

            <div data-slot="hero-art" aria-label={copy().heroArtLabel}>
              <div data-component="terminal-window">
                <div data-slot="window-bar">
                  <span data-slot="window-dots">
                    <i></i>
                    <i></i>
                    <i></i>
                  </span>
                  <span>openctrlc · ~/project</span>
                  <span data-slot="window-status">{copy().terminalStatus}</span>
                </div>
                <div data-slot="terminal-body">
                  <p>
                    <span data-slot="muted">›</span> <span data-slot="accent">openctrlc</span>
                  </p>
                  <p data-slot="muted">{copy().terminalReady}</p>
                  <p class="terminal-gap">
                    <span data-slot="prompt">{copy().terminalUserLabel}</span> {copy().terminalPrompt}
                  </p>
                  <p data-slot="muted">{copy().terminalResponse}</p>
                  <div data-slot="terminal-progress">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <p class="terminal-gap">
                    <span data-slot="prompt">openctrlc</span> {copy().terminalProgress}
                  </p>
                  <p data-slot="cursor">
                    <span>▌</span>
                  </p>
                </div>
              </div>
              <div data-slot="hero-art-caption">{copy().heroArtCaption}</div>
            </div>
          </section>

          <section data-component="install-card">
            <div data-slot="section-kicker">{copy().installLabel}</div>
            <div data-slot="install-copy">
              <h2>{copy().installTitle}</h2>
              <p>{copy().installHint}</p>
            </div>
            <div data-component="command">
              <code>{installCommand}</code>
              <CopyButton
                value={installCommand}
                label={copy().copyLabel}
                copiedLabel={copy().copiedLabel}
                ariaLabel={copy().copyCommandLabel}
              />
            </div>
          </section>

          <section data-component="workflow" id="workflow">
            <div data-slot="section-heading">
              <p data-slot="eyebrow">{copy().workflowEyebrow}</p>
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
              <p data-slot="eyebrow">{copy().featuresEyebrow}</p>
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
              <p data-slot="eyebrow">{copy().faqEyebrow}</p>
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
            <p data-slot="eyebrow">{copy().finalEyebrow}</p>
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

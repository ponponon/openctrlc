import "./index.css"
import { Meta, Title } from "@solidjs/meta"
import { A } from "@solidjs/router"
import { createSignal, For } from "solid-js"
import { Footer } from "~/component/footer"
import { Header } from "~/component/header"
import { Legal } from "~/component/legal"
import { LocaleLinks } from "~/component/locale-links"
import { useI18n } from "~/context/i18n"
import { useLanguage } from "~/context/language"
import type { Locale } from "~/lib/language"

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

const COPY: Pick<Record<Locale, Copy>, "en" | "zh"> = {
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
}

const LOCALIZED_COPY: Pick<Record<Locale, Partial<Copy>>, "ja" | "ko"> = {
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
  const i18n = useI18n()
  const language = useLanguage()
  const copy = () => {
    const locale = language.locale()
    if (locale === "en" || locale === "zh") return COPY[locale]
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

          <section data-component="support" id="support">
            <div data-slot="support-copy">
              <p data-slot="eyebrow">{i18n.t("home.support.eyebrow")}</p>
              <h2>{i18n.t("home.support.title")}</h2>
              <p>{i18n.t("home.support.body")}</p>
            </div>
            <figure data-slot="support-figure">
              <img
                src="/wechat-appreciate.jpg"
                alt={i18n.t("home.support.alt")}
                width="1152"
                height="1152"
                loading="lazy"
                decoding="async"
              />
              <figcaption>{i18n.t("home.support.caption")}</figcaption>
            </figure>
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

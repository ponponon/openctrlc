# OpenCtrlC

OpenCode を基盤に開発した、デスクトップとリモートアクセスを強化するオープンソースの AI コーディングエージェントです。

OpenCtrlC は [OpenCode](https://github.com/anomalyco/opencode) を基盤とする、独立してメンテナンスされているフォークです。OpenCode の AI コーディング機能を活かしながら、日常的に使いやすいデスクトップ体験、見やすいセッション管理、複数デバイスからのリモートアクセスを提供するために開発しています。

## OpenCtrlC を開発する理由

OpenCode は AI を活用したコーディングの強固な基盤です。OpenCtrlC はその上に、デスクトップでの操作性、セッションの把握しやすさ、デバイスをまたいだ作業環境を加えています。

- **より充実したデスクトップワークフロー** — macOS、Windows、Linux のネイティブアプリに加え、CLI と TUI も利用できます。デスクトップと CLI はローカルのプロジェクトおよびセッションを共有し、セッション検索、ターン移動、コンテキスト確認、Token 使用量・コスト・時間の可視化に対応します。
- **スマートフォンからワークスペースにアクセス** — QR コードでペアリングし、デスクトップでブラウザーを承認すると、スマートフォンから現在のワークスペースを開けます。デスクトップからリレーへ接続するため、PC のポートをインターネットに公開する必要はありません。通信はエンドツーエンド暗号化ではなく、リレー運営者は転送中の内容を確認できます。
- **作業の透明性とモデル選択** — ツール呼び出し、ファイル変更、コマンド結果を確認できます。用途に合うモデルプロバイダーやローカルモデルを選び、プロジェクトのルールや Skills を作業中に参照できます。
- **OpenCode セッションとの互換性** — 読みやすい会話記録をエクスポートし、互換性のある OpenCode セッションを ID でインポートできます。

OpenCode は技術的な基盤です。OpenCtrlC は独自のデスクトップ体験、リモートワークフロー、製品方針、リリースプロセスを開発しています。OpenCode チームとの提携や承認を意味するものではありません。

## まずはこちら

- [公式サイト](https://openctrlc.pages.dev/)
- [ドキュメント](https://openctrlc.pages.dev/docs/)
- [ダウンロード](https://openctrlc.pages.dev/download/) · [GitHub Releases](https://github.com/ponponon/openctrlc/releases)
- [GitHub Discussions](https://github.com/ponponon/openctrlc/discussions)

## インストール

### CLI / TUI

インストールスクリプトは現在の OS と CPU アーキテクチャを検出します。

```bash
curl -fsSL https://raw.githubusercontent.com/ponponon/openctrlc/dev/install | bash
```

Node.js と npm がある場合は、npm で CLI をグローバルインストールできます。

```bash
npm install -g openctrlc
```

以前の npm パッケージ名から移行する場合は、先に `npm uninstall -g openctrlc-ai` を実行してください。

macOS と Linux では、OpenCtrlC の Homebrew tap からもインストールできます。

```bash
brew install ponponon/tap/openctrlc
```

この Formula は OpenCtrlC の tap で管理されており、`homebrew/core` には含まれません。

### デスクトップ

最新のインストーラーは [ダウンロードページ](https://openctrlc.pages.dev/download/)から入手できます。

| プラットフォーム | アーキテクチャ | 形式                |
| ---------------- | -------------- | ------------------- |
| macOS            | Apple Silicon  | DMG, ZIP            |
| Windows          | x64, ARM64     | NSIS インストーラー |
| Linux            | x64, ARM64     | DEB, AppImage, RPM  |

デスクトップアプリと CLI は同じローカルプロジェクトおよびセッションを使用します。デスクトップパッケージには対象プラットフォーム用の CLI バイナリが含まれます。

## データとモデルプロバイダー

OpenCtrlC はホスト型モデルサービスではありません。アプリケーションはローカルで動作し、設定したプロバイダーへリクエストを送信します。データの保存、料金、利用規約は選択したプロバイダーに従います。

共有機能は明示的に選択した場合だけ使用します。共有サービスを利用しない場合は、プロジェクト設定で無効にできます。

## 開発

```bash
bun install
bun run dev
bun run dev:console
bun run dev:desktop
```

変更を確認するには、ルートからではなく各パッケージで次のコマンドを実行します。

```bash
bun run --cwd packages/console/app typecheck
bun run --cwd packages/console/app build
bun run --cwd packages/web build
```

貢献する場合は [CONTRIBUTING.md](./CONTRIBUTING.md) と [リリース手順](./docs/release.md) を確認してください。

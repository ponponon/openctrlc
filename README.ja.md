# OpenCtrlC

ターミナルとデスクトップで使える、オープンソースの AI コーディングエージェントです。プロジェクトを調査し、ファイルを編集し、コマンドを実行し、変更内容を確認できます。利用するモデルとプロバイダーは自分で選べます。

## まずはこちら

- [公式サイト](https://openctrlc.pages.dev/)
- [ドキュメント](https://openctrlc.pages.dev/docs/)
- [ダウンロード](https://github.com/ponponon/openctrlc/releases)
- [GitHub Discussions](https://github.com/ponponon/openctrlc/discussions)

## インストール

### CLI / TUI

インストールスクリプトは現在の OS と CPU アーキテクチャを検出します。

```bash
curl -fsSL https://raw.githubusercontent.com/ponponon/openctrlc/dev/install | bash
```

または npm / Bun からインストールできます。

```bash
npm install --global openctrlc-ai
# bun add --global openctrlc-ai
```

### デスクトップ

最新のインストーラーは [GitHub Releases](https://github.com/ponponon/openctrlc/releases) からダウンロードしてください。

| プラットフォーム | アーキテクチャ | 形式                |
| ---------------- | -------------- | ------------------- |
| macOS            | Apple Silicon  | DMG, ZIP            |
| Windows          | x64, ARM64     | NSIS インストーラー |
| Linux            | x64, ARM64     | DEB, AppImage, RPM  |

## OpenCtrlC の特徴

- ターミナルとネイティブデスクトップの同じセッションモデル
- OpenAI、Anthropic、Google、ローカルモデルなど、選択したプロバイダーに接続
- プロジェクトのルールと Skills を確認しながら作業
- セッション検索、ターン間の移動、コンテキスト確認
- ツール呼び出し、生成された変更、コマンド結果を追跡可能
- セッションのエクスポートと、互換性のある OpenCode セッションのインポート

## データとモデルプロバイダー

OpenCtrlC はホスト型モデルサービスではありません。アプリケーションはローカルで動作し、設定したプロバイダーへリクエストを送信します。データの保存、料金、利用規約は選択したプロバイダーに従います。

共有機能は明示的に選択した場合だけ使用してください。共有サービスを利用しない場合は、プロジェクト設定で無効にできます。

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

OpenCtrlC は [OpenCode](https://github.com/anomalyco/opencode) を基盤とする、独立してメンテナンスされているフォークです。OpenCode チームとの提携や承認を意味するものではありません。

貢献する場合は [CONTRIBUTING.md](./CONTRIBUTING.md) と [リリース手順](./docs/release.md) を確認してください。

# OpenCtrlC

OpenCode를 기반으로 개발한 오픈 소스 AI 코딩 에이전트로, 데스크톱과 원격 작업 흐름을 강화합니다.

OpenCtrlC는 [OpenCode](https://github.com/anomalyco/opencode)를 기반으로 독립적으로 유지 관리되는 포크입니다. OpenCode의 AI 코딩 기능을 바탕으로 일상적인 작업에 더 편리한 데스크톱 경험, 보기 쉬운 세션 관리, 여러 기기에서의 원격 접근을 제공하기 위해 개발하고 있습니다.

## OpenCtrlC를 만드는 이유

OpenCode는 AI 코딩을 위한 탄탄한 기반입니다. OpenCtrlC는 그 위에 데스크톱 사용성, 세션을 쉽게 파악하는 도구, 여러 기기에서 이어서 작업할 수 있는 환경을 더합니다.

- **더 풍부한 데스크톱 작업 흐름** — macOS, Windows, Linux용 네이티브 앱과 CLI, TUI를 함께 제공합니다. 데스크톱과 CLI는 로컬 프로젝트 및 세션 모델을 공유하며, 세션 검색, 턴 이동, 컨텍스트 확인, 토큰 사용량·비용·시간의 시각적 분석을 지원합니다.
- **휴대폰에서 작업 공간에 접근** — QR 코드로 페어링하고 데스크톱에서 브라우저를 승인하면 휴대폰에서 현재 작업 공간을 열 수 있습니다. 데스크톱이 릴레이에 아웃바운드 연결을 시작하므로 컴퓨터의 포트를 외부에 공개할 필요가 없습니다. 전송은 종단 간 암호화가 아니며 릴레이 운영자가 전달 중인 내용을 확인할 수 있습니다.
- **투명한 작업 과정과 모델 선택** — 도구 호출, 파일 변경, 명령 결과를 확인할 수 있습니다. 필요에 맞는 모델 제공자나 로컬 모델을 선택하고 프로젝트 규칙과 Skills를 코드 작업에 활용할 수 있습니다.
- **OpenCode 세션 호환** — 읽기 쉬운 대화 기록을 내보내고 호환되는 OpenCode 세션을 ID로 가져올 수 있습니다.

OpenCode는 기술 기반입니다. OpenCtrlC는 자체 데스크톱 경험, 원격 작업 흐름, 제품 방향, 릴리스 절차를 개발합니다. OpenCode 팀과의 제휴나 승인을 의미하지 않습니다.

## 먼저 보기

- [공식 웹사이트](https://openctrlc.pages.dev/)
- [문서](https://openctrlc.pages.dev/docs/)
- [다운로드](https://openctrlc.pages.dev/download/) · [GitHub Releases](https://github.com/ponponon/openctrlc/releases)
- [GitHub Discussions](https://github.com/ponponon/openctrlc/discussions)

## 설치

### CLI / TUI

설치 스크립트가 현재 운영체제와 CPU 아키텍처를 감지합니다.

```bash
curl -fsSL https://raw.githubusercontent.com/ponponon/openctrlc/dev/install | bash
```

Node.js와 npm이 설치되어 있다면 npm으로 CLI를 전역 설치할 수도 있습니다.

```bash
npm install -g openctrlc
```

이전 npm 패키지 이름에서 마이그레이션하려면 먼저 `npm uninstall -g openctrlc-ai`를 실행하세요.

macOS와 Linux에서는 OpenCtrlC Homebrew tap으로도 설치할 수 있습니다.

```bash
brew install ponponon/tap/openctrlc
```

이 Formula는 OpenCtrlC의 tap에서 관리하며 `homebrew/core`에는 포함되어 있지 않습니다.

### 데스크톱

최신 설치 파일은 [다운로드 페이지](https://openctrlc.pages.dev/download/)에서 받을 수 있습니다.

| 플랫폼  | 아키텍처      | 형식               |
| ------- | ------------- | ------------------ |
| macOS   | Apple Silicon | DMG, ZIP           |
| Windows | x64, ARM64    | NSIS 설치 프로그램 |
| Linux   | x64, ARM64    | DEB, AppImage, RPM |

데스크톱 앱과 CLI는 동일한 로컬 프로젝트 및 세션 모델을 사용합니다. 데스크톱 패키지에는 대상 플랫폼에 맞는 CLI 바이너리가 포함됩니다.

## 데이터와 모델 프로바이더

OpenCtrlC는 호스팅 모델 서비스가 아닙니다. 애플리케이션은 로컬에서 실행되며 설정한 프로바이더로 요청을 전송합니다. 데이터 보관, 요금, 이용 약관은 선택한 프로바이더의 정책이 적용됩니다.

공유 기능은 사용자가 명시적으로 선택한 경우에만 사용합니다. 공유 서비스를 사용하지 않을 때는 프로젝트 설정에서 비활성화할 수 있습니다.

## 개발

```bash
bun install
bun run dev
bun run dev:console
bun run dev:desktop
```

변경 사항을 확인할 때는 저장소 루트가 아니라 각 패키지에서 다음 명령을 실행합니다.

```bash
bun run --cwd packages/console/app typecheck
bun run --cwd packages/console/app build
bun run --cwd packages/web build
```

기여하려면 [CONTRIBUTING.md](./CONTRIBUTING.md)와 [릴리스 절차](./docs/release.md)를 먼저 확인하세요.

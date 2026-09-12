# OpenCtrlC

터미널과 데스크톱에서 사용할 수 있는 오픈 소스 AI 코딩 에이전트입니다. 프로젝트를 탐색하고, 파일을 수정하고, 명령을 실행하고, 변경 사항을 검토할 수 있습니다. 사용할 모델과 프로바이더는 직접 선택합니다.

## 먼저 보기

- [공식 웹사이트](https://openctrlc.pages.dev/)
- [문서](https://openctrlc.pages.dev/docs/)
- [다운로드](https://github.com/ponponon/openctrlc/releases)
- [GitHub Discussions](https://github.com/ponponon/openctrlc/discussions)

## 설치

### CLI / TUI

설치 스크립트가 현재 운영체제와 CPU 아키텍처를 감지합니다.

```bash
curl -fsSL https://raw.githubusercontent.com/ponponon/openctrlc/dev/install | bash
```

또는 npm / Bun으로 설치할 수 있습니다.

```bash
npm install --global openctrlc-ai
# bun add --global openctrlc-ai
```

### 데스크톱

최신 설치 파일은 [GitHub Releases](https://github.com/ponponon/openctrlc/releases)에서 다운로드하세요.

| 플랫폼  | 아키텍처      | 형식               |
| ------- | ------------- | ------------------ |
| macOS   | Apple Silicon | DMG, ZIP           |
| Windows | x64, ARM64    | NSIS 설치 프로그램 |
| Linux   | x64, ARM64    | DEB, AppImage, RPM |

## OpenCtrlC의 주요 기능

- 터미널과 네이티브 데스크톱에서 동일한 세션 모델 사용
- OpenAI, Anthropic, Google, 로컬 모델 등 원하는 프로바이더 연결
- 프로젝트 규칙과 Skills를 확인하면서 작업
- 세션 검색, 턴 이동, 컨텍스트 확인
- 도구 호출, 생성된 변경 사항, 명령 결과를 투명하게 검토
- 세션 내보내기와 호환되는 OpenCode 세션 가져오기

## 데이터와 모델 프로바이더

OpenCtrlC는 호스팅 모델 서비스가 아닙니다. 애플리케이션은 로컬에서 실행되며 설정한 프로바이더로 요청을 전송합니다. 데이터 보관, 요금, 이용 약관은 선택한 프로바이더의 정책이 적용됩니다.

공유 기능은 사용자가 명시적으로 선택한 경우에만 사용하세요. 공유 서비스를 사용하지 않을 때는 프로젝트 설정에서 비활성화할 수 있습니다.

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

OpenCtrlC는 [OpenCode](https://github.com/anomalyco/opencode)를 기반으로 독립적으로 유지 관리되는 포크입니다. OpenCode 팀과의 제휴나 승인을 의미하지 않습니다.

기여하려면 [CONTRIBUTING.md](./CONTRIBUTING.md)와 [릴리스 절차](./docs/release.md)를 먼저 확인하세요.

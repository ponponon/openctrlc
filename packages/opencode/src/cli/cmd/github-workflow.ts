export function renderGitHubWorkflow(input: {
  provider: string
  model: string
  secrets?: ReadonlyArray<string>
}) {
  const env = input.secrets?.length
    ? `\n        env:\n${input.secrets.map((name) => `          ${name}: \${{ secrets.${name} }}`).join("\n")}`
    : ""

  return `name: openctrlc

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

jobs:
  openctrlc:
    if: |
      contains(github.event.comment.body, ' /oc') ||
      startsWith(github.event.comment.body, '/oc') ||
      contains(github.event.comment.body, ' /openctrlc') ||
      startsWith(github.event.comment.body, '/openctrlc')
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
      pull-requests: read
      issues: read
    steps:
      - name: Checkout repository
        uses: actions/checkout@v6
        with:
          persist-credentials: false

      - name: Run OpenCtrlC
        uses: ponponon/openctrlc/github@latest${env}
        with:
          model: ${input.provider}/${input.model}
`
}

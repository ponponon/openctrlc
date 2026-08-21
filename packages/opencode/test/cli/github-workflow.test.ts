import { expect, test } from "bun:test"
import { parse } from "yaml"
import { renderGitHubWorkflow } from "../../src/cli/cmd/github-workflow"

test("renders a valid OpenCtrlC workflow with OpenCtrlC triggers", () => {
  const source = renderGitHubWorkflow({ provider: "anthropic", model: "claude-sonnet", secrets: ["ANTHROPIC_API_KEY"] })
  const workflow = parse(source) as {
    name: string
    jobs: Record<string, { if: string; steps: Array<{ uses?: string; env?: Record<string, string> }> }>
  }

  expect(workflow.name).toBe("openctrlc")
  expect(workflow.jobs.openctrlc.if).toContain("/openctrlc")
  expect(workflow.jobs.openctrlc.if).toContain("/oc")
  expect(workflow.jobs.openctrlc.steps).toHaveLength(2)
  expect(workflow.jobs.openctrlc.steps[1]?.uses).toBe("ponponon/openctrlc/github@latest")
  expect(workflow.jobs.openctrlc.steps[1]?.env).toEqual({ ANTHROPIC_API_KEY: "${{ secrets.ANTHROPIC_API_KEY }}" })
  expect(source).not.toContain("/opencode")
})

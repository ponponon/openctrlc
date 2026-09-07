import { describe, expect, test } from "bun:test"
import type { SkillListOutput } from "@opencode-ai/client/promise"
import { groupSkills } from "./skill-groups"

type Skill = SkillListOutput["data"][number]

const skill = (name: string, location: string) =>
  ({ name, location, description: `${name} description`, content: `${name} content` }) as Skill

describe("groupSkills", () => {
  test("groups skills from the same package together", () => {
    expect(
      groupSkills([
        skill("brainstorming", "/cache/superpowers/skills/brainstorming/SKILL.md"),
        skill("writing-plans", "/cache/superpowers/skills/writing-plans/SKILL.md"),
        skill("customize-opencode", "<built-in>"),
      ]),
    ).toEqual([
      {
        id: "builtin",
        location: "<built-in>",
        name: "Built-in",
        skills: [skill("customize-opencode", "<built-in>")],
      },
      {
        id: "source:/cache/superpowers/skills",
        location: "/cache/superpowers/skills",
        name: "superpowers",
        skills: [
          skill("brainstorming", "/cache/superpowers/skills/brainstorming/SKILL.md"),
          skill("writing-plans", "/cache/superpowers/skills/writing-plans/SKILL.md"),
        ],
      },
    ])
  })

  test("keeps external skill roots separate when they do not have a package name", () => {
    expect(
      groupSkills([
        skill("global", "/Users/test/.agents/skills/global/SKILL.md"),
        skill("project", "/Users/test/project/.claude/skills/project/SKILL.md"),
      ]).map((group) => group.name),
    ).toEqual([".agents/skills", ".claude/skills"])
  })

  test("groups scoped node modules by the complete package name", () => {
    expect(
      groupSkills([
        skill("one", "/project/node_modules/@acme/tool/skills/one/SKILL.md"),
        skill("two", "/project/node_modules/@acme/tool/skills/two/SKILL.md"),
      ]),
    ).toEqual([
      {
        id: "package:/project/node_modules/@acme/tool",
        location: "/project/node_modules/@acme/tool",
        name: "@acme/tool",
        skills: [
          skill("one", "/project/node_modules/@acme/tool/skills/one/SKILL.md"),
          skill("two", "/project/node_modules/@acme/tool/skills/two/SKILL.md"),
        ],
      },
    ])
  })
})

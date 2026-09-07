import type { SkillListOutput } from "@opencode-ai/client/promise"

export type AvailableSkill = SkillListOutput["data"][number]

export type SkillGroup = {
  id: string
  name: string
  skills: AvailableSkill[]
}

export function groupSkills(skills: readonly AvailableSkill[]) {
  const groups = new Map<string, SkillGroup>()

  for (const skill of skills) {
    const group = getSkillGroup(skill)
    const existing = groups.get(group.id)
    if (existing) {
      existing.skills.push(skill)
      continue
    }
    groups.set(group.id, { ...group, skills: [skill] })
  }

  return Array.from(groups.values()).toSorted((a, b) => {
    if (a.id === "builtin") return -1
    if (b.id === "builtin") return 1
    return a.name.localeCompare(b.name)
  })
}

function getSkillGroup(skill: AvailableSkill) {
  if (skill.location === "<built-in>") return { id: "builtin", name: "Built-in" }

  const parts = normalizeLocation(skill.location).split("/").filter(Boolean)
  const nodeModulesIndex = parts.lastIndexOf("node_modules")
  if (nodeModulesIndex >= 0 && parts[nodeModulesIndex + 1]) {
    const packageName = parts[nodeModulesIndex + 1].startsWith("@")
      ? `${parts[nodeModulesIndex + 1]}/${parts[nodeModulesIndex + 2] ?? ""}`
      : parts[nodeModulesIndex + 1]
    if (packageName) return { id: `package:${packageName}`, name: packageName }
  }

  const skillsIndex = Math.max(parts.lastIndexOf("skills"), parts.lastIndexOf("skill"))
  if (skillsIndex > 0) {
    const owner = parts[skillsIndex - 1]
    if (owner && !owner.startsWith(".")) return { id: `source:${owner}`, name: owner }
    return { id: `source:${parts.slice(skillsIndex - 1, skillsIndex + 1).join("/")}`, name: `${owner}/skills` }
  }

  const parent = parts.at(-2) ?? "skills"
  return { id: `directory:${parent}`, name: parent }
}

function normalizeLocation(location: string) {
  return location.replaceAll("\\", "/")
}

import type { SkillListOutput } from "@opencode-ai/client/promise"

export type AvailableSkill = SkillListOutput["data"][number]

export type SkillGroup = {
  id: string
  location: string
  name: string
  skills: AvailableSkill[]
}

export function groupSkills(skills: readonly AvailableSkill[]) {
  const groups = new Map<string, SkillGroup>()

  skills.forEach((skill) => {
    const group = getSkillGroup(skill)
    const existing = groups.get(group.id)
    if (existing) {
      existing.skills.push(skill)
      return
    }
    groups.set(group.id, { ...group, skills: [skill] })
  })

  return Array.from(groups.values()).toSorted((a, b) => {
    if (a.id === "builtin") return -1
    if (b.id === "builtin") return 1
    return a.name.localeCompare(b.name)
  })
}

function getSkillGroup(skill: AvailableSkill) {
  if (skill.location === "<built-in>") return { id: "builtin", name: "Built-in", location: "<built-in>" }

  const location = normalizeLocation(skill.location)
  const parts = location.split("/").filter(Boolean)
  const nodeModulesIndex = parts.lastIndexOf("node_modules")
  if (nodeModulesIndex >= 0 && parts[nodeModulesIndex + 1]) {
    const packageParts = parts[nodeModulesIndex + 1].startsWith("@")
      ? parts.slice(nodeModulesIndex + 1, nodeModulesIndex + 3)
      : parts.slice(nodeModulesIndex + 1, nodeModulesIndex + 2)
    const packageName =
      packageParts.length === 2 && packageParts[0].startsWith("@") ? packageParts.join("/") : packageParts[0]
    if (packageName) {
      const packageLocation = toLocation(location, parts.slice(0, nodeModulesIndex + packageParts.length + 1))
      return { id: `package:${packageLocation}`, name: packageName, location: packageLocation }
    }
  }

  const skillsIndex = Math.max(parts.lastIndexOf("skills"), parts.lastIndexOf("skill"))
  if (skillsIndex > 0) {
    const owner = parts[skillsIndex - 1]
    const sourceLocation = toLocation(location, parts.slice(0, skillsIndex + 1))
    if (owner && !owner.startsWith("."))
      return { id: `source:${sourceLocation}`, name: owner, location: sourceLocation }
    return { id: `source:${sourceLocation}`, name: `${owner}/skills`, location: sourceLocation }
  }

  const parentParts = parts.slice(0, -1)
  const parent = parentParts.at(-1) ?? "skills"
  const parentLocation = toLocation(location, parentParts)
  return { id: `directory:${parentLocation}`, name: parent, location: parentLocation }
}

function normalizeLocation(location: string) {
  return location.replaceAll("\\", "/")
}

function toLocation(location: string, parts: string[]) {
  const prefix = location.startsWith("/") ? "/" : ""
  return `${prefix}${parts.join("/")}`
}

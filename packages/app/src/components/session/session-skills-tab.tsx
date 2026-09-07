import { useFilteredList } from "@openctrlc/ui/hooks"
import { ButtonV2 } from "@openctrlc/ui/v2/button-v2"
import { Tag } from "@openctrlc/ui/v2/badge-v2"
import { Icon as IconV2 } from "@openctrlc/ui/v2/icon"
import { TextInputV2 } from "@openctrlc/ui/v2/text-input-v2"
import { createQuery } from "@tanstack/solid-query"
import { For, Show, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useSDK } from "@/context/sdk"
import { useServerSync } from "@/context/server-sync"
import { useSessionLayout } from "@/pages/session/session-layout"
import { pathKey } from "@/utils/path-key"
import { groupSkills, type AvailableSkill, type SkillGroup } from "@/utils/skill-groups"
import { summarizeSessionSkills } from "@/utils/session-skills"
import "./session-skills-tab.css"

export function SessionSkillsTab() {
  const language = useLanguage()
  const sdk = useSDK()
  const serverSync = useServerSync()
  const { params } = useSessionLayout()
  const [store, setStore] = createStore({
    expanded: {} as Record<string, boolean>,
    groupExpanded: {} as Record<string, boolean>,
  })

  const directory = createMemo(() => sdk().directory)
  const skillsQuery = createQuery(() => {
    const value = directory()
    if (value) return serverSync().queryOptions.skills(pathKey(value))
    return {
      ...serverSync().queryOptions.skills(pathKey("")),
      enabled: false,
    }
  })

  const available = createMemo(() => skillsQuery.data ?? [])
  const used = createMemo(() => {
    const sessionID = params.id
    if (!sessionID) return []
    const messages = serverSync().session.data.session_message[sessionID] ?? []
    const parts = Object.values(serverSync().session.data.part)
      .flat()
      .filter((part) => part.sessionID === sessionID)
    return summarizeSessionSkills({ messages, parts })
  })

  const list = useFilteredList<AvailableSkill>({
    items: available,
    key: (skill) => skill.name,
    filterKeys: ["name", "description", "location"],
    sortBy: (a, b) => a.name.localeCompare(b.name),
  })
  const groups = createMemo(() => groupSkills(list.flat()))

  const isUsed = (skill: AvailableSkill) => used().some((item) => item.id === skill.name || item.name === skill.name)
  const sourceLabel = (location: string) =>
    location === "<built-in>"
      ? language.t("settings.skills.source.builtin")
      : language.t("settings.skills.source.project")
  const toggleExpanded = (name: string) => setStore("expanded", name, !store.expanded[name])
  const isGroupExpanded = (group: SkillGroup) =>
    store.groupExpanded[group.id] ?? (!!list.filter() || group.skills.length <= 4)
  const toggleGroupExpanded = (group: SkillGroup) => setStore("groupExpanded", group.id, !isGroupExpanded(group))

  return (
    <div class="session-skills-tab">
      <div class="session-skills-header">
        <div class="session-skills-heading-row">
          <div>
            <h2 class="session-skills-title">{language.t("settings.skills.title")}</h2>
            <p class="session-skills-description">{language.t("settings.skills.description")}</p>
          </div>
          <Show when={directory() && !skillsQuery.isLoading}>
            <Tag variant="accent">{available().length}</Tag>
          </Show>
        </div>
        <TextInputV2
          type="search"
          appearance="base"
          class="session-skills-search-input"
          value={list.filter()}
          onInput={(event) => list.onInput(event.currentTarget.value)}
          placeholder={language.t("settings.skills.search.placeholder")}
          leadingIcon={<IconV2 name="magnifying-glass" size="small" />}
          showClearButton={!!list.filter()}
          clearLabel={language.t("settings.skills.search.placeholder")}
          onClearClick={() => list.clear()}
          spellcheck={false}
          autocorrect="off"
          autocomplete="off"
          autocapitalize="off"
          aria-label={language.t("settings.skills.search.placeholder")}
        />
      </div>

      <div class="session-skills-scroll">
        <Show when={params.id}>
          <section class="session-skills-section">
            <div class="session-skills-section-heading">
              <h3>{language.t("settings.skills.section.session")}</h3>
              <Tag>{used().length}</Tag>
            </div>
            <Show
              when={used().length > 0}
              fallback={<div class="session-skills-empty">{language.t("settings.skills.session.empty")}</div>}
            >
              <div class="session-skills-list">
                <For each={used()}>
                  {(skill) => (
                    <div class="session-skills-used-row">
                      <div class="session-skills-copy">
                        <span class="session-skills-name">{skill.name}</span>
                        <span class="session-skills-muted">{language.t("settings.skills.session.used")}</span>
                      </div>
                      <Tag variant="accent">{skill.count}</Tag>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </section>
        </Show>

        <section class="session-skills-section">
          <div class="session-skills-section-heading session-skills-section-heading--description">
            <div>
              <h3>{language.t("settings.skills.section.available")}</h3>
              <p>{language.t("settings.skills.section.available.description")}</p>
            </div>
          </div>
          <Show
            when={directory()}
            fallback={<div class="session-skills-empty">{language.t("settings.skills.noProject")}</div>}
          >
            <Show
              when={!skillsQuery.isLoading}
              fallback={
                <div class="session-skills-status">
                  {language.t("common.loading")}
                  {language.t("common.loading.ellipsis")}
                </div>
              }
            >
              <Show
                when={!skillsQuery.isError}
                fallback={
                  <div class="session-skills-status">
                    <span>{language.t("settings.skills.load.error")}</span>
                    <ButtonV2 variant="ghost" size="small" onClick={() => void skillsQuery.refetch()}>
                      {language.t("settings.skills.action.retry")}
                    </ButtonV2>
                  </div>
                }
              >
                <Show
                  when={groups().length > 0}
                  fallback={
                    <div class="session-skills-empty">
                      <span>
                        {list.filter()
                          ? language.t("settings.skills.empty.filter")
                          : language.t("settings.skills.empty.available")}
                      </span>
                      <Show when={list.filter()}>
                        <span class="session-skills-filter">&quot;{list.filter()}&quot;</span>
                      </Show>
                    </div>
                  }
                >
                  <div class="session-skills-list">
                    <For each={groups()}>
                      {(group) => {
                        const groupExpanded = () => isGroupExpanded(group)
                        return (
                          <div class="session-skills-group" data-expanded={groupExpanded() ? "" : undefined}>
                            <button
                              type="button"
                              class="session-skills-group-header"
                              aria-expanded={groupExpanded()}
                              onClick={() => toggleGroupExpanded(group)}
                            >
                              <span class="session-skills-group-copy">
                                <span class="session-skills-group-name">{group.name}</span>
                                <span class="session-skills-group-source">{sourceLabel(group.skills[0].location)}</span>
                              </span>
                              <span class="session-skills-group-actions">
                                <Tag>{group.skills.length}</Tag>
                                <IconV2 name="chevron-down" size="small" />
                              </span>
                            </button>
                            <Show when={groupExpanded()}>
                              <div class="session-skills-group-list">
                                <For each={group.skills}>
                                  {(skill) => {
                                    const expanded = () => store.expanded[skill.name]
                                    return (
                                      <div class="session-skills-row" data-expanded={expanded() ? "" : undefined}>
                                        <div class="session-skills-copy session-skills-main">
                                          <div class="session-skills-title-row">
                                            <span class="session-skills-name">{skill.name}</span>
                                            <Show when={isUsed(skill)}>
                                              <Tag variant="accent">{language.t("settings.skills.tag.used")}</Tag>
                                            </Show>
                                          </div>
                                          <span class="session-skills-muted">
                                            {skill.description || language.t("settings.skills.description.missing")}
                                          </span>
                                        </div>
                                        <div class="session-skills-actions">
                                          <button
                                            type="button"
                                            class="session-skills-expand"
                                            aria-expanded={expanded()}
                                            aria-label={language.t(
                                              expanded()
                                                ? "settings.skills.action.collapse"
                                                : "settings.skills.action.expand",
                                            )}
                                            onClick={() => toggleExpanded(skill.name)}
                                          >
                                            <IconV2 name="chevron-down" size="small" />
                                          </button>
                                        </div>
                                        <Show when={expanded()}>
                                          <div class="session-skills-detail">
                                            <div>
                                              <span>{language.t("settings.skills.detail.location")}</span>
                                              <code>
                                                {skill.location || language.t("settings.skills.detail.unknownLocation")}
                                              </code>
                                            </div>
                                            <Show when={skill.slash}>
                                              <div>
                                                <span>{language.t("settings.skills.detail.slash")}</span>
                                                <code>/{skill.name}</code>
                                              </div>
                                            </Show>
                                          </div>
                                        </Show>
                                      </div>
                                    )
                                  }}
                                </For>
                              </div>
                            </Show>
                          </div>
                        )
                      }}
                    </For>
                  </div>
                </Show>
              </Show>
            </Show>
          </Show>
        </section>
      </div>
    </div>
  )
}

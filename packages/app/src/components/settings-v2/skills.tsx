import { useFilteredList } from "@openctrlc/ui/hooks"
import { ButtonV2 } from "@openctrlc/ui/v2/button-v2"
import { Tag } from "@openctrlc/ui/v2/badge-v2"
import { Icon as IconV2 } from "@openctrlc/ui/v2/icon"
import { IconButtonV2 } from "@openctrlc/ui/v2/icon-button-v2"
import { TextInputV2 } from "@openctrlc/ui/v2/text-input-v2"
import { createQuery } from "@tanstack/solid-query"
import { type Accessor, type Component, For, Show, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useServerSync } from "@/context/server-sync"
import { pathKey } from "@/utils/path-key"
import { groupSkills, type AvailableSkill, type SkillGroup } from "@/utils/skill-groups"
import { summarizeSessionSkills } from "@/utils/session-skills"
import { SettingsListV2 } from "./parts/list"
import "./settings-v2.css"

export const SettingsSkillsV2: Component<{
  directory: Accessor<string | undefined>
  sessionID?: string
}> = (props) => {
  const language = useLanguage()
  const serverSync = useServerSync()
  const [store, setStore] = createStore({
    expanded: {} as Record<string, boolean>,
    groupExpanded: {} as Record<string, boolean>,
  })
  const skillsQuery = createQuery(() => {
    const directory = props.directory()
    if (directory) return serverSync().queryOptions.skills(pathKey(directory))
    return {
      ...serverSync().queryOptions.skills(pathKey("")),
      enabled: false,
    }
  })

  const available = createMemo(() => skillsQuery.data ?? [])
  const used = createMemo(() => {
    if (!props.sessionID) return []
    const messages = serverSync().session.data.session_message[props.sessionID] ?? []
    const parts = Object.values(serverSync().session.data.part)
      .flat()
      .filter((part) => part.sessionID === props.sessionID)
    return summarizeSessionSkills({ messages, parts })
  })

  const list = useFilteredList<AvailableSkill>({
    items: () => available(),
    key: (skill) => skill.name,
    filterKeys: ["name", "description", "location"],
    sortBy: (a, b) => a.name.localeCompare(b.name),
  })
  const groups = createMemo(() => groupSkills(list.flat()))

  const isUsed = (skill: AvailableSkill) => used().some((item) => item.id === skill.name || item.name === skill.name)
  const toggleExpanded = (name: string) => setStore("expanded", name, !store.expanded[name])
  const sourceLabel = (location: string) =>
    location === "<built-in>"
      ? language.t("settings.skills.source.builtin")
      : language.t("settings.skills.source.project")
  const isGroupExpanded = (group: SkillGroup) =>
    store.groupExpanded[group.id] ?? (!!list.filter() || group.skills.length <= 4)
  const toggleGroupExpanded = (group: SkillGroup) => setStore("groupExpanded", group.id, !isGroupExpanded(group))

  return (
    <>
      <div class="settings-v2-tab-header settings-v2-tab-header--stacked">
        <div class="settings-v2-tab-header-row">
          <div class="settings-v2-skill-heading">
            <h2 class="settings-v2-tab-title">{language.t("settings.skills.title")}</h2>
            <p class="settings-v2-tab-description">{language.t("settings.skills.description")}</p>
          </div>
          <Show when={props.directory() && !skillsQuery.isLoading}>
            <Tag variant="accent">{available().length}</Tag>
          </Show>
        </div>
        <div class="settings-v2-tab-search">
          <TextInputV2
            type="search"
            appearance="base"
            value={list.filter()}
            onInput={(event) => list.onInput(event.currentTarget.value)}
            placeholder={language.t("settings.skills.search.placeholder")}
            spellcheck={false}
            autocorrect="off"
            autocomplete="off"
            autocapitalize="off"
            aria-label={language.t("settings.skills.search.placeholder")}
          />
          <Show when={list.filter()}>
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="small"
              class="settings-v2-tab-search-clear"
              icon={<IconV2 name="close" size="large" class="text-v2-icon-icon-muted" />}
              onClick={() => list.clear()}
            />
          </Show>
        </div>
      </div>

      <div class="settings-v2-tab-body settings-v2-skills">
        <Show when={props.sessionID}>
          <div class="settings-v2-section">
            <div class="settings-v2-skill-section-header">
              <h3 class="settings-v2-section-title">{language.t("settings.skills.section.session")}</h3>
              <Tag>{used().length}</Tag>
            </div>
            <Show
              when={used().length > 0}
              fallback={<div class="settings-v2-skill-empty">{language.t("settings.skills.session.empty")}</div>}
            >
              <SettingsListV2>
                <For each={used()}>
                  {(skill) => (
                    <div class="settings-v2-skill-used-row">
                      <div class="settings-v2-skill-copy">
                        <span class="settings-v2-skill-name">{skill.name}</span>
                        <span class="settings-v2-skill-description">{language.t("settings.skills.session.used")}</span>
                      </div>
                      <Tag variant="accent">{skill.count}</Tag>
                    </div>
                  )}
                </For>
              </SettingsListV2>
            </Show>
          </div>
        </Show>

        <div class="settings-v2-section">
          <div class="settings-v2-skill-section-header">
            <div>
              <h3 class="settings-v2-section-title">{language.t("settings.skills.section.available")}</h3>
              <p class="settings-v2-skill-section-description">
                {language.t("settings.skills.section.available.description")}
              </p>
            </div>
          </div>
          <Show
            when={props.directory()}
            fallback={<div class="settings-v2-skill-empty">{language.t("settings.skills.noProject")}</div>}
          >
            <Show
              when={!skillsQuery.isLoading}
              fallback={
                <div class="settings-v2-skill-status">
                  {language.t("common.loading")}
                  {language.t("common.loading.ellipsis")}
                </div>
              }
            >
              <Show
                when={!skillsQuery.isError}
                fallback={
                  <div class="settings-v2-skill-status">
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
                    <div class="settings-v2-skill-empty">
                      <span>
                        {list.filter()
                          ? language.t("settings.skills.empty.filter")
                          : language.t("settings.skills.empty.available")}
                      </span>
                      <Show when={list.filter()}>
                        <span class="settings-v2-skill-filter">&quot;{list.filter()}&quot;</span>
                      </Show>
                    </div>
                  }
                >
                  <SettingsListV2>
                    <For each={groups()}>
                      {(group) => {
                        const groupExpanded = () => isGroupExpanded(group)
                        return (
                          <div class="settings-v2-skill-group" data-expanded={groupExpanded() ? "" : undefined}>
                            <button
                              type="button"
                              class="settings-v2-skill-group-header"
                              aria-expanded={groupExpanded()}
                              onClick={() => toggleGroupExpanded(group)}
                            >
                              <span class="settings-v2-skill-group-copy">
                                <span class="settings-v2-skill-group-name">{group.name}</span>
                                <span class="settings-v2-skill-group-source">
                                  {sourceLabel(group.skills[0].location)}
                                </span>
                              </span>
                              <span class="settings-v2-skill-group-actions">
                                <Tag>{group.skills.length}</Tag>
                                <IconV2 name="chevron-down" size="small" />
                              </span>
                            </button>
                            <Show when={groupExpanded()}>
                              <div class="settings-v2-skill-group-list">
                                <For each={group.skills}>
                                  {(skill) => {
                                    const expanded = () => store.expanded[skill.name]
                                    return (
                                      <div class="settings-v2-skill-row" data-expanded={expanded() ? "" : undefined}>
                                        <div class="settings-v2-skill-main">
                                          <div class="settings-v2-skill-title-row">
                                            <span class="settings-v2-skill-name">{skill.name}</span>
                                            <Show when={isUsed(skill)}>
                                              <Tag variant="accent">{language.t("settings.skills.tag.used")}</Tag>
                                            </Show>
                                          </div>
                                          <span class="settings-v2-skill-description">
                                            {skill.description || language.t("settings.skills.description.missing")}
                                          </span>
                                        </div>
                                        <div class="settings-v2-skill-actions">
                                          <button
                                            type="button"
                                            class="settings-v2-skill-toggle"
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
                                          <div class="settings-v2-skill-detail">
                                            <div class="settings-v2-skill-detail-row">
                                              <span>{language.t("settings.skills.detail.location")}</span>
                                              <code>
                                                {skill.location || language.t("settings.skills.detail.unknownLocation")}
                                              </code>
                                            </div>
                                            <Show when={skill.slash}>
                                              <div class="settings-v2-skill-detail-row">
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
                  </SettingsListV2>
                </Show>
              </Show>
            </Show>
          </Show>
        </div>
      </div>
    </>
  )
}

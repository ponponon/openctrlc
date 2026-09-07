import { Tag } from "@openctrlc/ui/v2/badge-v2"
import { type Accessor, type Component, For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import type { ServerProtocol } from "@/utils/server-protocol"
import type { SkillGroup } from "@/utils/skill-groups"
import "./skill-runtime-info.css"

export const SkillRuntimeInfo: Component<{
  protocol: ServerProtocol | undefined
  groups: Accessor<readonly SkillGroup[]>
}> = (props) => {
  const language = useLanguage()

  const protocolLabel = () => {
    if (props.protocol === "v1") return language.t("settings.skills.runtime.v1")
    if (props.protocol === "v2") return language.t("settings.skills.runtime.v2")
    return language.t("settings.skills.runtime.detecting")
  }

  return (
    <div class="skill-runtime-info">
      <div class="skill-runtime-info-row">
        <span class="skill-runtime-info-label">{language.t("settings.skills.runtime.service")}</span>
        <div class="skill-runtime-info-value">
          <Tag variant="accent">{protocolLabel()}</Tag>
        </div>
      </div>
      <div class="skill-runtime-info-row skill-runtime-info-row--sources">
        <span class="skill-runtime-info-label">{language.t("settings.skills.runtime.sources")}</span>
        <div class="skill-runtime-info-value skill-runtime-info-sources">
          <Show
            when={props.groups().length > 0}
            fallback={<span class="skill-runtime-info-empty">{language.t("settings.skills.runtime.sources.empty")}</span>}
          >
            <For each={props.groups()}>
              {(group) => (
                <span class="skill-runtime-info-source">
                  <code>{group.location}</code>
                  <Tag>{group.skills.length}</Tag>
                </span>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  )
}

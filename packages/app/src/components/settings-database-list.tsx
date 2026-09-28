import type { Component, JSX } from "solid-js"
import { For } from "solid-js"
import { useLanguage } from "@/context/language"
import type { DesktopDatabaseFile } from "@/context/platform"
import { databasePurposeDescription, databasePurposeTitle, groupDatabaseFiles } from "@/utils/database-files"
import "./settings-database-list.css"

export const SettingsDatabaseList: Component<{
  files: DesktopDatabaseFile[]
  renderAction: (database: DesktopDatabaseFile) => JSX.Element
}> = (props) => {
  const language = useLanguage()

  return (
    <section class="settings-database-section">
      <h3 class="settings-database-section-title">{language.t("settings.general.section.localData")}</h3>
      <div class="settings-database-card">
        <For each={groupDatabaseFiles(props.files)}>
          {(group) => (
            <section class="settings-database-group">
              <header class="settings-database-group-heading">
                <h4 class="settings-database-group-title">{language.t(databasePurposeTitle[group.purpose])}</h4>
                <p class="settings-database-group-description">
                  {language.t(databasePurposeDescription[group.purpose])}
                </p>
              </header>
              <div class="settings-database-entries" role="list">
                <For each={group.databases}>
                  {(database) => (
                    <div class="settings-database-row" role="listitem">
                      <div class="settings-database-file-copy">
                        <span class="settings-database-file-name">{database.name}</span>
                        <code class="settings-database-file-path" dir="ltr" title={database.path}>
                          {database.path}
                        </code>
                      </div>
                      <div class="settings-database-action">{props.renderAction(database)}</div>
                    </div>
                  )}
                </For>
              </div>
            </section>
          )}
        </For>
      </div>
    </section>
  )
}

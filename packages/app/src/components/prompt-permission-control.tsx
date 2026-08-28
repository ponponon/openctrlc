import { Show } from "solid-js"
import { ButtonV2 } from "@openctrlc/ui/v2/button-v2"
import { Icon as IconV2 } from "@openctrlc/ui/v2/icon"
import { MenuV2 } from "@openctrlc/ui/v2/menu-v2"
import { TooltipV2 } from "@openctrlc/ui/v2/tooltip-v2"
import { useLanguage } from "@/context/language"
import { usePermission } from "@/context/permission"

export function PromptPermissionControl(props: { directory: string; visible?: boolean }) {
  const language = useLanguage()
  const permission = usePermission()
  const accepting = () => permission.isAutoAcceptingDirectory(props.directory)
  const actionLabel = () =>
    language.t(
      accepting() ? "prompt.permissions.autoaccept.disable" : "prompt.permissions.autoaccept.enable",
    )
  const toggle = () => {
    if (accepting()) {
      permission.disableAutoAcceptDirectory(props.directory)
      return
    }
    permission.enableAutoAcceptDirectory(props.directory)
  }

  return (
    <Show when={props.visible !== false && props.directory.length > 0}>
      <TooltipV2
        value={accepting() ? language.t("prompt.permissions.autoaccept.enabled") : actionLabel()}
        placement="top"
      >
        <MenuV2 placement="top-start" gutter={6} modal={false}>
          <MenuV2.Trigger
            as={ButtonV2}
            variant={accepting() ? "neutral" : "ghost-muted"}
            size="small"
            aria-label={language.t("prompt.permissions.autoaccept")}
            aria-pressed={accepting()}
          >
            <IconV2 name="settings-gear" size="small" />
          </MenuV2.Trigger>
          <MenuV2.Portal>
            <MenuV2.Content>
              <MenuV2.Item onSelect={toggle}>{actionLabel()}</MenuV2.Item>
            </MenuV2.Content>
          </MenuV2.Portal>
        </MenuV2>
      </TooltipV2>
    </Show>
  )
}

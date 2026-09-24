import type { Locale } from "~/lib/language"
import { dict as en } from "~/i18n/en"
import { dict as zh } from "~/i18n/zh"
import { dict as ja } from "~/i18n/ja"
import { dict as ko } from "~/i18n/ko"

export type Key = keyof typeof en
export type Dict = Record<Key, string>

const base = en satisfies Dict

export function i18n(locale: Locale): Dict {
  if (locale === "en") return base
  if (locale === "zh") return { ...base, ...zh }
  if (locale === "ja") return { ...base, ...ja }
  return { ...base, ...ko }
}

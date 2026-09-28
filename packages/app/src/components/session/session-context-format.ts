import { DateTime } from "luxon"

export function createSessionContextFormatter(locale: string) {
  return {
    number(value: number | null | undefined) {
      if (value === undefined) return "—"
      if (value === null) return "—"
      return value.toLocaleString(locale)
    },
    percent(value: number | null | undefined) {
      if (value === undefined) return "—"
      if (value === null) return "—"
      return value.toLocaleString(locale) + "%"
    },
    time(value: number | undefined) {
      if (!value) return "—"
      const date = DateTime.fromMillis(value).setLocale(locale)
      const now = DateTime.now()
      const time = { hour: "numeric", minute: "2-digit", second: "2-digit" } as const
      if (date.hasSame(now, "day")) return date.toLocaleString(time)
      if (date.hasSame(now, "month")) return date.toLocaleString({ day: "numeric", ...time })
      if (date.hasSame(now, "year")) return date.toLocaleString({ month: "short", day: "numeric", ...time })
      return date.toLocaleString({ year: "numeric", month: "short", day: "numeric", ...time })
    },
  }
}

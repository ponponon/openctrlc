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
      return date.toLocaleString(
        date.year === DateTime.now().year
          ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
          : DateTime.DATETIME_MED,
      )
    },
  }
}

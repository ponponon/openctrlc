import { Navigate } from "@solidjs/router"
import { useLanguage } from "~/context/language"

export default function Enterprise() {
  const language = useLanguage()
  return <Navigate href={language.route("/docs/enterprise")} />
}

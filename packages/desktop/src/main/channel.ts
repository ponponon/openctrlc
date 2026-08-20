export type Channel = "dev" | "beta" | "prod"

export function resolveChannel(raw: string) {
  return raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"
}

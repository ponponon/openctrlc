import type { ServerConnection } from "@/context/server"
import { authTokenFromCredentials } from "./server"

export type ServerProtocol = "v1" | "v2"

type ProbeResult = { value: Record<string, unknown> } | { failure: string }
const protocolRetryDelays = [250, 500]
const protocolDetectionBudgetMs = 8_000
const protocolProbeTimeoutMs = 5_000

export class ServerProtocolDetectionError extends Error {
  readonly name = "ServerProtocolDetectionError"

  constructor(
    readonly v1Probe: string,
    readonly v2Probe: string,
  ) {
    super("SERVER_PROTOCOL_DETECTION_FAILED")
  }
}

function headers(server: ServerConnection.HttpBase) {
  if (!server.password) return
  return {
    Authorization: `Basic ${authTokenFromCredentials({ username: server.username, password: server.password })}`,
  }
}

async function probe(
  server: ServerConnection.HttpBase,
  fetch: typeof globalThis.fetch,
  path: string,
  timeoutMs: number,
): Promise<ProbeResult> {
  try {
    const response = await fetch(new URL(path, server.url), {
      headers: headers(server),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) return { failure: `http-${response.status}` } satisfies ProbeResult
    const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? ""
    if (!contentType.endsWith("/json") && !contentType.endsWith("+json"))
      return { failure: "non-json-response" } satisfies ProbeResult
    const value: unknown = await response.json().catch(() => undefined)
    if (!value || typeof value !== "object" || Array.isArray(value))
      return { failure: "invalid-json-response" } satisfies ProbeResult
    return { value: value as Record<string, unknown> } satisfies ProbeResult
  } catch (error) {
    const timedOut = error !== null && typeof error === "object" && "name" in error && error.name === "TimeoutError"
    return { failure: timedOut ? "timeout" : "request-error" } satisfies ProbeResult
  }
}

function isTransientProbeFailure(result: ProbeResult) {
  if ("value" in result) return false
  return result.failure === "timeout" || result.failure === "request-error" || /^http-5\d\d$/.test(result.failure)
}

function protocolFromProbes(legacy: ProbeResult, current: ProbeResult): ServerProtocol | undefined {
  if ("value" in legacy && legacy.value.healthy === true) return "v1"
  if ("value" in current && typeof current.value.pid === "number") return "v2"
  if ("value" in current && current.value.healthy === true) return "v1"
}

export async function detectServerProtocol(
  server: ServerConnection.HttpBase,
  fetch: typeof globalThis.fetch,
): Promise<ServerProtocol> {
  const deadline = Date.now() + protocolDetectionBudgetMs
  const attempt = async (index: number): Promise<ServerProtocol> => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      throw new ServerProtocolDetectionError("timeout", "timeout")
    }
    const timeoutMs = Math.max(1, Math.floor(Math.min(protocolProbeTimeoutMs, remaining)))
    const [legacy, current] = await Promise.all([
      probe(server, fetch, "/global/health", timeoutMs),
      probe(server, fetch, "/api/health", timeoutMs),
    ])
    const protocol = protocolFromProbes(legacy, current)
    if (protocol) return protocol
    const retryDelay = protocolRetryDelays[index]
    if (retryDelay !== undefined && [legacy, current].some(isTransientProbeFailure)) {
      const remaining = deadline - Date.now()
      if (remaining > retryDelay) {
        await new Promise<void>((resolve) => setTimeout(resolve, retryDelay))
        if (Date.now() < deadline) return attempt(index + 1)
      }
    }
    throw new ServerProtocolDetectionError(
      "failure" in legacy ? legacy.failure : "unrecognized-health-response",
      "failure" in current ? current.failure : "unrecognized-health-response",
    )
  }
  return attempt(0)
}

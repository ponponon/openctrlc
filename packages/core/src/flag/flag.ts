import { Config } from "effect"

export function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

const copy = process.env["OPENCTRLC_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
const fff = process.env["OPENCTRLC_DISABLE_FFF"]

function enabledByExperimental(key: string) {
  return process.env[key] === undefined ? truthy("OPENCTRLC_EXPERIMENTAL") : truthy(key)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  OPENCTRLC_AUTO_HEAP_SNAPSHOT: truthy("OPENCTRLC_AUTO_HEAP_SNAPSHOT"),
  OPENCTRLC_GIT_BASH_PATH: process.env["OPENCTRLC_GIT_BASH_PATH"],
  OPENCTRLC_CONFIG: process.env["OPENCTRLC_CONFIG"],
  OPENCTRLC_CONFIG_CONTENT: process.env["OPENCTRLC_CONFIG_CONTENT"],
  OPENCTRLC_DISABLE_AUTOUPDATE: truthy("OPENCTRLC_DISABLE_AUTOUPDATE"),
  OPENCTRLC_ALWAYS_NOTIFY_UPDATE: truthy("OPENCTRLC_ALWAYS_NOTIFY_UPDATE"),
  OPENCTRLC_DISABLE_PRUNE: truthy("OPENCTRLC_DISABLE_PRUNE"),
  OPENCTRLC_DISABLE_TERMINAL_TITLE: truthy("OPENCTRLC_DISABLE_TERMINAL_TITLE"),
  OPENCTRLC_SHOW_TTFD: truthy("OPENCTRLC_SHOW_TTFD"),
  OPENCTRLC_DISABLE_AUTOCOMPACT: truthy("OPENCTRLC_DISABLE_AUTOCOMPACT"),
  OPENCTRLC_DISABLE_MODELS_FETCH: truthy("OPENCTRLC_DISABLE_MODELS_FETCH"),
  OPENCTRLC_DISABLE_MOUSE: truthy("OPENCTRLC_DISABLE_MOUSE"),
  OPENCTRLC_FAKE_VCS: process.env["OPENCTRLC_FAKE_VCS"],
  OPENCTRLC_SERVER_PASSWORD: process.env["OPENCTRLC_SERVER_PASSWORD"],
  OPENCTRLC_SERVER_USERNAME: process.env["OPENCTRLC_SERVER_USERNAME"],
  OPENCTRLC_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthy("OPENCTRLC_DISABLE_FFF"),

  // Experimental
  OPENCTRLC_EXPERIMENTAL_FILEWATCHER: Config.boolean("OPENCTRLC_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  OPENCTRLC_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("OPENCTRLC_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  OPENCTRLC_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("OPENCTRLC_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  OPENCTRLC_MODELS_URL: process.env["OPENCTRLC_MODELS_URL"],
  OPENCTRLC_MODELS_PATH: process.env["OPENCTRLC_MODELS_PATH"],
  OPENCTRLC_DB: process.env["OPENCTRLC_DB"],

  OPENCTRLC_WORKSPACE_ID: process.env["OPENCTRLC_WORKSPACE_ID"],
  OPENCTRLC_EXPERIMENTAL_WORKSPACES: enabledByExperimental("OPENCTRLC_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get OPENCTRLC_DISABLE_PROJECT_CONFIG() {
    return truthy("OPENCTRLC_DISABLE_PROJECT_CONFIG")
  },
  get OPENCTRLC_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("OPENCTRLC_EXPERIMENTAL_REFERENCES")
  },
  get OPENCTRLC_TUI_CONFIG() {
    return process.env["OPENCTRLC_TUI_CONFIG"]
  },
  get OPENCTRLC_CONFIG_DIR() {
    return process.env["OPENCTRLC_CONFIG_DIR"]
  },
  get OPENCTRLC_PURE() {
    return truthy("OPENCTRLC_PURE")
  },
  get OPENCTRLC_PERMISSION() {
    return process.env["OPENCTRLC_PERMISSION"]
  },
  get OPENCTRLC_PLUGIN_META_FILE() {
    return process.env["OPENCTRLC_PLUGIN_META_FILE"]
  },
  get OPENCTRLC_CLIENT() {
    return process.env["OPENCTRLC_CLIENT"] ?? "cli"
  },
}

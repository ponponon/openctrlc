import os from "os"
import path from "path"

process.env.OPENCTRLC_DB = ":memory:"
process.env.OPENCTRLC_MODELS_PATH = path.join(import.meta.dir, "plugin", "fixtures", "models-dev.json")
process.env.OPENCTRLC_DISABLE_MODELS_FETCH = "true"
const dir = path.join(os.tmpdir(), `openctrlc-core-test-${process.pid}`)
process.env.XDG_DATA_HOME = path.join(dir, "share")
process.env.XDG_CACHE_HOME = path.join(dir, "cache")
process.env.XDG_CONFIG_HOME = path.join(dir, "config")
process.env.XDG_STATE_HOME = path.join(dir, "state")

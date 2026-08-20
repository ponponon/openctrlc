import path from "path"

process.env.OPENCTRLC_DB = ":memory:"
process.env.OPENCTRLC_MODELS_PATH = path.join(import.meta.dir, "plugin", "fixtures", "models-dev.json")
process.env.OPENCTRLC_DISABLE_MODELS_FETCH = "true"

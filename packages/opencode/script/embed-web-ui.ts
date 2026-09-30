import { $ } from "bun"
import path from "path"

export async function createEmbeddedWebUIBundle(channel: string) {
  console.log("Building Web UI to embed in the server")
  const root = path.resolve(import.meta.dirname, "..")
  const appDir = path.join(root, "../app")
  const dist = path.join(appDir, "dist")
  await $`OPENCTRLC_CHANNEL=${channel} bun run --cwd ${appDir} build`
  const files = (await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: dist })))
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => !file.endsWith(".map"))
    .sort()
  const imports = files.map((file, i) => {
    const spec = path.relative(root, path.join(dist, file)).replaceAll("\\", "/")
    return `import file_${i} from ${JSON.stringify(spec.startsWith(".") ? spec : `./${spec}`)} with { type: "file" };`
  })
  const entries = files.map((file, i) => `  ${JSON.stringify(file)}: file_${i},`)
  return [
    `// Import all files as file_$i with { type: "file" }`,
    ...imports,
    `// Export the original paths for the local server`,
    `export default {`,
    ...entries,
    `}`,
  ].join("\n")
}

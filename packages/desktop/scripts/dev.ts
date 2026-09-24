import { DEV_RESTART_EXIT_CODE } from "../src/main/dev-restart"

while (true) {
  const child = Bun.spawn(["electron-vite", "dev", ...process.argv.slice(2)], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  })
  const exitCode = await child.exited
  if (exitCode === DEV_RESTART_EXIT_CODE) continue
  process.exitCode = exitCode
  break
}

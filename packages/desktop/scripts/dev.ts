import { DEV_RESTART_EXIT_CODE } from "../src/main/dev-restart"

while (true) {
  const child = Bun.spawn(["electron-vite", "dev", ...process.argv.slice(2)], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  })
  const exitCode = await child.exited
  if (exitCode === DEV_RESTART_EXIT_CODE) {
    console.log("dev:desktop app restart requested; checking embedded sidecar build")
    const prepare = Bun.spawn(["bun", "./scripts/predev.ts"], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    })
    const prepareExitCode = await prepare.exited
    if (prepareExitCode !== 0) {
      process.exitCode = prepareExitCode
      break
    }
    continue
  }
  process.exitCode = exitCode
  break
}

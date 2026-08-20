import { run as runTui, type TuiInput } from "@openctrlc/tui"
import { Global } from "@openctrlc/core/global"
import { AppNodeBuilder } from "@openctrlc/core/effect/app-node-builder"
import { Effect } from "effect"

export function run(input: TuiInput) {
  return runTui(input).pipe(Effect.provide(AppNodeBuilder.build(Global.node)))
}

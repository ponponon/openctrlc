export * as File from "./file"

import { Revert } from "@openctrlc/schema/revert"

export const Diff = Revert.FileDiff
export type Diff = typeof Diff.Type

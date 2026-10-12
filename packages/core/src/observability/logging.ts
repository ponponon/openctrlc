import { Effect, Formatter, Logger, type LogLevel } from "effect"
import { Brand } from "@openctrlc/identity"
import { appendFileSync, renameSync, rmSync, statSync } from "fs"
import path from "path"
import { Global } from "../global"
import { runID } from "./shared"

function formatter(id: string = runID) {
  return Logger.map(Logger.formatStructured, (output) => {
    const messages = Array.isArray(output.message) ? output.message : [output.message]
    return [
      ["timestamp", output.timestamp],
      ["level", output.level],
      ["run", id],
      ...messages.flatMap((value) => (plain(value) ? flatten(value) : [["message", value] as const])),
      ...(output.cause === undefined ? [] : [["cause", output.cause] as const]),
      ...flatten(output.spans),
      ...flatten(output.annotations),
    ]
      .map(([key, value]) => `${key}=${format(value)}`)
      .join(" ")
  })
}

function flatten(
  input: Record<string, unknown>,
  prefix = "",
  seen = new WeakSet<object>(),
): Array<readonly [string, unknown]> {
  if (seen.has(input)) return [[prefix, "[Circular]"]]
  seen.add(input)
  const entries = Object.entries(input)
  if (entries.length === 0 && prefix) return [[prefix, input]]
  return entries.flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return plain(value) ? flatten(value, path, seen) : [[path, value] as const]
  })
}

function plain(input: unknown): input is Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return false
  const prototype = Object.getPrototypeOf(input)
  return prototype === Object.prototype || prototype === null
}

function format(input: unknown) {
  const value = typeof input === "string" ? input : Formatter.format(input)
  return /^[^\s="\\]+$/.test(value) ? value : JSON.stringify(value)
}

/** One log file stays below this size; a bigger file is rotated before the next write. */
export const MAX_LOG_BYTES = 10 * 1024 * 1024
/** Rotated copies kept next to the active file (`openctrlc.log.1` … `.2`). */
export const KEEP_ROTATED_LOGS = 2
/** Rotated copies older than this are dropped when a run starts. */
export const MAX_LOG_AGE_DAYS = 7

export function fileLogger(file = path.join(Global.Path.log, `${Brand.runtimeDirectory}.log`), id: string = runID) {
  rotate(file)
  pruneRotated(file)
  // Do not set batchWindow to 0; it causes high idle CPU usage.
  return Logger.batched(formatter(id), {
    window: 1000,
    flush: (lines) =>
      Effect.sync(() => {
        if (lines.length === 0) return
        try {
          rotate(file)
          appendFileSync(file, lines.join("\n") + "\n")
        } catch {
          // Logging must never take the process down; a full disk or a file
          // locked by another run only costs these buffered lines.
        }
      }),
  })
}

function sizeOf(file: string) {
  try {
    return statSync(file).size
  } catch {
    return 0
  }
}

function rotate(file: string) {
  if (sizeOf(file) < MAX_LOG_BYTES) return
  for (let index = KEEP_ROTATED_LOGS; index >= 2; index--) {
    const from = `${file}.${index - 1}`
    try {
      if (sizeOf(from) > 0) renameSync(from, `${file}.${index}`)
    } catch {
      continue
    }
  }
  try {
    // Only files that rotated normally (at most one oversized batch over the
    // limit) are kept; a far larger file is legacy bulk the retention policy
    // is meant to remove, so drop it instead of shuffling it forward forever.
    if (sizeOf(file) <= MAX_LOG_BYTES + MAX_LOG_BYTES / 2) renameSync(file, `${file}.1`)
    else rmSync(file, { force: true })
  } catch {
    return
  }
}

function pruneRotated(file: string) {
  const cutoff = Date.now() - MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000
  for (let index = 1; index <= KEEP_ROTATED_LOGS; index++) {
    const target = `${file}.${index}`
    try {
      if (statSync(target).mtimeMs < cutoff) rmSync(target, { force: true })
    } catch {
      continue
    }
  }
}

const stderrLogger = Logger.make((options) => process.stderr.write(formatter().log(options) + "\n"))

export function minimumLogLevel() {
  const value = process.env.OPENCTRLC_LOG_LEVEL?.toUpperCase()
  const levels = {
    DEBUG: "Debug",
    INFO: "Info",
    WARN: "Warn",
    ERROR: "Error",
  } as const satisfies Record<string, LogLevel.LogLevel>
  return value && value in levels ? levels[value as keyof typeof levels] : levels.INFO
}

export function loggers() {
  return process.env.OPENCTRLC_PRINT_LOGS === "1" ? [fileLogger(), stderrLogger] : [fileLogger()]
}

export * as Logging from "./logging"

import { expect, test } from "bun:test"
import { getLastActiveUrl, setLastActiveUrl, windowLastActiveUrlKey } from "./window-state"

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  } as Storage
}

test("persists and restores OpenCtrlC window URLs without legacy keys", () => {
  const store = storage()
  setLastActiveUrl(store, "one", "/project/one")

  expect(windowLastActiveUrlKey("one")).toBe("openctrlc.desktop.window.one.last-active-url")
  expect(getLastActiveUrl(store, "one")).toBe("/project/one")
  expect(getLastActiveUrl(store, "two")).toBe("/")
})

test("does not read the old OpenCode key", () => {
  const store = storage()
  store.setItem("opencode.desktop.window.one.last-active-url", "/legacy")

  expect(getLastActiveUrl(store, "one")).toBe("/")
})

test("isolates window persistence", () => {
  const store = storage()
  setLastActiveUrl(store, "one", "/one")
  setLastActiveUrl(store, "two", "/two")

  expect(getLastActiveUrl(store, "one")).toBe("/one")
  expect(getLastActiveUrl(store, "two")).toBe("/two")
})

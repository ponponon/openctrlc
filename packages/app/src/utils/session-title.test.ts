import { describe, expect, test } from "bun:test"
import { sessionTabTitle } from "./session-title"

describe("sessionTabTitle", () => {
  test("prefixes a session title with its project name", () => {
    expect(sessionTabTitle("taisan_console", "排查图片样本OSS加载失败问题")).toBe(
      "taisan_console / 排查图片样本OSS加载失败问题",
    )
  })

  test("keeps the fallback title when project metadata is unavailable", () => {
    expect(sessionTabTitle(undefined, "会话标题")).toBe("会话标题")
    expect(sessionTabTitle("taisan_console")).toBeUndefined()
  })
})

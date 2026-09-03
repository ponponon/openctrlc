import { describe, expect, test } from "bun:test"
import { sessionDisplayTitle } from "./session-title"

describe("sessionDisplayTitle", () => {
  test("prefixes a session title with its project name", () => {
    expect(sessionDisplayTitle("taisan_console", "排查图片样本OSS加载失败问题")).toBe(
      "taisan_console / 排查图片样本OSS加载失败问题",
    )
  })

  test("keeps the fallback title when project metadata is unavailable", () => {
    expect(sessionDisplayTitle(undefined, "会话标题")).toBe("会话标题")
    expect(sessionDisplayTitle("taisan_console")).toBeUndefined()
  })
})

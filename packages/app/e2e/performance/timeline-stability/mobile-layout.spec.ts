import { expect, test } from "@playwright/test"
import { setupTimeline } from "./fixture"

test("mobile portrait keeps the titlebar and v2 composer inside 320–430px", async ({ page }) => {
  await setupTimeline(page, {
    settings: { newLayoutDesigns: true },
    viewport: { width: 320, height: 900 },
  })

  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 900 })
    const layout = await page.evaluate(() => {
      const home = document.querySelector<HTMLElement>('[data-slot="titlebar-v2-home"]')
      const controls = document.querySelector<HTMLElement>('[data-slot="prompt-input-controls"]')
      const controlsRow = document.querySelector<HTMLElement>('[data-slot="prompt-input-controls-row"]')
      const submit = document.querySelector<HTMLElement>('[data-slot="prompt-input-submit"]')
      if (!home || !controls || !controlsRow || !submit) throw new Error("mobile layout anchors are missing")

      const homeStyle = getComputedStyle(home)
      const controlsStyle = getComputedStyle(controls)
      const submitStyle = getComputedStyle(submit)
      const controlsRect = controls.getBoundingClientRect()
      const rowRect = controlsRow.getBoundingClientRect()
      const submitRect = submit.getBoundingClientRect()
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        homeWidth: Number.parseFloat(homeStyle.width),
        homeMinWidth: Number.parseFloat(homeStyle.minWidth),
        controlsWrap: controlsStyle.flexWrap,
        controlsOverflow: controls.scrollWidth - controls.clientWidth,
        submitAlignSelf: submitStyle.alignSelf,
        submitInsideRow: submitRect.right <= rowRect.right + 1,
        controlsOverlapSubmit: controlsRect.right > submitRect.left + 1,
      }
    })

    expect(layout.viewportWidth).toBe(width)
    expect(layout.documentWidth, `${width}px document has horizontal overflow`).toBeLessThanOrEqual(width + 1)
    expect(layout.homeWidth, `${width}px titlebar home width`).toBe(36)
    expect(layout.homeMinWidth, `${width}px titlebar home minimum width`).toBe(36)
    expect(layout.controlsWrap).toBe("wrap")
    expect(layout.controlsOverflow).toBeLessThanOrEqual(1)
    expect(layout.submitAlignSelf).toBe("flex-end")
    expect(layout.submitInsideRow).toBe(true)
    expect(layout.controlsOverlapSubmit).toBe(false)
  }
})

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
        controlsOverlapSubmit: controlsRect.right > submitRect.left + 1 && controlsRect.bottom > submitRect.top + 1,
      }
    })

    expect(layout.viewportWidth).toBe(width)
    expect(layout.documentWidth, `${width}px document has horizontal overflow`).toBeLessThanOrEqual(width + 1)
    expect(layout.homeWidth, `${width}px titlebar home width`).toBe(36)
    expect(layout.homeMinWidth, `${width}px titlebar home minimum width`).toBe(36)
    expect(layout.controlsWrap).toBe("wrap")
    expect(layout.controlsOverflow).toBeLessThanOrEqual(1)
    expect(layout.submitAlignSelf).toBe("end")
    expect(layout.submitInsideRow).toBe(true)
    expect(layout.controlsOverlapSubmit).toBe(false)
  }
})

test("wide viewport with a narrow session panel wraps composer controls", async ({ page }) => {
  await setupTimeline(page, {
    settings: { newLayoutDesigns: true },
    viewport: { width: 1100, height: 900 },
  })

  const layout = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[data-slot="session-panel"]')
    const controls = document.querySelector<HTMLElement>('[data-slot="prompt-input-controls"]')
    const controlsRow = document.querySelector<HTMLElement>('[data-slot="prompt-input-controls-row"]')
    const submit = document.querySelector<HTMLElement>('[data-slot="prompt-input-submit"]')
    if (!panel || !controls || !controlsRow || !submit) throw new Error("composer layout anchors are missing")

    const snapshot = (panelWidth: string) => {
      // The panel eases width changes; measure the settled geometry instead.
      panel.style.transition = "none"
      panel.style.width = panelWidth
      const rowStyle = getComputedStyle(controlsRow)
      const controlsStyle = getComputedStyle(controls)
      const submitStyle = getComputedStyle(submit)
      const controlsRect = controls.getBoundingClientRect()
      const submitRect = submit.getBoundingClientRect()
      return {
        panelWidth: panel.getBoundingClientRect().width,
        rowDisplay: rowStyle.display,
        controlsWrap: controlsStyle.flexWrap,
        submitAlignSelf: submitStyle.alignSelf,
        controlsOverlapSubmit: controlsRect.right > submitRect.left + 1 && controlsRect.bottom > submitRect.top + 1,
      }
    }

    return {
      viewportWidth: window.innerWidth,
      narrow: snapshot("500px"),
      wide: snapshot("800px"),
    }
  })

  // The viewport is far past the old 640px breakpoint; only the panel
  // container decides, because split view can leave the panel phone-narrow.
  expect(layout.viewportWidth).toBe(1100)
  expect(layout.narrow.panelWidth).toBeGreaterThan(495)
  expect(layout.narrow.panelWidth).toBeLessThan(505)
  expect(layout.narrow.rowDisplay).toBe("grid")
  expect(layout.narrow.controlsWrap).toBe("wrap")
  expect(layout.narrow.submitAlignSelf).toBe("end")
  expect(layout.narrow.controlsOverlapSubmit).toBe(false)

  expect(layout.wide.panelWidth).toBeGreaterThan(795)
  expect(layout.wide.panelWidth).toBeLessThan(805)
  expect(layout.wide.rowDisplay).toBe("flex")
  expect(layout.wide.controlsWrap).toBe("nowrap")
  expect(layout.wide.controlsOverlapSubmit).toBe(false)
})

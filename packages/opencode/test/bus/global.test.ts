import { afterEach, describe, expect, test } from "bun:test"
import { GlobalBus, type GlobalEvent } from "../../src/bus/global"

describe("GlobalBus", () => {
  afterEach(() => GlobalBus.removeAllListeners("event"))

  test("injects the sync event id into payloads without an id", () => {
    const event = {
      payload: {
        type: "test.event",
        syncEvent: { id: "sync-event-id" },
      },
    }
    let received: GlobalEvent | undefined

    GlobalBus.on("event", (value) => {
      received = value
    })

    expect(GlobalBus.emit("event", event)).toBe(true)
    expect(received?.payload.id).toBe("sync-event-id")
  })
})

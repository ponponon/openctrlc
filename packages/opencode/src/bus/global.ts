import { EventEmitter } from "events"
import { Identifier } from "@/id/id"

export type GlobalEvent = {
  directory?: string
  project?: string
  workspace?: string
  payload: any
}

class GlobalBusEmitter extends EventEmitter<{
  event: [GlobalEvent]
}> {
  override emit<E>(eventName: E | "event", ...args: E extends "event" ? [event: GlobalEvent] : any[]): boolean {
    if (eventName === "event") {
      const event = args[0] as GlobalEvent
      if (event.payload && typeof event.payload === "object" && !("id" in event.payload)) {
        event.payload.id = event.payload.syncEvent?.id ?? Identifier.create("evt", "ascending")
      }
    }
    return Reflect.apply(EventEmitter.prototype.emit, this, [eventName, ...args]) as boolean
  }
}

export const GlobalBus = new GlobalBusEmitter()

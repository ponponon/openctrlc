export * as PublicEventManifest from "./public-event-manifest"

import { Event } from "@openctrlc/schema/event"
import { EventManifest } from "@openctrlc/schema/event-manifest"

export const Definitions = EventManifest.ServerDefinitions
export const Latest = Event.latest(Definitions)

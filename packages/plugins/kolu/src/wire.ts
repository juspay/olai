import { defineSurface } from "@kolu/surface/define"
import { koluMembers } from "olai-plugin-kolu/appliance/wire"

export const name = "kolu"

export const surface = defineSurface({
  cells: {
    link: koluMembers.cells.link,
    pulse: koluMembers.cells.pulse,
  },
  collections: {
    fleet: koluMembers.collections.fleet,
    events: koluMembers.collections.events,
  },
  streams: {
    terminal: koluMembers.streams.terminal,
  },
  procedures: {
    screen: koluMembers.procedures.screen,
  },
})

export const faces = {
  browser: {
    link: "resource",
    pulse: "resource",
    fleet: "resource",
    events: "resource",
    terminal: "resource",
    "screen.text": "tool",
  },
} as const

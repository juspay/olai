import type { Claims } from "@olai/format"
import type {
  Agenda,
  DayGroup,
  Row,
  Shown,
  TrashGroup,
} from "@olai/format"
import type { FiledPageRequest } from "@olai/format"

import type { Route } from "olai-plugin-navigation/routes"

export const requestFor = (route: Route): FiledPageRequest | null => {
  switch (route.kind) {
    case "at": {
      if (route.reveal) return null
      const address = route.address
      return {
        kind: "at",
        address: address?.kind === "heading" || address?.kind === "row"
          ? { kind: "document", path: address.path }
          : address,
      }
    }
    case "trash":
      return { kind: "trash" }
    case "plugin":
      return null
  }
}

export const fileOf = (shows: Shown): string | undefined => {
  if (shows.kind === "outline") return shows.file
  if (shows.kind === "document") return shows.file
  if (shows.kind === "broken") return shows.file.file
  if (shows.kind === "node" && shows.zoomed.kind === "node") return shows.zoomed.shows.file
  return undefined
}

export type { Drawn } from "../contracts/page.ts"
import type { Drawn } from "../contracts/page.ts"

export const NOTHING_DRAWN: Drawn = { kind: "none" }

export const drawnBy = (shows: Shown | undefined): Drawn => {
  if (shows === undefined) return NOTHING_DRAWN
  if (shows.kind === "outline") return { kind: "tree", rows: shows.rows }
  if (shows.kind === "node") {
    return {
      kind: "tree",
      rows: shows.zoomed.kind === "node" ? shows.zoomed.children : [],
    }
  }
  if (shows.kind === "day") return { kind: "day", groups: shows.groups, notes: shows.notes }
  if (shows.kind === "agenda") return { kind: "agenda", agenda: shows.agenda }
  if (shows.kind === "trash") {
    return { kind: "trash", files: shows.files, groups: shows.groups }
  }
  return NOTHING_DRAWN
}

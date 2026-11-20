import { defineSurface } from "@kolu/surface/define"
import { oduMembers } from "olai-plugin-odu/appliance/wire"

export const name = "odu"

export const surface = defineSurface({
  cells: {
    ci: oduMembers.cells.ci,
    service: oduMembers.cells.service,
  },
})

export const faces = {
  browser: {
    ci: "resource",
    service: "resource",
  },
} as const

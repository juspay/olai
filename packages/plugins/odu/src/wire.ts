/**
 * THIS ENTRY'S OWN FENCE: the composed group is on the static graph of
 * everything that reads the surface, so this module may import the framework,
 * `effect` and its own wire slice and nothing else — no `@odu/*`, no
 * `solid-js`, no `@olai/format`, no `node:` builtin.
 */

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

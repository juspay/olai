import { defineSurface } from "@kolu/surface/define"
import { surface as legacy } from "@olai/surface"

/** Static compatibility contract; live handlers belong to this capability. */
export const surface = defineSurface({
  cells: { pins: legacy.spec.cells.pins },
  procedures: {
    edit: legacy.spec.procedures.edit,
  },
})
export const dispatch = {
  "surface/edit/apply": { field: "verb", cases: ["pin"] },
} as const
export const faces = {
  "browser": {
    "pins": "resource",
    "edit.apply": "tool"
  },
  "agent": {}
} as const

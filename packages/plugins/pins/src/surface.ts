import { NO_PINS, sameShelf, Shelf } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { editProcedures } from "@olai/surface/dispatch"
export const surface = defineSurface({
cells: {
    pins: {
      schema: Shelf,
      default: NO_PINS,
      verbs: ["get"],
      equals: sameShelf,
      arrayKey: "id",
    }
},
procedures: {
edit: editProcedures
}
})
export const dispatch = {
  "edit.apply": ["pin"],
} as const
export const faces = {
  "browser": {
    "pins": "resource",
    "edit.apply": "tool"
  },
  "agent": {}
} as const

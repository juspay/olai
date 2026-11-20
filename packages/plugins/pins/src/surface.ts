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
      /** A declared key is identity WHEREVER it appears, so `Pinned.shows` — a
       *  nested object carrying an `id` of its own — is merged in place while
       *  that id reads the same and replaced whole the moment it reads
       *  different, which is what this member wants. */
      arrayKey: "id",
    }
},
procedures: {
edit: editProcedures
}
})
/**
 * EXHAUSTIVE AND DISJOINT ACROSS THE BUNDLE, or a verb reaches `writeEdit` with
 * no writer and fails at runtime with "the capability for X is not active"
 * (`@olai/edit-history`'s `writing.ts`). `@olai/server`'s
 * `capability-dispatch.test.ts` holds it.
 */
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

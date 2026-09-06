/** trash owns these wire descriptors as well as their live handlers.
 * The descriptor imports are inert schemas; loading this contract acquires no
 * runtime state. Stable root tags preserve clients without moving ownership
 * back into the host. */
import { defineSurface } from "@kolu/surface/define"
import { editProcedures, writeProcedure } from "@olai/surface/dispatch"
export const surface = defineSurface({
procedures: {
edit: editProcedures,
ops: { run: writeProcedure }
}
})
export const dispatch = {
  "surface/edit/apply": { field: "verb", cases: ["untrash", "emptyTrash"] },
  "surface/ops/run": { field: "op", cases: ["untrash", "empty"] },
} as const
export const faces = {
  "browser": {
    "edit.apply": "tool"
  },
  "agent": {
    "ops.run": "tool"
  }
} as const

import { defineSurface } from "@kolu/surface/define"
import { editProcedures, writeProcedure } from "@olai/surface/dispatch"
export const surface = defineSurface({
procedures: {
edit: editProcedures,
ops: { run: writeProcedure }
}
})
export const dispatch = {
  "edit.apply": ["untrash", "emptyTrash"],
  "ops.run": ["untrash", "empty"],
} as const
export const faces = {
  "browser": {
    "edit.apply": "tool"
  },
  "agent": {
    "ops.run": "tool"
  }
} as const

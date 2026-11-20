import { OpFailure, PathsAnswer } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { editProcedures, writeProcedure } from "@olai/surface/dispatch"
export const surface = defineSurface({
procedures: {
edit: editProcedures,
ops: {
  paths: { output: PathsAnswer, error: OpFailure }, run: writeProcedure }
}
})
/**
 * EXHAUSTIVE AND DISJOINT ACROSS THE BUNDLE, or a verb reaches `writeEdit` with
 * no writer and fails at runtime with "the capability for X is not active"
 * (`@olai/edit-history`'s `writing.ts`).
 */
export const dispatch = {
  "edit.apply": ["outlineNew", "fileDelete"],
  "ops.run": ["create", "delete"],
} as const
export const faces = {
  "browser": {
    "edit.apply": "tool"
  },
  "agent": {
    "ops.paths": "tool",
    "ops.run": "tool"
  }
} as const

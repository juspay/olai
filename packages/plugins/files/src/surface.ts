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
type Procedures = typeof surface.spec.procedures
type Member = {
  [Group in keyof Procedures & string]: `${Group}.${keyof Procedures[Group] & string}`
}[keyof Procedures & string]
export const dispatch = {
  "edit.apply": ["outlineNew", "fileDelete"],
  "ops.run": ["create", "delete"],
} as const satisfies Partial<Record<Member, readonly string[]>>
export const faces = {
  "browser": {
    "edit.apply": "tool"
  },
  "agent": {
    "ops.paths": "tool",
    "ops.run": "tool"
  }
} as const satisfies Record<string, Partial<Record<Member, "tool">>>

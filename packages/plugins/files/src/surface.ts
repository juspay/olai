/** files owns these wire descriptors as well as their live handlers.
 * The descriptor imports are inert schemas; loading this contract acquires no
 * runtime state. Stable root tags preserve clients without moving ownership
 * back into the host. */
import { OpFailure, PathsAnswer } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { editProcedures, writeProcedure } from "@olai/surface/dispatch"
export const surface = defineSurface({
procedures: {
edit: editProcedures,
ops: { /**
   * The outline PATHS of the served directory — the same question with the
   * records left out, and the one member here that answers no tool.
   *
   * It is what a PLAN arm reads (`@olai/ops`' `Planning`): a capture is aimed
   * by the inbox convention over the file NAMES, and a face with no store of
   * its own — which is every agent reached over this surface — could only get
   * them by asking {@link outlines} and dropping the counts, so a capture cost
   * the directory's records and paid twice when the race made it resolve again
   * (roadmap `perf-capture-paths`).
   *
   * WHY NOT A NARROWED {@link outlines}: `list_outlines` is what an agent reads
   * to CHOOSE a file, and the counts and roots are what it chooses by. Two
   * questions, two answers, each costing what it says.
   *
   * No input, for {@link outlines}' reason.
   */
  paths: { output: PathsAnswer, error: OpFailure }, run: writeProcedure }
}
})
/**
 * WHICH `Edit.verb`s AND `WriteRequest.op`s THIS ROW OWNS, keyed by the MEMBER
 * PATH that answers them.
 *
 * THE KEYS WERE WIRE TAGS AND ARE NOT TAGS ANY MORE: `surface/edit/apply` and
 * `surface/ops/run` were the monolith-era SHORT names this row answered under
 * beside its own `surface/files/edit/apply`, and those short names are deleted,
 * so spelling one here would name a tag nothing serves. Nothing dispatches on
 * these strings — `./browser.tsx` uses `dispatch["edit.apply"]` as a key and
 * writes through this row's own scoped client.
 *
 * EXHAUSTIVE AND DISJOINT ACROSS THE BUNDLE, or a verb reaches `writeEdit` with
 * no writer and fails at runtime with "the capability for X is not active"
 * (`@olai/edit-history`'s `writing.ts`). `@olai/server`'s
 * `capability-dispatch.test.ts` holds it.
 */
export const dispatch = {
  "edit.apply": { field: "verb", cases: ["outlineNew", "fileDelete"] },
  "ops.run": { field: "op", cases: ["create", "delete"] },
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

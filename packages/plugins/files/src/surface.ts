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
   * WHY NOT A NARROWED {@link outlines}: `outlines_map` is what an agent reads
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
 *
 * `field` WENT WITH THE ENVELOPE. Each entry used to be
 * `{ field: "verb", cases: [...] }`, because the composition root routed one
 * shared bare tag to an owner by reading that field off the payload. There is
 * no shared tag and no envelope, and the discriminator is already implied by
 * the member — `edit.apply`'s cases are `Edit.verb`s, `ops.run`'s are
 * `WriteRequest.op`s — so the word was a second statement of a fact with no
 * reader left. `capability-dispatch.test.ts` is what checks the cases are the
 * right union's.
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
    // THE READING THE `capture` TOOL RESOLVES AGAINST, and the one member on
    // this face that is not itself a tool: which outlines there are, which is
    // what the inbox convention is read off (`@olai/ops`' `Planning`). It is
    // exposed for the same reason `ops.run` is — a tool this face advertises
    // lands through it — and it is `"tool"` like its neighbour because a face
    // map reads MEMBERSHIP and nothing else (`@olai/surface/host`'s
    // `hostFaces`).
    "ops.paths": "tool",
    "ops.run": "tool"
  }
} as const

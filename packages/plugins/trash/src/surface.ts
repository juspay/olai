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
/**
 * WHICH `Edit.verb`s AND `WriteRequest.op`s THIS ROW OWNS, keyed by the MEMBER
 * PATH that answers them.
 *
 * THE KEYS WERE WIRE TAGS AND ARE NOT TAGS ANY MORE: `surface/edit/apply` and
 * `surface/ops/run` were the monolith-era SHORT names this row answered under
 * beside its own `surface/trash/edit/apply`, and those short names are deleted,
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
  "edit.apply": { field: "verb", cases: ["untrash", "emptyTrash"] },
  "ops.run": { field: "op", cases: ["untrash", "empty"] },
} as const
export const faces = {
  "browser": {
    "edit.apply": "tool"
  },
  "agent": {
    "ops.run": "tool"
  }
} as const

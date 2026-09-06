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

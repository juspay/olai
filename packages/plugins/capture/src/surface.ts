/** capture owns these wire descriptors as well as their live handlers.
 * The descriptor imports are inert schemas; loading this contract acquires no
 * runtime state. Stable root tags preserve clients without moving ownership
 * back into the host. */
import { InboxHeld, NO_INBOX, sameInboxHeld } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { editProcedures } from "@olai/surface/dispatch"
export const surface = defineSurface({
cells: {
/**
     * HOW FULL THE INBOX IS — the rows of whichever outline `inboxIn`
     * names that are marked `todo` or `doing` (`@olai/format`'s {@link
     * InboxHeld}). Any depth, no walk: a settled row does not count, an
     * unmarked one is furniture, and a placement is not a node.
     *
     * A CELL, and for `pins`' reason: the count is a fact about the
     * directory, not about who is asking or what they are looking at, so
     * there is no input to give a stream and no question to make a
     * procedure of. The server recomputes it on every published revision
     * and sends it when the number moved, which is §2's mechanism sentence
     * exactly.
     *
     * ONE INTEGER and not the file, because which outline the inbox IS is
     * already answered from the paths the tab holds (`inboxIn` over
     * `heads`). Duplicating that path here would be two answers to one
     * question, free to disagree by a frame.
     *
     * THE BROWSER'S ALONE (`@olai/server`'s `faces.ts`): an agent asking
     * what the inbox holds asks `list_outlines` and is answered with the
     * nodes. A badge is a paint instruction for a door somebody is looking
     * at.
     */
    inbox: {
      schema: InboxHeld,
      default: NO_INBOX,
      verbs: ["get"],
      equals: sameInboxHeld,
    }
},
procedures: {
edit: editProcedures
}
})
/**
 * WHICH `Edit.verb`s THIS ROW OWNS, keyed by the MEMBER PATH that answers them
 * — `edit.apply`, the same word `faces` below spells. No `ops.run` entry
 * because there is no `ops` group above: a capture is written as an edit.
 *
 * THE KEY WAS A WIRE TAG AND IS NOT A TAG ANY MORE: `surface/edit/apply` was
 * the monolith-era SHORT name this row answered under beside its own
 * `surface/capture/edit/apply`, and those short names are deleted, so spelling
 * one here would name a tag nothing serves. Nothing dispatches on this string —
 * `./browser.tsx` uses `dispatch["edit.apply"]` as a key and writes through this
 * row's own scoped client.
 *
 * EXHAUSTIVE AND DISJOINT ACROSS THE BUNDLE, or a verb reaches `writeEdit` with
 * no writer and fails at runtime with "the capability for X is not active"
 * (`@olai/edit-history`'s `writing.ts`). `@olai/server`'s
 * `capability-dispatch.test.ts` holds it.
 */
export const dispatch = {
  "edit.apply": { field: "verb", cases: ["capture"] },
} as const
export const faces = {
  "browser": {
    "inbox": "resource",
    "edit.apply": "tool"
  },
  "agent": {}
} as const

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
     * THE BROWSER'S ALONE ({@link faces} below): an agent asking
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
  "edit.apply": ["capture"],
} as const
export const faces = {
  "browser": {
    // ONE INTEGER OVER FROM A SHELF: how many rows of the inbox are marked
    // `todo` or `doing`, at any depth (`@olai/format`'s `inboxHeldOf`) — an
    // unmarked row is furniture and a placement is not a node.
    //
    // The browser's alone, and trivially inside the cost rule
    // (`@olai/surface/host`'s `hostFaces`). An agent asking what the inbox
    // holds asks `list_outlines` and is answered with the nodes; a badge is a
    // paint instruction for a door somebody is looking at.
    "inbox": "resource",
    "edit.apply": "tool"
  },
  // NO AGENT MAP, which is the decision rather than a gap: `exposeFaces` denies
  // a sibling with no map under a face key in full. A capture is written as an
  // edit, and an agent writes with the ordinary write tools.
  "agent": {}
} as const

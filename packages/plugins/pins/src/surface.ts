/** pins owns these wire descriptors as well as their live handlers.
 * The descriptor imports are inert schemas; loading this contract acquires no
 * runtime state. Stable root tags preserve clients without moving ownership
 * back into the host. */
import { NO_PINS, sameShelf, Shelf } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { editProcedures } from "@olai/surface/dispatch"
export const surface = defineSurface({
cells: {
/**
     * THE PINNED SHELF — the rows of the directory's `Pins.olai`, and the live
     * name of whatever node each one addresses (`@olai/format`'s {@link Shelf}).
     *
     * A CELL, which is to say a STANDING answer with no argument. The shelf is
     * a reading of the whole vault — which file the shelf is, that file's top
     * level, and a name that may live in any other file — and it was the
     * browser's own walk over its copy of every outline until PR 5 of
     * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`. Nothing about it depends on who
     * is asking or on what they are looking at, so there is no input to give a
     * stream and no question to make a procedure of: the server recomputes it
     * on every published revision and sends it when it changed by value, which
     * is §2's mechanism sentence exactly.
     *
     * RE-ANSWERED PER REVISION IS THE FEATURE, not an optimisation. A bare pin
     * stores an address and never a name, so what the shelf draws for `/#herbs`
     * is that node's title RIGHT NOW — rename it anywhere, by anyone, and the
     * new name is on the shelf on the frame the store publishes, because there
     * was never a second copy of it to go stale.
     *
     * `equals` is what keeps that from costing anything: the reading mints a
     * fresh array per revision, and almost every revision has nothing new to
     * say about a shelf of five doors.
     *
     * WIRE-READ-ONLY, like every other file-shaped member: a pin is a row in an
     * ordinary outline, and the only way to write one is the ops layer — which
     * is what a pin, a reorder and an unpin already resolve to.
     *
     * THE BROWSER'S ALONE ({@link faces} below): an agent reads the
     * shelf as the ordinary outline it is.
     */
    pins: {
      schema: Shelf,
      default: NO_PINS,
      verbs: ["get"],
      equals: sameShelf,
      /** A PIN IS ITS NODE'S ID — `@olai/format`'s `Pinned.id`, the pin
       *  record's own id, required and non-nullable.
       *
       *  `equals` above and this are the two halves of one sentence, and they
       *  are not the same half. `equals` decides whether a frame is SENT: a
       *  revision that moved no pin says nothing to anybody. This decides what
       *  a frame that IS sent is allowed to disturb — one pin added, one
       *  reordered, or one pinned node retitled in the file it lives in, and
       *  without a key every other row of the shelf was replaced with it. The
       *  sidebar keys the shelf by this same id (`pins/Shelf.tsx`'s
       *  `<Key each={pins()} by="id">`), so a reorder now MOVES the rows it
       *  reorders.
       *
       *  IT IS THE ONE DECLARATION HERE WHOSE FIELD ALSO LIVES OUTSIDE THE ROWS
       *  it was chosen for, and kolu warns about exactly that: a declared key is
       *  identity WHEREVER it appears, so `Pinned.shows` — a nested object that
       *  happens to carry an `id` of its own — is merged in place while that id
       *  reads the same and replaced whole the moment it reads different. Which
       *  is the behaviour this member wants: a row whose address comes to name a
       *  different node should get a fresh answer rather than a field-merged
       *  one. The other three declarations have no such object. */
      arrayKey: "id",
    }
},
procedures: {
edit: editProcedures
}
})
/**
 * WHICH `Edit.verb`s THIS ROW OWNS, keyed by the MEMBER PATH that answers them
 * — `edit.apply`, the same word `faces` below spells. No `ops.run` entry
 * because there is no `ops` group above: a pin is written as an edit, and read
 * as the ordinary outline it is.
 *
 * THE KEY WAS A WIRE TAG AND IS NOT A TAG ANY MORE: `surface/edit/apply` was
 * the monolith-era SHORT name this row answered under beside its own
 * `surface/pins/edit/apply`, and those short names are deleted, so spelling one
 * here would name a tag nothing serves. Nothing dispatches on this string —
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
  "edit.apply": ["pin"],
} as const
export const faces = {
  "browser": {
    // THE SIDEBAR'S SHELF, answered per revision (`@olai/format`'s `shelfOf`)
    // — a READING rather than a projection of the files, and the browser's
    // alone.
    //
    // An agent has no use for it and is not offered it: the shelf is an
    // ordinary outline, `Pins.olai`, and an agent reads it with `read_subtree`
    // and writes it with `add_node` / `move_node` / `trash_node`, which is the
    // whole point of the convention being titles in a file (docs/format.md's
    // Pins). What this member adds for a BROWSER is the RESOLUTION — a pin's
    // node named as it is called right now — which is a paint instruction for a
    // column somebody is looking at.
    //
    // It satisfies the cost rule (`@olai/surface/host`'s `hostFaces`) the way a
    // badge does rather than trivially: the value is O(what somebody PINNED),
    // which is a curated short list — it is exactly the rows the sidebar draws,
    // so a shelf too big for this member is a shelf too big for the column it
    // is drawn in.
    "pins": "resource",
    "edit.apply": "tool"
  },
  // NO AGENT MAP, which is the decision rather than a gap: `exposeFaces` denies
  // a sibling with no map under a face key in full. See the paragraph above for
  // why an agent wants the outline and not the shelf.
  "agent": {}
} as const

/**
 * THE ⌘K ROW that pins the page — the pointer door onto the same gesture the
 * ⌘⇧P chord is, and the only door a document or a filtered page has that a
 * reader can find by looking.
 *
 * It is about the PAGE and not about a node, which is what makes it different
 * from every op row beside it (`../palette/ops.ts`): those are the `•••` menu's
 * verbs against the node the reader has ZOOMED, and this one names the address
 * — so a `.md`, the agenda, a day, and any of them narrowed by a query all
 * have exactly one row here, and it carries the `?q=` with it.
 *
 * ONE ROW WITH TWO LABELS, for {@link ../pins/pinning.ts}'s reason: pinning is
 * a state, the shelf already knows which way this page's answer goes, and a
 * palette offering both would make a reader choose between two words.
 *
 * THREE LABELS NOW, and the third is the same rule read once more: a verb that
 * asks something first says so with an ellipsis in this app (`Set date…`,
 * `Set repeat…` — docs/editing.md's palette section), and pinning a NARROWED
 * page asks for a name (`./naming.ts`). Which of the three it wears is decided
 * by the two facts below rather than by a flag somebody passes.
 *
 * BOTH THINGS IT ASKS ARE THE SERVER'S, and they arrive on two different
 * members because they are two different questions: whether this page is
 * already on the shelf is the `pins` cell (`./pins.ts`), a reading of the whole
 * vault that depends on nobody's address; what this page is CALLED, when it is
 * a node, rides on the FOCUSED PAGE's own reading (`../reading.tsx`), because
 * that is the page whose ids were resolved. The second half was the tab's own
 * walk of its copy of the set until PR 10 of
 * `docs/brainstorming/vault-in-browser.md`.
 */

import type { Shelf } from "@olai/surface"

import type { PaletteItem } from "../palette/items.ts"
import type { Route } from "../routes.ts"
import { namingFor } from "./naming.ts"
import { pinnedAt } from "./pins.ts"

export const pinItem = (
  route: Route,
  shelf: Shelf,
  /** What this page is CALLED — resolved by the palette, once, because the
   *  chord beside this row wants the same answer for the box's placeholder
   *  (`../palette/Palette.tsx`). It is the one fact here that is a question
   *  about the vault: a `/#id` page is called whatever that node is called
   *  right now. */
  called: string,
): PaletteItem => {
  // ASKED ONCE, and handed to the rule beside it: whether this page is on the
  // shelf is a parse of every row, and the label and the question are two
  // readings of that one answer rather than two walks of the same list.
  const already = pinnedAt(shelf, route)
  return {
    id: "pin-page",
    label: already !== undefined
      ? "Unpin this page"
      : namingFor(route, already, called) === null
      ? "Pin this page"
      : "Pin this page…",
    hint: "⌘⇧P",
    // WHICH page, on the second line — the slot a search hit puts its ancestry
    // in, and wanted here for the same reason a write row wants it: the
    // palette is opened from anywhere, and a bare "Pin this page" in a list of
    // strangers does not say which page it means.
    place: called,
    action: { kind: "pin" },
    search: "pin unpin shelf sidebar bookmark save this page keep name saved search",
  }
}

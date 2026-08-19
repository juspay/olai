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
 */

import type { Derived } from "@olai/format"

import type { PaletteItem } from "../palette/items.ts"
import type { Route } from "../routes.ts"
import { nameOf } from "../address/address.ts"
import { pinnedAt } from "./pins.ts"

export const pinItem = (
  route: Route,
  derived: Derived | undefined,
): PaletteItem => {
  const already = pinnedAt(derived, route)
  return {
    id: "pin-page",
    label: already === undefined ? "Pin this page" : "Unpin this page",
    hint: "⌘⇧P",
    // WHICH page, on the second line — the slot a search hit puts its ancestry
    // in, and wanted here for the same reason a write row wants it: the
    // palette is opened from anywhere, and a bare "Pin this page" in a list of
    // strangers does not say which page it means.
    place: nameOf(route, derived),
    action: { kind: "pin" },
    search: "pin unpin shelf sidebar bookmark save this page keep",
  }
}

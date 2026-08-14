/**
 * The palette's OP rows: what ⌘K may write, and about which node.
 *
 * The `•••` menu's write verbs, offered from the palette against the node the
 * reader has ZOOMED — so `Mark doing`, `Clear date` and `Move to Trash` are
 * reachable with the hands on the keyboard, from a page whose heading has no
 * `•••` at all. That absence is the reason this exists rather than a
 * convenience on top of it: a zoomed node was, until now, the one node in this
 * app a pointer could not mark, date or put away, because the menu hangs off a
 * ROW and a zoom is a page.
 *
 * THREE decisions, and each of them is about not inventing a second anything:
 *
 *   - **the verbs are the menu's, not a list of their own**
 *     (`../menu/verbs.ts`). Which entries apply, which id each names, and the
 *     confirm the archive asks are decided once, by a pure function with a
 *     unit test, and both surfaces read the same answer. A palette with its
 *     own table would be a second opinion about what `Complete` does to a
 *     mirror.
 *   - **the SUBJECT is the zoom and nothing else.** Not the caret's row, not
 *     the last row somebody hovered: a palette is opened from anywhere, its
 *     rows are read out of context, and a write aimed at whatever happened to
 *     be focused is a write nobody can predict. What the address says the
 *     reader is looking at is a fact both they and this file can see — so on
 *     any other page there are simply no op rows, in the same way the menu
 *     draws no `Clear date` on a row with no date.
 *   - **the one verb that has a question to ask first is left out.** `Set
 *     date…` opens the ROW's picker, which is an element in the tree the
 *     palette is drawn over; there is nothing for it to open from here. It
 *     stays where the picker is, which is also where a date is already
 *     changed from — the pill on the row (`../date/DatePicker.tsx`).
 */

import type { Derived, Situated } from "@olai/format"

import { subjectOfZoom, writeVerbs } from "../menu/verbs.ts"
import type { PaletteItem } from "./items.ts"

/**
 * The rows the zoomed node offers, or none at all.
 *
 * `undefined` covers every page that is not one node — an outline, a day, the
 * agenda, the trash — and the frame before the first snapshot arrives.
 */
export const opItems = (
  zoomed: Situated | undefined,
  derived: Derived | undefined,
): ReadonlyArray<PaletteItem> => {
  if (zoomed === undefined) return []
  const title = zoomed.shows.node.title
  return writeVerbs(subjectOfZoom(zoomed), derived).flatMap((verb) =>
    verb.does.kind === "edit"
      ? [{
        // Prefixed, because the palette's ids are one namespace and a shell
        // item called `archive` would collide with this one the day somebody
        // adds it.
        id: `op-${verb.id}`,
        label: verb.label,
        // WHICH NODE, on the second line — the same slot a search hit puts its
        // ancestry in, and wanted here for the same reason: a bare `Complete`
        // in a list of strangers does not say what it would complete. The
        // palette is opened from anywhere, including from a page the reader
        // scrolled away from, so the subject is never assumed.
        place: `on “${title}”`,
        action: {
          kind: "edit" as const,
          edit: verb.does.edit,
          ...(verb.confirm === undefined ? {} : { confirm: verb.confirm }),
        },
        // The node's own title joins the haystack, so typing what you are
        // looking at finds what you can do to it.
        search: `${verb.label} ${title}`.toLowerCase(),
      }]
      : []
  )
}

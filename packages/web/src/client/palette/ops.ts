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
 *   - **the verbs that have a question to ask first are left out**, and there
 *     are FOUR of them now: `Set date…` opens the row's picker
 *     (`../date/DatePicker.tsx`), `Set repeat…` opens the one beside it
 *     (`../date/RepeatPicker.tsx`), and `Link to a node…` / `Wait for a node…`
 *     open the row's edge panel (`../edges/EdgePanel.tsx`). Each of those is an
 *     element in the tree the palette is drawn OVER, and there is nothing for a
 *     modal to open from here. Each stays where its panel is, which is also
 *     where those writes are already made from — the pill on the row, the `×`
 *     on a drawn reference.
 *
 *     THE FILTER IS THE ARM, not a list: `does.kind === "edit"` is what leaves
 *     them out, so the FIFTH verb that opens something is excluded by being
 *     written rather than by somebody remembering this paragraph — which is
 *     exactly how the repeat picker arrived, adding no line here but this one.
 *     What the paragraph is for is saying WHY — and `../edges/EdgeVerbs.tsx` is
 *     the other half of the answer for the two edge verbs, which a zoomed node
 *     reaches from its own controls. The two PICKERS are the standing gap on
 *     that page, and they are one gap rather than two: a heading has no `•••`,
 *     so scheduling a zoomed node and making it repeat are both done from its
 *     row (docs/editing.md).
 */

import type { Situated } from "@olai/format"
import { NO_PINS } from "@olai/surface"

import { NO_ENGINES, subjectOfZoom, writeVerbs } from "../menu/verbs.ts"
import type { PaletteItem } from "./items.ts"
import { atOnce } from "../settled.ts"

/**
 * The rows the zoomed node offers, or none at all.
 *
 * `undefined` covers every page that is not one node — an outline, a day, the
 * agenda, the trash — and the frame before the first snapshot arrives.
 */
export const opItems = (
  zoomed: Situated | undefined,
  /** How many records hang under the zoomed node, in the set — the number the
   *  archive's confirm names, carried on the page's own reading
   *  (`@olai/format`'s `Zoomed.under`) rather than walked here. */
  under: number | undefined,
): ReadonlyArray<PaletteItem> => {
  if (zoomed === undefined) return []
  const title = zoomed.shows.node.title
  // THE SHELF IS NOT ASKED FOR, and cannot matter: the one verb in that
  // catalog that reads it is the pin, and the pin is dropped one line below —
  // so an empty shelf is not a stub here, it is the honest argument.
  //
  // NOR ARE THE INSTALLED AGENTS, for the same reason read one filter down:
  // the only verb they decide is *start an agent session*, which is not an
  // `edit` and so is dropped by the guard below whatever this list says. A
  // palette that offered it would also be a second door onto a gesture whose
  // whole point is being on the ROW — the node it would bind is the page, and
  // the page's own `•••` is where a node is bound from.
  return writeVerbs(subjectOfZoom(zoomed), under, NO_PINS, NO_ENGINES).flatMap((verb) =>
    // AND THE SHELF'S VERB IS LEFT OUT, which is the one exclusion by NAME in
    // this file and needs its own sentence because of that. The palette
    // already carries a pin row, and that one is about the PAGE
    // (`../pins/palette.ts`) — so on a zoomed node, where the page IS that
    // node, keeping this one would put two rows in the list doing one thing,
    // and the reader would have to know that one of them drops the `?q=`. The
    // `•••` on a ROW is where a node is pinned from, and it goes on offering
    // this verb from `../menu/verbs.ts` unchanged.
    verb.id !== "pin" && verb.id !== "unpin" && verb.does.kind === "edit"
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
        action: { kind: "edit" as const, edit: verb.does.edit, confirm: verb.confirm },
        // A verb of the zoomed node, read out of a pure catalogue in this tab:
        // there is no answer behind it (`../settled.ts`).
        taking: atOnce,
        // The node's TITLE, and only that: the filter already matches a row's
        // label on its own, so a haystack repeating it would be the same word
        // searched twice. What this adds is that typing what you are looking
        // AT finds what you can do to it.
        search: title.toLowerCase(),
      }]
      : []
  )
}

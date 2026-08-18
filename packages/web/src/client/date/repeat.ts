/**
 * What a chosen REPEAT RULE means, as values: what the box starts on, whether
 * pressing would write anything, what the button is called, and the one edit
 * it sends.
 *
 * {@link ./pick.ts} one field along, deliberately line for line — the same four
 * questions about the same kind of field, so the two files read as one
 * arrangement asked twice rather than as two designs. A repeat rule and a date
 * are both one optional string on the record with one value and no condition,
 * and a picker that decided them differently would be two products.
 *
 * ## The rule's OWN WORDS cross the wire
 *
 * The grammar is spelled in the file (docs/format.md), so a rule is text and
 * this layer parses none of it: what the chooser picks is what the record will
 * hold, character for character. The list it picks FROM is
 * `@olai/format`'s {@link REPEAT_RULES} — the grammar read off itself — so the
 * options a person sees and the strings the validator accepts are one list. A
 * `<select>` of hand-written labels would be the second grammar this feature
 * exists to not have.
 *
 * WHAT IS NOT HERE is any judgement about the rule. The validator is the gate
 * — on the set the write would produce, exactly as it is for an agent's
 * `set_repeat` — so a value this layer disliked would be a rule the web has and
 * MCP does not (HACKING.md). The one thing it fences is a GESTURE that would
 * produce no write at all, which is the draft's own rule ({@link pressOf}).
 */

import { canonicalRepeat } from "@olai/format"

import { type Press, pressOf as panelPress } from "../edit/panel.ts"
import type { Edit } from "@olai/surface"

/**
 * What the box starts with: the rule the node stores, IN THE LIST'S OWN
 * SPELLING, or nothing at all when it carries none — which is the empty
 * option, "does not repeat".
 *
 * Through `canonicalRepeat` rather than by testing membership of the list: a
 * node whose rule was written by this app already carries the canonical text,
 * and one hand-written `every monday` is the same rule spelled shorter, so
 * seeding the list with the rule it names is showing what the node says rather
 * than claiming it says nothing. Selecting it and pressing then writes nothing,
 * which is correct — {@link pressOf} compares against the stored text, and the
 * planner would store exactly what is already there.
 *
 * A rule this build's grammar cannot read at all (a file from a newer olai, a
 * hand edit that is not a rule) seeds NOTHING, so the box shows the empty
 * option rather than inventing a selection: {@link noticeOf} is what says so
 * out loud, and nothing is rewritten until the button is pressed.
 */
export const startsAt = (stored: string | undefined): string =>
  stored === undefined ? "" : canonicalRepeat(stored) ?? ""

/**
 * The one edit a pick sends — `set_repeat`'s own reach, and the constructor
 * the `•••` menu's `Stop repeating` calls as well ({@link ../menu/verbs.ts}).
 *
 * ONE FUNCTION FOR BOTH DOORS, for {@link ../date/pick.ts}'s reason word for
 * word: an empty choice is "does not repeat", which is `null`, and the ops
 * layer reads `null` and `""` as the same effect on disk — so a door that
 * started sending the other one would go on working while the two faces had
 * quietly split. There is nothing to compare, only one thing to call.
 */
export const repeatPick = (id: string, rule: string): Edit => ({
  verb: "repeat",
  id,
  repeat: rule === "" ? null : rule,
})

/**
 * What the button IS, over the rule the node stores and the one in the box —
 * the panel's own rule ({@link ../edit/RowPanel.tsx}) with this field's two
 * WORDS in it, exactly as {@link ./pick.ts} takes it one field along.
 *
 * `Stop repeating` is the `•••` menu's own verb for the edit {@link repeatPick}
 * spells with `null`, so the empty option and the menu entry are one gesture
 * under two doors rather than two spellings of one.
 */
export const pressOf = (stored: string | undefined, rule: string): Press =>
  panelPress(stored, rule, { set: "Set repeat", clear: "Stop repeating" })

/**
 * What the panel says about a stored rule the box cannot show — and nothing at
 * all for the ordinary case, which now includes a rule merely spelled short.
 *
 * A list picker shows the rules it has, so a node carrying words this build
 * cannot READ (a hand edit, a file from a newer olai) would look exactly like a
 * node that does not repeat. That is the one silence worth breaking, and it is
 * {@link ../date/pick.ts}'s `noticeOf` asking the same question about the other
 * field: the value is quoted verbatim, with what choosing would do to it.
 *
 * It asks the same `canonicalRepeat` {@link startsAt} does, so the notice and
 * the selection cannot disagree — a stored `every monday` seeds the list and
 * says nothing, where a membership test would have seeded nothing and called a
 * perfectly good rule unknown.
 */
export const noticeOf = (stored: string | undefined): string | undefined =>
  stored === undefined || canonicalRepeat(stored) !== undefined
    ? undefined
    : `This node repeats "${stored}", which is not a rule olai can read. ` +
      `Choosing one replaces it.`


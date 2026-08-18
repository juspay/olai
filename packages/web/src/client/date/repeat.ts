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

import { REPEAT_RULES } from "@olai/format"
import type { Edit } from "@olai/surface"

/** Every rule a person may choose, in the grammar's own order and its own
 *  spelling. Re-exported rather than re-listed: the picker draws this and the
 *  format validates against the same words. */
export const RULES: ReadonlyArray<string> = REPEAT_RULES

/**
 * What the box starts with: the rule the node stores, or nothing at all when
 * it carries none — which is the empty option, "does not repeat".
 *
 * A stored rule this build's grammar does not know (a file written by a newer
 * olai, or by hand) seeds NOTHING, so the box shows the empty option rather
 * than inventing a selection: {@link noticeOf} is what says so out loud, and
 * nothing is rewritten until the button is pressed.
 */
export const startsAt = (stored: string | undefined): string =>
  stored !== undefined && RULES.includes(stored) ? stored : ""

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

/** The button, as the two things a reader can see about it — {@link
 *  ../date/pick.ts}'s `Press`, and the same two questions. */
export interface Press {
  readonly label: string
  readonly writes: boolean
}

/**
 * What the button IS, over the rule the node stores and the one in the box.
 *
 * ONE answer for both halves, which is the bug the date picker's own `pressOf`
 * was written to make unreachable: a label and an enabled-ness derived
 * separately from the same two strings are two readings that can differ.
 *
 * **Dead means the write would ask for nothing** — an empty choice over a node
 * that does not repeat, or the rule it already carries. The ops layer would
 * take either from an agent; what is refused here is not a write but a gesture
 * that would produce none.
 *
 * **An emptied box is `Stop repeating`**, the menu's own words for the edit
 * {@link repeatPick} spells with `null`, so the picker ABSORBS that gesture
 * rather than adding a second spelling of it. Over a node that does not repeat
 * the words stay `Set repeat`, because a dead button naming a verb nobody can
 * perform is worse than one naming the verb they came for.
 */
export const pressOf = (stored: string | undefined, rule: string): Press =>
  rule === ""
    ? {
      label: stored === undefined ? "Set repeat" : "Stop repeating",
      writes: stored !== undefined,
    }
    : { label: "Set repeat", writes: rule !== stored }

/**
 * What the panel says about a stored rule the box cannot show — and nothing at
 * all for the ordinary case.
 *
 * A list picker shows the rules it has, so a node carrying words this build
 * does not know (a hand edit, a file from a newer olai) would look exactly like
 * a node that does not repeat. That is the one silence worth breaking, and it
 * is {@link ../date/pick.ts}'s `noticeOf` asking the same question about the
 * other field: the value is quoted verbatim, with what choosing would do to it.
 */
export const noticeOf = (stored: string | undefined): string | undefined =>
  stored === undefined || RULES.includes(stored)
    ? undefined
    : `This node repeats "${stored}", which is not one of the rules below. ` +
      `Choosing one replaces it.`


/**
 * What a picked day MEANS, as values: the box's starting text, whether
 * pressing the button would write anything, what the button is called, and the
 * one edit it sends.
 *
 * The picker's whole decision surface, pure over the two strings it has — the
 * date the node stores and the day the box holds — so the rules that matter
 * are answerable in a unit test rather than only by clicking a control
 * (`../edit/undo.ts` and `../menu/verbs.ts` are the same split).
 *
 * ## Dates are TEXT, and this is the file that has to mean it
 *
 * The format stores a date verbatim and validates it as text, because a
 * date-only `2026-08-10` put through an instant comes back a datetime
 * (docs/format.md). So nothing here parses one, formats one or does arithmetic
 * on one: a picked `YYYY-MM-DD` travels to the wire as those ten characters,
 * and the only reading taken of a stored value is `@olai/format`'s own
 * {@link dayOf} — the first ten characters, the rule spelled once for the
 * calendar, the agenda and now the picker.
 *
 * The control is `<input type="date">` for the same reason ({@link
 * ./DatePicker.tsx}): it cannot mint an instant. Its value is a day string or
 * nothing at all, which is exactly the two things this file maps.
 *
 * WHAT IS NOT HERE is any judgement about the date itself. The validator is
 * the gate — on the set the write would produce, as it is for an agent's
 * `set_date` — so a value this layer disliked would be a rule the web has and
 * MCP does not (HACKING.md). The one thing it fences is a write that would ask
 * for nothing, which is `../menu/verbs.ts`'s rule about entries that can only
 * produce "already so": a button that sends the date already stored is a
 * button whose only outcome is a shrug.
 *
 * Two functions and no state: {@link startsAt} is where the box begins,
 * {@link pressOf} is everything about the button, and {@link datePick} is the
 * one edit it sends. What a day MEANS is nobody's here — a date is text.
 */

import { dayOf } from "@olai/format"
import type { Edit } from "@olai/surface"

/**
 * What the box starts with: the DAY the node's stored date names, or nothing
 * at all when it carries none.
 *
 * A stored datetime seeds the day it falls on, which is the same reading the
 * calendar and the day pages take of it — and picking then replaces the whole
 * value, which is what {@link noticeOf} exists to say out loud.
 */
export const startsAt = (stored: string | undefined): string =>
  stored === undefined ? "" : dayOf(stored)

/**
 * The one edit a pick sends — `set_date`'s own reach, and the SAME edit the
 * `•••` menu's `Clear date` sends when the box has been emptied.
 *
 * One function for both halves, so the two spellings cannot drift: an empty
 * box is "no date", which is `null`, which is the value that verb has always
 * carried ({@link ../../../../surface/src/edit.ts}). The date is passed
 * through verbatim; nothing here has an opinion about what a day looks like.
 */
export const datePick = (id: string, day: string): Edit => ({
  verb: "date",
  id,
  date: day === "" ? null : day,
})

/** The button, as the two things a reader can see about it. */
export interface Press {
  /** What it says — which is the VERB, so the words are the ones the `•••`
   *  menu uses for the same edit. */
  readonly label: string
  /** Whether pressing it would ask the directory for anything. `false` draws
   *  it dead. */
  readonly writes: boolean
}

/**
 * What the button IS, over the node's stored date and the day in the box.
 *
 * ONE answer, and it is one because the two halves are one question. They were
 * two functions — what it says, and whether it does anything — and the first
 * shipped disagreeing with the second: an undated node's empty box read
 * `Clear date`, over a node with no date to clear, beside a button that was
 * correctly dead. A label and an enabled-ness derived separately from the same
 * two strings are two readings that can differ, which is the whole of that bug;
 * derived together they cannot.
 *
 * **Dead means the write would ask for nothing** — an empty box over a node
 * with no date, or the day it already carries. That is `../menu/verbs.ts`' rule
 * about entries whose only outcome would be "it already says that", one layer
 * down. A stored DATETIME is the case worth naming: `2026-08-11T15:40` and
 * `2026-08-11` are different records, so picking the day it falls on is a real
 * write.
 *
 * **An emptied box is `Clear date`** — the `•••` menu's own words, #124's verb,
 * for the edit {@link datePick} spells with `null`. The picker ABSORBS the
 * gesture rather than adding a second spelling of it; the alternative was a
 * button that went dead the moment somebody emptied the box, which is a dead
 * end in the one place a person is most likely to be reaching for exactly that.
 * Over a node with NO date the words stay `Set date`, because a dead button
 * naming a verb nobody can perform is worse than a dead one naming the verb
 * they came for.
 */
export const pressOf = (stored: string | undefined, day: string): Press =>
  day === ""
    ? { label: stored === undefined ? "Set date" : "Clear date", writes: stored !== undefined }
    : { label: "Set date", writes: day !== stored }

/**
 * What the panel says about a stored value the box cannot hold — and nothing
 * at all for the ordinary case.
 *
 * A day box shows a DAY, so a node scheduled for an instant seeds the day that
 * instant falls on, and picking writes that day: the time is not kept. That is
 * the right behaviour (a picker picks days) and a silent one, since the box
 * would look exactly the same either way — so it is said, verbatim, with the
 * value it is about. Nothing rewrites the record until the button is pressed.
 */
export const noticeOf = (stored: string | undefined): string | undefined =>
  stored === undefined || stored === dayOf(stored)
    ? undefined
    : `Scheduled for ${stored}. Picking a day writes that day, and the time goes with it.`

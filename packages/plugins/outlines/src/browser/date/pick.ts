/**
 * What a picked day and time MEAN, as values: what the boxes start with, the
 * value they come to, whether pressing the button would write anything, what
 * the button is called, and the one edit it sends.
 *
 * The picker's whole decision surface, pure over the strings it has — the date
 * the node stores, the day and the time the boxes hold — and the one question
 * that is not a string, which instant this browser's zone makes of a wall-clock
 * moment, arrives as an argument ({@link InstantAt}). So the rules that matter
 * are answerable in a unit test rather than only by clicking a control
 * (`../edit/undo.ts` and `../menu/verbs.ts` are the same split).
 *
 * ## Dates are TEXT, and this is the file that has to mean it
 *
 * The format stores a date verbatim and validates it as text, because a
 * date-only `2026-08-10` put through an instant comes back a datetime
 * (docs/format.md). So nothing here parses one or does arithmetic on one: a
 * picked `YYYY-MM-DD` travels to the wire as those ten characters, a picked
 * time is joined to it the way a mark's stamp is spelled (`T`, seconds, the
 * offset written out — `@olai/format`'s `stampOf`), and the only readings taken
 * of a stored value are `@olai/format`'s own — {@link dayOf} and {@link timeOf},
 * slices, the rule spelled once for the calendar, the agenda and the picker;
 * and, for the one question about its zone, `canonicalDate` and `offsetIn`,
 * which already know that `Z` and `+00:00` are one offset.
 *
 * The controls are `<input type="date">` and `<input type="time">` for the same
 * reason ({@link ./DatePicker.tsx}): neither can mint an instant. Their values
 * are a day string, an `HH:MM` string or nothing at all, which is exactly what
 * this file maps.
 *
 * WHAT IS NOT HERE is any judgement about the date itself. The validator is
 * the gate — on the set the write would produce, as it is for an agent's
 * `outlines_date` — so a value this layer disliked would be a rule the web has and
 * MCP does not (the consistency rule). The one thing it fences is a GESTURE that would
 * produce no write at all, which is the draft's own rule and not a fence on
 * what may be written ({@link pressOf}).
 */

import { canonicalDate, dayOf, offsetIn, stampOf, timeOf } from "@olai/format"

import { type Press, pressOf as panelPress } from "../edit/panel.ts"
import type { Edit } from "@olai/surface"

/** What the two boxes hold: a `YYYY-MM-DD` or `""`, and an `HH:MM` or `""`. */
export interface Chosen {
  readonly day: string
  readonly time: string
}

/**
 * The instant this browser's zone makes of a wall-clock moment on a day,
 * written as a stamp is (`2026-09-01T09:30:00-04:00`). A FUNCTION OF THE MOMENT
 * rather than of now, because a zone that moves its clocks keeps two offsets a
 * year: ten in the morning in December is not written with September's.
 *
 * It answers with the WHOLE instant, not an offset to staple onto the face,
 * because the face is not always one the zone has. Half past two on the
 * morning New York goes forward does not exist there; a resolver that took
 * only the offset `Date` landed on (`-04:00`, for the 03:30 it moved to) and
 * joined it to the 02:30 that was typed would write 01:30 EST — an hour
 * earlier than anything anybody chose. So the face and the offset come from
 * one reading, and the value can differ from the boxes, which
 * {@link noticeOf} says out loud before anything is written.
 */
export type InstantAt = (day: string, time: string) => string

/**
 * {@link InstantAt} for the zone this browser runs in — the one place `Date` is
 * asked anything.
 *
 * A time the clock SKIPS is moved forward by the length of the gap, which is
 * what every engine's `Date` does with it; a time the clock REPEATS (half past
 * one on the morning it goes back) is the one the engine picks. Either way the
 * face and the offset written are one instant, read together off the same
 * `Date` by `@olai/format`'s `stampOf`. The year is set with `setFullYear`
 * because the constructor reads `0050` as 1950.
 */
export const browserInstantAt: InstantAt = (day, time) => {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number]
  const [hours, minutes] = time.split(":").map(Number) as [number, number]
  const at = new Date(2000, 0, 1)
  at.setFullYear(year, month - 1, date)
  at.setHours(hours, minutes, 0, 0)
  return stampOf(at)
}

/**
 * What the boxes start with: the DAY the node's stored date names and the TIME
 * of day it names, or nothing in either.
 *
 * The time is the face a stored datetime was written with — the same five
 * characters the pill prints — not that instant converted into this browser's
 * zone: the boxes show what the file says, as every other face of a date does.
 */
export const startsAt = (stored: string | undefined): Chosen =>
  stored === undefined
    ? { day: "", time: "" }
    : { day: dayOf(stored), time: timeOf(stored) ?? "" }

/**
 * The VALUE the boxes come to — what pressing the button would store, with
 * `""` meaning no date at all.
 *
 *   - **No day is no date**, whatever the time box holds: a time of day on no
 *     day is not a value the format has, so emptying the day is the clear.
 *   - **A day with no time is that day**, the ten characters, which is how a
 *     time is taken off.
 *   - **A day and a time the stored value already says are the stored value,
 *     verbatim** — its seconds and its offset included. The boxes show a face
 *     in minutes, and reopening a picker and pressing Enter must not rewrite a
 *     record it did not change.
 *   - **Anything else is a new instant**, spelled the way a stamp is: the day,
 *     `T`, the time with `:00` seconds, and the offset this browser keeps at
 *     that moment ({@link InstantAt}) — "stamped where the person is standing",
 *     which is also what the format does with a datetime written with no zone.
 */
export const valueOf = (
  stored: string | undefined,
  chosen: Chosen,
  instantAt: InstantAt,
): string => {
  if (chosen.day === "") return ""
  if (chosen.time === "") return chosen.day
  if (stored !== undefined && dayOf(stored) === chosen.day && timeOf(stored) === chosen.time) {
    return stored
  }
  return instantAt(chosen.day, chosen.time)
}

/**
 * The one edit a pick sends — `outlines_date`'s own reach, and the constructor the
 * `•••` menu's `Clear date` calls as well ({@link ../menu/verbs.ts}).
 *
 * ONE FUNCTION FOR BOTH DOORS, and it is a function rather than two agreeing
 * literals because agreement is not a thing anyone can see: an empty box is
 * "no date", which is `null`, and the ops layer reads `null` and `""` as the
 * same effect on disk — so a door that started sending the other one would go
 * on working while the two faces had quietly split. There is nothing to
 * compare, only one thing to call.
 *
 * The value is passed through verbatim; nothing here has an opinion about what
 * a date looks like.
 */
export const datePick = (id: string, value: string): Edit => ({
  verb: "date",
  id,
  date: value === "" ? null : value,
})

/**
 * What the button IS, over the node's stored date and the value the boxes come
 * to ({@link valueOf}) — the panel's own rule ({@link ../edit/RowPanel.tsx})
 * with this field's WORDS in it.
 *
 * **`Clear date` is #124's menu verb**, and the picker absorbs the gesture
 * rather than adding a second spelling of it: the alternative was a button that
 * went dead the moment somebody emptied the box, in the one place a person is
 * most likely to be reaching for exactly that.
 *
 * **`Clear time` is the same gesture one box along**: the day it keeps is the
 * day already stored, so the only thing pressing does is take the time off,
 * and the button says that.
 *
 * **`null` is a value nobody can read** — a box the browser holds half-typed
 * ({@link ./DatePicker.tsx}, where that platform fact is kept). It writes
 * nothing, under the verb the person came for: a half-typed box reports no
 * value, and reading that as "no time" would write something other than what
 * the box shows.
 */
export const pressOf = (stored: string | undefined, value: string | null): Press =>
  value === null
    ? { label: "Set date", writes: false }
    : stored !== undefined && timeOf(stored) !== undefined && value === dayOf(stored)
    ? { label: "Clear time", writes: true }
    : panelPress(stored, value, { set: "Set date", clear: "Clear date" })

/**
 * What the panel says about the boxes, when they do not say the whole of what
 * pressing would write — and nothing at all for the ordinary case. Asked of the
 * DRAFT and of the `value` the button would send ({@link valueOf}), handed in
 * rather than worked out again, so the sentence and the button read one value.
 *
 *   - **A face the zone skips.** The value written is the moment the zone
 *     moves it to ({@link InstantAt}), which is not what the box says — so the
 *     sentence quotes the value, before it is written.
 *   - **A stored datetime from another zone** (or written with none). The
 *     boxes show its face like any other, and a change is written in THIS
 *     zone: with the draft changed, the sentence quotes exactly what pressing
 *     writes — whose offset is the draft's moment's, not the stored one's; with
 *     it unchanged, it says a change would be written here and names no offset,
 *     since which one depends on the day and time that are not chosen yet.
 *
 * A half-typed box has a sentence too, and it is not here: it is about the
 * element rather than about any value ({@link ./DatePicker.tsx}).
 */
export const noticeOf = (
  stored: string | undefined,
  chosen: Chosen,
  value: string,
  instantAt: InstantAt,
): string | undefined => {
  const written = value !== stored && timeOf(value) !== undefined ? value : undefined
  const storedTime = stored === undefined ? undefined : timeOf(stored)
  // Compared as OFFSETS, read by the format's own readers: a zone-less value
  // has none and is always foreign, and a stored `Z` is `+00:00`.
  const foreign = stored !== undefined && storedTime !== undefined &&
    offsetIn(canonicalDate(stored, null) ?? "") !== offsetIn(instantAt(dayOf(stored), storedTime))
  const quoted = foreign ? `Scheduled for ${stored}. ` : ""
  if (written !== undefined && (dayOf(written) !== chosen.day || timeOf(written) !== chosen.time)) {
    return `${quoted}There is no ${chosen.time} on ${chosen.day} in this browser's time zone, so pressing writes ${written}.`
  }
  if (!foreign) return undefined
  if (written !== undefined) return `${quoted}Pressing writes ${written}, in this browser's time zone.`
  return value === stored
    ? `${quoted}A changed day or time is written in this browser's time zone.`
    : undefined
}

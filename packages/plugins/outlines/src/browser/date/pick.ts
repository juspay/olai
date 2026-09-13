/**
 * What a picked day and time MEAN, as values: what the boxes start with, the
 * value they come to, whether pressing the button would write anything, what
 * the button is called, and the one edit it sends.
 *
 * The picker's whole decision surface, pure over the strings it has — the date
 * the node stores, the day and the time the boxes hold — and the one question
 * that is not a string, which zone offset this browser keeps at a wall-clock
 * moment, arrives as an argument ({@link OffsetAt}). So the rules that matter
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
 * of a stored value are `@olai/format`'s own {@link dayOf} and {@link timeOf} —
 * slices, the rule spelled once for the calendar, the agenda and the picker.
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

import { dayOf, offsetOf, timeOf } from "@olai/format"

import { type Press, pressOf as panelPress } from "../edit/panel.ts"
import type { Edit } from "@olai/surface"

/** What the two boxes hold: a `YYYY-MM-DD` or `""`, and an `HH:MM` or `""`. */
export interface Chosen {
  readonly day: string
  readonly time: string
}

/**
 * The zone offset, as ISO spells it, that this browser keeps at a wall-clock
 * moment on a day. A FUNCTION OF THE MOMENT rather than of now, because a zone
 * that moves its clocks keeps two offsets a year: ten in the morning in
 * December is not written with September's.
 */
export type OffsetAt = (day: string, time: string) => string

/**
 * {@link OffsetAt} for the zone this browser runs in — the one place `Date` is
 * asked anything, and asked only for the offset, never for the text: what is
 * written is still the day and the time the boxes hold.
 *
 * A time a clock skips (half past two on the morning it goes forward) is read
 * with the offset `Date` lands on for it, which is what the platform does with
 * that moment everywhere else in the tab.
 */
export const browserOffsetAt: OffsetAt = (day, time) => {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number]
  const [hours, minutes] = time.split(":").map(Number) as [number, number]
  return offsetOf(new Date(year, month - 1, date, hours, minutes).getTimezoneOffset())
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
 *     that moment ({@link OffsetAt}) — "stamped where the person is standing",
 *     which is also what the format does with a datetime written with no zone.
 */
export const valueOf = (
  stored: string | undefined,
  chosen: Chosen,
  offsetAt: OffsetAt,
): string => {
  if (chosen.day === "") return ""
  if (chosen.time === "") return chosen.day
  if (stored !== undefined && dayOf(stored) === chosen.day && timeOf(stored) === chosen.time) {
    return stored
  }
  return `${chosen.day}T${chosen.time}:00${offsetAt(chosen.day, chosen.time)}`
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
 * and the button says that. It is also how a time box a browser has half
 * emptied — whose value is then nothing — says so before anything is written.
 */
export const pressOf = (stored: string | undefined, value: string): Press =>
  stored !== undefined && timeOf(stored) !== undefined && value === dayOf(stored)
    ? { label: "Clear time", writes: true }
    : panelPress(stored, value, { set: "Set date", clear: "Clear date" })

/**
 * What the panel says about a stored value the boxes cannot say whole — and
 * nothing at all for the ordinary case.
 *
 * The boxes show a face, a day and a time, and a stored datetime also carries
 * an offset. When that offset is the one this browser keeps at that moment the
 * face is the whole story; when it is not — written in another zone, or by a
 * hand that wrote none — changing either box writes the new face in THIS zone,
 * and the boxes would look exactly the same either way. So it is said,
 * verbatim, with the value it is about. Nothing rewrites the record until the
 * button is pressed, and pressing it over an unchanged face writes nothing.
 */
export const noticeOf = (
  stored: string | undefined,
  offsetAt: OffsetAt,
): string | undefined => {
  const time = stored === undefined ? undefined : timeOf(stored)
  if (stored === undefined || time === undefined) return undefined
  const here = offsetAt(dayOf(stored), time)
  return stored.endsWith(here)
    ? undefined
    : `Scheduled for ${stored}. A changed day or time is written in this browser's time zone (${here}).`
}

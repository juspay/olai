/**
 * The line itself: what it is made of, and what ink it takes.
 *
 * The agenda is ONE CONTINUOUS SPINE OF TIME — no Overdue / Today / Upcoming
 * boxes — because three boxes gave a task seventy-three days out the same claim
 * on a reader as one due on Monday (`agenda-spine`, ruled 2026-08-18). This
 * file is that line's assembly and its ink; ./gutter.ts is where it runs,
 * ./Day.tsx draws one day against it and ./Spine.tsx puts them in order.
 *
 * ## The ink is TOKENS, never values
 *
 * A tone arrives as a palette token's NAME (`@olai/format`'s `Tone`) and
 * becomes a custom property here — through `../theme/css.ts`'s own
 * `customProperty`, which is where that namespace is decided, so a renamed one
 * is a rename there rather than a second spelling here. All fifteen palettes
 * then follow a line drawn once. The two places a colour has to be MIXED — the
 * line fading out past the last day, and the ring around now — go through
 * `color-mix` over the same tokens rather than a hex with an alpha on it.
 *
 * ## Why the line is drawn per DAY and not once down the page
 *
 * A single element behind everything would need to know, in pixels, where today
 * sits — which is a measurement, taken after layout, of a page that reflows
 * with the density preference, the font size and the width of the pane. Each
 * rung painting its own stretch needs no measurement at all: the tone at the
 * top of a rung is the day before's, the tone through it is its own, and the
 * transition happens across the silence that is already there. The rungs abut
 * (their spacing is padding INSIDE them, never margin between them), so what a
 * reader sees is one line.
 */

import {
  type Agenda,
  type AgendaDay,
  type DayEntry,
  type Felt,
  feltOn,
  type Quiet,
  quietBetween,
  type Tone,
} from "@olai/format"

import { tokenValue } from "../theme/css.ts"

/** How much room the line takes before the FIRST day of the page — the stretch
 *  it fades in over, so the page does not open on a line that starts mid-air. */
const LEAD = 1.75

/** And after the last, fading out: the future recedes past whatever the
 *  directory happens to know about. */
export const TAIL = "h-10"

/** A palette token as a value a style attribute can hold. Absent is the ink of
 *  nothing at all, which is what the line is above its first day. */
export const inkOf = (tone: Tone | undefined): string =>
  tone === undefined ? "transparent" : tokenValue(tone)

/** The ring that makes NOW a place rather than a louder dot: the page's own
 *  paper first, so the line does not touch the dot, then the accent at a fifth
 *  of its strength. Ink, not geometry — which is why it is here and the dot's
 *  size is in ./gutter.ts. */
export const NOW_RING = `0 0 0 3px ${tokenValue("paper")}, ` +
  `0 0 0 4px color-mix(in srgb, ${tokenValue("accent")} 35%, transparent)`

/**
 * One day of the line: the day, how it is felt from today, the silence before
 * it, and the ink the line arrives wearing.
 *
 * A RECORD rather than four arguments threaded through the components, because
 * every one of them is a fact about the same day and two of them are computed
 * from the day BEFORE it — which is a thing a component drawing one row cannot
 * see.
 */
export interface Rung {
  readonly day: AgendaDay
  readonly felt: Felt
  /** The room above this day, and what to call it.
   *
   *  For the FIRST rung it is the lead-in, and the degenerate `Quiet` is exact
   *  rather than a stand-in: there is no earlier day for it to be between, so
   *  nought days have been waited and there is nothing to call the wait — what
   *  is left is the room, which is {@link LEAD}. A union naming the two cases
   *  would say the same thing one type louder, and nothing reads them apart:
   *  the label is drawn when there is one, and `days` reaches the page only
   *  alongside a label. */
  readonly quiet: Quiet
  /** The tone the line is already wearing when it reaches this rung —
   *  `undefined` at the top of the page, where it fades in out of nothing. */
  readonly from: Tone | undefined
}

/**
 * The days of the line, in time order, each knowing what came before it.
 *
 * NOW IS ALWAYS ONE OF THEM, inserted between what has gone and what is
 * coming: the whole ruling is that now is a PLACE on the line rather than a
 * section that vanishes, so the dot is drawn on a day nothing is due on. What
 * it is not drawn on is a page with no days at all — an empty agenda says
 * "Nothing is due." and draws no line (`@olai/format`'s `nothingDue`, which is
 * what the page asks before it calls this).
 *
 * Pure, and unit-tested directly (./spine.test.ts): the order of a line and the
 * gaps in it are exactly the kind of thing that is right for a page with three
 * days on it and wrong for one with two.
 */
export const rungsOf = (
  agenda: Agenda,
  today: string,
): ReadonlyArray<Rung> => {
  const days: ReadonlyArray<AgendaDay> = [
    ...agenda.overdue,
    { date: today, groups: agenda.today },
    ...agenda.upcoming,
  ]
  // Each day felt ONCE. The ink a rung arrives wearing is the day above's, and
  // reading it back off that day's own reading is what makes it the same
  // answer — asking `feltOn` a second time about a day already read would be
  // two chances for the top of one stretch to disagree with the bottom of the
  // one over it.
  const felts = days.map((day) => feltOn(day.date, today))
  return days.map((day, index) => ({
    day,
    felt: felts[index]!,
    quiet: index === 0
      ? { days: 0, label: undefined, space: LEAD }
      : quietBetween(days[index - 1]!.date, day.date),
    from: felts[index - 1]?.tone,
  }))
}

/**
 * The rows one day draws, read end to end across its outlines.
 *
 * The chrome cut, as a function: the format groups a day's records by the
 * outline they live in (`byOutline` — the only heading that is true, since a
 * `parent` never crosses a file), and this page draws no heading between them,
 * so the groups are simply concatenated in the order they came. It is HERE
 * rather than inline in ./Day.tsx because it is the spine's decision and not a
 * row's: the day pages still draw that heading (../day/DayGroups.tsx), and the
 * one page that does not should say so somewhere a reader can find it.
 *
 * The order survives the flattening — path order, then time within a day — and
 * that is what makes it safe: nothing is re-sorted here, so the rows a day
 * lists are the rows the format put in it.
 */
export const rowsOn = (day: AgendaDay): ReadonlyArray<DayEntry> =>
  day.groups.flatMap((group) => group.nodes)

/**
 * The stretch of line one rung paints: the tone it arrived wearing, becoming
 * its own by the time the day itself starts.
 *
 * The change happens ACROSS THE SILENCE, which is the one place on the page
 * where a gradient is honest — a tone that shifted alongside a row would be
 * saying something about that row. Below the wait it is flat, so a day whose
 * work runs to twenty rows is one colour from its dot to its last line.
 */
export const lineOf = (rung: Rung): string =>
  `linear-gradient(to bottom, ${inkOf(rung.from)} 0, ` +
  `${inkOf(rung.felt.tone)} ${rung.quiet.space}rem, ` +
  `${inkOf(rung.felt.tone)} 100%)`

/** The line running out past the last day the directory knows about. */
export const tailOf = (tone: Tone): string =>
  `linear-gradient(to bottom, ${inkOf(tone)}, transparent)`

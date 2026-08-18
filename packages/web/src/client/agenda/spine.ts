/**
 * The line itself: where it runs, what ink it takes, and what a day's stretch
 * of it is made of.
 *
 * The agenda is ONE CONTINUOUS SPINE OF TIME — no Overdue / Today / Upcoming
 * boxes — because three boxes gave a task seventy-three days out the same claim
 * on a reader as one due on Monday (`agenda-spine`, ruled 2026-08-18). This
 * file is that line's geometry and its assembly; ./Day.tsx draws one day
 * against it and ./Spine.tsx puts them in order.
 *
 * ## The gutter (arithmetic, once, the way ../touch.ts does it)
 *
 * A rung's left side, left to right:
 *
 *   gutter (2.5rem) · the row's own content
 *
 * and inside the gutter, centred on its middle:
 *
 *   the LINE      2px wide, from 1.25rem − 1px          → centre 1.25rem
 *   a DAY DOT     7px, centred in a 2.5rem cell         → centre 1.25rem
 *   the NOW DOT   11px, same cell, plus a paper ring    → centre 1.25rem
 *
 * Everything is centred in the same cell, so the dots and the line cannot drift
 * apart when one of the three numbers moves — which is the whole reason they
 * are declared together here rather than at the three sites that draw them.
 * Literal class names, never computed ones: Tailwind scans this file as text.
 *
 * ## The ink is TOKENS, never values
 *
 * A tone arrives as a palette token's NAME (`@olai/format`'s `Tone`) and
 * becomes `var(--color-…)` here and nowhere else, so all fifteen palettes
 * follow a line drawn once (../theme/palettes.ts). The two places a colour has
 * to be MIXED — the line fading out past the last day, and the ring around now
 * — go through `color-mix` over the same tokens rather than a hex with an
 * alpha on it.
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
  type Felt,
  feltOn,
  type Quiet,
  quietBetween,
  type Tone,
} from "@olai/format"

/** The gutter the line runs in — what everything to the right of it is
 *  indented by. */
export const SPINE_INDENT = "pl-10"

/** One cell of that gutter, holding a dot centred on the line. */
export const SPINE_CELL = "flex w-10 shrink-0 items-center justify-center"

/** The line through one rung. `top-0 bottom-0` over a rung that is `relative`,
 *  so a stretch is exactly as tall as the day it belongs to. */
export const SPINE_LINE = "absolute left-[calc(1.25rem-1px)] top-0 bottom-0 w-0.5"

/** A listed day, on the line. */
export const SPINE_DOT = "size-[7px] shrink-0 rounded-full"

/** NOW, on the line: bigger, and ringed in the page's own paper so it reads as
 *  a place rather than as a louder dot. */
export const SPINE_NOW = "size-[11px] shrink-0 rounded-full"

/** The ring, as the one shadow it is: paper first so the line does not touch
 *  the dot, then the accent at a fifth of its strength. */
export const NOW_RING = "0 0 0 3px var(--color-paper), " +
  "0 0 0 4px color-mix(in srgb, var(--color-accent) 35%, transparent)"

/** How much room the line takes before the FIRST day of the page — the stretch
 *  it fades in over, so the page does not open on a line that starts mid-air. */
const LEAD = 1.75

/** And after the last, fading out: the future recedes past whatever the
 *  directory happens to know about. */
export const TAIL = "h-10"

/** A palette token as a value a style attribute can hold. Absent is the ink of
 *  nothing at all, which is what the line is above its first day. */
export const inkOf = (tone: Tone | undefined): string =>
  tone === undefined ? "transparent" : `var(--color-${tone})`

/**
 * One day of the line: the day, how it is felt from today, the silence before
 * it, and the ink the line arrives wearing.
 *
 * A RECORD rather than four arguments threaded through the components, because
 * every one of them is a fact about the same day and three of them are
 * computed from the day BEFORE it — which is a thing a component drawing one
 * row cannot see.
 */
export interface Rung {
  readonly day: AgendaDay
  readonly felt: Felt
  /** The wait since the day above. For the first rung it is the lead-in, which
   *  is a length and not a silence: there is no earlier day for it to be
   *  between, so it carries no label. */
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

/**
 * How much is owed, as the mark the DIRECTORY wears — the agenda's answer read
 * from outside the agenda.
 *
 * The page lists what is late; this is what says so from the column beside it,
 * so a reader working in an outline finds out that something slipped without
 * opening the page that would have told them. It is a READOUT and it is built
 * like the other two (../readout.ts, ../connection/status.ts): a state, a table
 * of how that state looks, and the sentence it says out loud — the table living
 * beside the thing it reports on rather than inside the component that draws it,
 * because a third place that marks the agenda (the icon rail is the second) must
 * not be a third argument about what late work looks like.
 *
 * ## Two faces, and why they are the two the date badge already has
 *
 * The app has one alarm vocabulary and it is spent on the DATE: a pill that
 * turns `alarm` when the node it belongs to is overdue, and stays `pill`/muted
 * when it is not (../DateBadge.tsx). That is the same predicate this counts, so
 * this wears the same two faces rather than inventing a third — the loud one is
 * the alarm turned all the way up (a FILLED chip, paper on alarm, which is the
 * palette's own checked contrast pair) because a chip inside a washed row cannot
 * be a wash itself, and the quiet one is the badge's own quiet face, untouched.
 *
 * The two differ by more than a colour, which is the calendar's rule for marks
 * that share a cell (../calendar/Day.tsx): the loud one takes the ROW as well —
 * alarm ink, semibold, a wash behind it — and the quiet one takes nothing but
 * the chip. So "late" and "on today" are still two different sights in a
 * monochrome screenshot, at whatever palette is in force, and both are SAID in
 * the entry's own label, since a colour is silence to a screen reader.
 *
 * ## Loud wins whole, and the quiet number is not lost
 *
 * When both are true the row is the alarm's, and the chip prints the OVERDUE
 * count alone. Two numerals in a 13px row is a thing a reader has to decode, and
 * this app's chrome rule is one claim per readout ("one green claim per page, or
 * neither is scanned" — ../readout.ts): the number that decides whether to press
 * is the late one. The other is not dropped — it rides the sentence the entry
 * says, and `data-today` carries it for a test — and it is shown in full one
 * click away, on the page that is the answer.
 */

import { type Agenda, type Owed, owedOf } from "@olai/format"

/** Which of the three the entry is wearing. `quiet` is today's entry, unchanged
 *  — an agenda with nothing late and nothing on today is a door, not news. */
export type Face = "overdue" | "today" | "quiet"

/** The chip's shape, which both faces wear: the date badge's pill, sized for a
 *  13px row. Colour is the face's and is the only thing that moves — one
 *  decision per property, the calendar's rule (../calendar/Day.tsx). */
const CHIP = "ml-auto shrink-0 rounded-full px-1.5 text-xs leading-5 tabular-nums"

/** How one face is drawn, and what it says. */
export interface Look {
  readonly face: Face
  /** BOTH numbers, whichever is being printed — they are the facts the entry
   *  carries as `data-`, so a scenario asks how many are late rather than what
   *  colour that made something. */
  readonly owed: Owed
  /** What the chip prints: the overdue count when anything is late, the today
   *  count when nothing is. The one ruling in this table — loud wins whole —
   *  and it is here rather than in the component for that reason. */
  readonly count: number
  /** The row's own utilities, over ../Sidebar.tsx's ENTRY. Empty when quiet:
   *  the entry keeps every class it always had. */
  readonly entry: string
  /** The chip, whole. Empty when there is none to draw. */
  readonly chip: string
  /** The rail's mark, where there is no room for a number
   *  (../layout/Rail.tsx) — the COLOUR of a dot; where it sits over the icon is
   *  the rail's own business. */
  readonly dot: string
  /** What the entry says out loud — its `aria-label` and its `title`, never
   *  hover-only. `undefined` when quiet, so the link is announced as the word
   *  it already is. */
  readonly said: string | undefined
}

const NOTHING: Owed = { overdue: 0, today: 0 }

const QUIET: Look = {
  face: "quiet",
  owed: NOTHING,
  count: 0,
  entry: "",
  chip: "",
  dot: "",
  said: undefined,
}

/**
 * The mark for one reading of the agenda, or the quiet face for no reading at
 * all.
 *
 * `undefined` is the frame before the first snapshot arrives, and it draws
 * NOTHING rather than a zero: a mark that claimed "nothing is late" out of a
 * directory it has not read yet is the one lie a readout may never tell (the
 * connection pill's rule, ../connection/Indicator.tsx). The app draws
 * "Reading…" in that frame anyway, so this is a promise about the code rather
 * than a sight anybody meets.
 */
export const lookOf = (agenda: Agenda | undefined): Look => {
  if (agenda === undefined) return QUIET
  const owed = owedOf(agenda)
  if (owed.overdue > 0) {
    return {
      face: "overdue",
      owed,
      count: owed.overdue,
      entry: "bg-alarm/10 text-alarm font-semibold",
      chip: `${CHIP} bg-alarm font-semibold text-paper`,
      dot: "bg-alarm",
      said: said(owed.overdue, owed.today),
    }
  }
  if (owed.today > 0) {
    return {
      face: "today",
      owed,
      count: owed.today,
      entry: "",
      chip: `${CHIP} bg-pill text-muted`,
      dot: "bg-muted",
      said: said(0, owed.today),
    }
  }
  return QUIET
}

/** The sentence, in the words the page's own sections are headed with — and
 *  never the word *due* for the today half, which holds occurrences (a birthday
 *  is on today and is nobody's late work). */
const said = (overdue: number, today: number): string => {
  const late = overdue > 0 ? [`${overdue} overdue`] : []
  const on = today > 0 ? [`${today} on today`] : []
  return `Agenda — ${[...late, ...on].join(", ")}`
}

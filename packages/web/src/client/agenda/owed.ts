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

/** The chip's SHAPE, which both faces wear: the date badge's pill, sized for a
 *  13px row. Paint is the face's and where it sits is the consumer's — the
 *  boundary the `dot` below keeps too, so a third place that marks the agenda
 *  inherits no layout it has to undo. */
const CHIP = "rounded-full px-1.5 text-xs leading-5 tabular-nums"

/** The mark one reading calls for: what it is, what it counts, how it is
 *  painted, and what it says. Named for what it IS rather than `Look`, which
 *  ../readout.ts already owns for the header's two pills. */
export interface Mark {
  readonly face: Face
  /** BOTH numbers, whichever is being printed — they are the facts the entry
   *  carries as `data-`, so a scenario asks how many are late rather than what
   *  colour that made something. */
  readonly owed: Owed
  /** What the chip prints: the overdue count when anything is late, the today
   *  count when nothing is. The one ruling in this table — loud wins whole —
   *  and it is here rather than in the component for that reason. */
  readonly count: number
  /** The row's ink and ground, over ../Sidebar.tsx's ENTRY_SHAPE. Empty on
   *  the quiet and today faces: the spine already paints paper, and a second
   *  `text-ink` here would be forest on forest. The alarm names its own. */
  readonly entry: string
  /** The chip's paint, or empty where there is no chip — which is also how a
   *  consumer asks whether to draw one, so "is there a mark" is decided here
   *  rather than in each of them. */
  readonly chip: string
  /** The rail's mark, where there is no room for a number (../layout/Rail.tsx),
   *  and empty on the same terms as the chip. A FILLED dot for the alarm and a
   *  RING for the nudge: they share a place, so they differ by shape and not
   *  only by colour (../calendar/Day.tsx's rule). Where it sits over the icon is
   *  the rail's own business. */
  readonly dot: string
  /** What the entry says out loud — its `aria-label` and its `title`, never
   *  hover-only. `undefined` when quiet, so the link is announced as the word
   *  it already is. */
  readonly said: string | undefined
}

/** Nothing owed, and nothing read yet, which draw the same: no claim. */
const NOTHING: Owed = { overdue: 0, today: 0 }

/** How each face is PAINTED, and the only part of a mark that is a table
 *  lookup — everything else about one is read off the counts. */
const PAINT: Record<Face, { readonly entry: string; readonly chip: string; readonly dot: string }> = {
  overdue: {
    entry: "bg-alarm/10 font-semibold text-alarm",
    chip: `${CHIP} bg-alarm font-semibold text-paper`,
    dot: "bg-alarm",
  },
  today: {
    entry: "",
    chip: `${CHIP} bg-pill text-muted`,
    dot: "border border-muted bg-transparent",
  },
  quiet: { entry: "", chip: "", dot: "" },
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
 *
 * LOUD WINS WHOLE is the one ruling here, and it is spelled twice because it
 * decides two different things: which face, and which number that face prints.
 */
export const markOf = (agenda: Agenda | undefined): Mark => {
  const owed = agenda === undefined ? NOTHING : owedOf(agenda)
  const face: Face = owed.overdue > 0 ? "overdue" : owed.today > 0 ? "today" : "quiet"
  return {
    face,
    owed,
    count: face === "overdue" ? owed.overdue : owed.today,
    ...PAINT[face],
    said: face === "quiet" ? undefined : said(owed),
  }
}

/**
 * Has anything a reader could SEE changed?
 *
 * A mark is minted fresh on every revision the store publishes, and reference
 * equality would push all nine of its bindings into the DOM on each of them —
 * a class, a label, a title and three `data-` facts rewritten because somebody
 * typed a character in an outline. The counts are the whole of what this
 * readout says (the face, the paint and the sentence are all read off them), so
 * comparing them is comparing the mark.
 */
export const unchanged = (before: Mark, after: Mark): boolean =>
  before.owed.overdue === after.owed.overdue && before.owed.today === after.owed.today

/** The sentence, in the words the page's own sections are headed with — and
 *  never the word *due* for the today half, which holds occurrences (a birthday
 *  is on today and is nobody's late work). Both numbers, whichever one the chip
 *  went on to print. */
const said = (owed: Owed): string => {
  const late = owed.overdue > 0 ? [`${owed.overdue} overdue`] : []
  const on = owed.today > 0 ? [`${owed.today} on today`] : []
  return `Agenda — ${[...late, ...on].join(", ")}`
}

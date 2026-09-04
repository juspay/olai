/**
 * One day of the month, and the four marks a reader has to tell apart at a
 * glance in a 16rem column.
 *
 * They are four DIFFERENT marks on purpose — the racket reference says the
 * first draft drew all of them with ink and weight, and in a real browser you
 * could not see any of them:
 *
 *   has something   full ink, and a dot under the number, the way every
 *                   calendar marks a day that has entries;
 *   has a note      a corner fold in the top-right — a document named for this
 *                   date is that day's note. A different SHAPE in a different
 *                   PLACE, because the two say different things and a day can
 *                   wear both: a dot that changed size or shade would be a mark
 *                   nobody could read without the other one beside it. Both are
 *                   also SAID, in the cell's own label ({@link Day}'s `said`) —
 *                   a pseudo-element has no text, so a shape distinction is
 *                   silence to a screen reader;
 *   today           a ring, wherever it falls and whatever else it is;
 *   you are here    FILLED — ink ground, paper number. The day you are reading
 *                   is not a shade of a day, it is the day. It outranks its own
 *                   hover, because the pointer is still over the cell that was
 *                   just clicked.
 *
 * EVERY cell is a LINK to `/d/<date>`. A day with neither mark still goes
 * somewhere: the page that says so, honestly, rather than a click that writes
 * a file. Creating that day's note is the day page's (`../day/DayMint.tsx`),
 * not this cell's — a day is the smallest target in the app, and a navigation
 * gesture must not mint.
 *
 * The box is the same size in every state, so the month does not jump about as
 * a reader moves through it.
 */

import { Link } from "@olai/web/client/router.tsx"
import { TESTID } from "../../testids.ts"
import { TARGET } from "@olai/web/client/touch.ts"
import { dayNumber } from "./month.ts"
import { dayRoute } from "../routes.ts"

/** The cell itself, in every state: same size, same place, centred. It carries
 *  no colour of its own — every property the marks below touch is decided in
 *  exactly one of them, because two utilities setting the same property are
 *  settled by the order Tailwind emitted its rules in and not by the order
 *  they were written here.
 *
 *  Its HEIGHT is the one thing that changes with the pointer: a target below
 *  48rem (../touch.ts), the compact 1.75rem row above it. A day is the
 *  smallest target in this app and the one a finger is likeliest to miss into
 *  the day beside it. `w-full` so the hit area is the grid cell, not the
 *  number. */
const BOX = `flex ${TARGET} relative w-full items-center justify-center rounded-lg border ` +
  "text-xs tabular-nums no-underline md:min-h-6"

/** The dot, as the pseudo-element it has to be — it sits UNDER the number
 *  rather than beside it, and `currentColor` is what makes it follow the cell
 *  into the fill rather than carrying a colour of its own to keep in step.
 *
 *  What it does NOT set is `position` on the cell: this mark and the fold below
 *  are both absolute, so the containing block is the BOX's to declare — two of
 *  them setting one property is the thing the note above forbids. */
const DOT =
  "after:absolute after:bottom-0.5 after:h-1 after:w-1 " +
  "after:rounded-full after:bg-current after:opacity-70 after:content-['']"

/** The corner fold, the other pseudo-element — a triangle drawn out of two
 *  borders against two transparent ones, which is the one way to get a
 *  diagonal with no image and no extra element.
 *
 *  TOP-RIGHT, where the dot is not: what makes these two legible together in a
 *  cell this small is that they never share a place, so a day carrying both
 *  reads as a day carrying both rather than as a dot somebody smudged. The
 *  fold is a dog-ear on a page, which is the thing it stands for. Inset a
 *  pixel so it sits inside the cell's own rounded border rather than across
 *  it, and `border-current` for the reason the dot is `bg-current` — it
 *  follows the cell into the fill. */
const FOLD =
  "before:absolute before:right-px before:top-px before:border-[0.22rem] " +
  "before:border-b-transparent before:border-l-transparent before:border-current " +
  "before:opacity-60 before:content-['']"

export function Day(props: {
  readonly date: string
  /** At least one node in the whole set is dated this day. */
  readonly dated: boolean
  /** A document of the directory is named for this date — the day's note. */
  readonly noted: boolean
  readonly today: boolean
  /** This is the day the open page is of. */
  readonly open: boolean
}) {
  /** The cell has SOMETHING to show — from the set, or from a file somebody
   *  wrote. It is what decides the ink and the weight; every cell is a link
   *  regardless, because an empty day still has a page. */
  const live = (): boolean => props.dated || props.noted

  /**
   * What the cell says OUT LOUD — the date, and which of the two marks it is
   * wearing.
   *
   * The marks are a different shape in a different place, which is the whole of
   * how a sighted reader tells a note-day from a node-day. A screen reader gets
   * none of that: a `::before` and an `::after` have no text, so a note-only
   * cell and a nodes-only cell used to be announced identically, as the date
   * and nothing else. The two facts are already on the element for the browser
   * tests; this is the same two facts for the reader who cannot see them.
   *
   * A quiet day says only the date. It is a link, not a creation affordance,
   * so there is nothing else to announce.
   */
  const said = (): string =>
    live()
      ? `${props.date}, ${
        props.dated
          ? props.noted ? "has a note and dated nodes" : "has dated nodes"
          : "has a note"
      }`
      : props.date

  // One decision per CSS property, so the marks stack the way the reference
  // does rather than the way the stylesheet happened to be sorted. Today and
  // open together is the ring around the fill: the ring says which day it is,
  // the fill says you are standing on it.
  const ink = (): string =>
    props.open
      ? "text-paper"
      : props.today
      ? "text-accent"
      : live()
      ? "text-ink"
      : "text-muted"
  const ground = (): string => props.open ? "bg-ink" : "hover:bg-rule"
  const ring = (): string =>
    props.today ? "border-accent" : props.open ? "border-ink" : "border-transparent"

  const look = (): string =>
    [
      BOX,
      ink(),
      ground(),
      ring(),
      props.dated ? DOT : "",
      props.noted ? FOLD : "",
      live() || props.today || props.open ? "font-semibold" : "",
    ]
      .filter((part) => part !== "")
      .join(" ")

  return (
    <div
      data-testid={TESTID.calendarDay}
      data-date={props.date}
      data-dated={String(props.dated)}
      data-noted={String(props.noted)}
      data-today={String(props.today)}
      data-open={String(props.open)}
    >
      <Link
        route={dayRoute(props.date)}
        class={look()}
        title={props.date}
        label={said()}
        current={props.open}
      >
        {dayNumber(props.date)}
      </Link>
    </div>
  )
}

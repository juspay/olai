/**
 * One day of the month, and the three marks a reader has to tell apart at a
 * glance in a 16rem column.
 *
 * They are three DIFFERENT marks on purpose — the racket reference says the
 * first draft drew all of them with ink and weight, and in a real browser you
 * could not see any of them:
 *
 *   has something   full ink, and a dot under the number, the way every
 *                   calendar marks a day that has entries. The only kind of
 *                   cell that goes anywhere, so the only one that answers the
 *                   pointer;
 *   today           a ring, wherever it falls and whatever else it is;
 *   you are here    FILLED — ink ground, paper number. The day you are reading
 *                   is not a shade of a day, it is the day. It outranks its own
 *                   hover, because the pointer is still over the cell that was
 *                   just clicked.
 *
 * A day with nothing on it is INERT: a dim number, no link, nothing to press.
 * Pressing it could only mean "write something here", and this pane writes
 * nothing — that arrives with the editing ops.
 *
 * The box is the same size in every state, so the month does not jump about as
 * a reader moves through it.
 */

import { Show } from "solid-js"

import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"
import { dayNumber } from "./month.ts"

/** The cell itself, in every state: same size, same place, centred. It carries
 *  no colour of its own — every property the marks below touch is decided in
 *  exactly one of them, because two utilities setting the same property are
 *  settled by the order Tailwind emitted its rules in and not by the order
 *  they were written here.
 *
 *  Its HEIGHT is the one thing that changes with the pointer: a target below
 *  48rem (../touch.ts), the compact 1.75rem row above it. A day is the
 *  smallest target in this app and the one a finger is likeliest to miss into
 *  the day beside it. */
const BOX = `flex ${TARGET} items-center justify-center rounded border text-xs ` +
  "tabular-nums no-underline md:min-h-7"

/** The dot, as the pseudo-element it has to be — it sits UNDER the number
 *  rather than beside it, and `currentColor` is what makes it follow the cell
 *  into the fill rather than carrying a colour of its own to keep in step. */
const DOT =
  "relative after:absolute after:bottom-0.5 after:h-1 after:w-1 " +
  "after:rounded-full after:bg-current after:opacity-70 after:content-['']"

export function Day(props: {
  readonly date: string
  /** At least one node in the whole set is dated this day. */
  readonly dated: boolean
  readonly today: boolean
  /** This is the day the open page is of. */
  readonly open: boolean
}) {
  // One decision per CSS property, so the marks stack the way the reference
  // does rather than the way the stylesheet happened to be sorted. Today and
  // open together is the ring around the fill: the ring says which day it is,
  // the fill says you are standing on it.
  const ink = (): string =>
    props.open
      ? "text-paper"
      : props.today
      ? "text-accent"
      : props.dated
      ? "text-ink"
      : "text-muted"
  const ground = (): string =>
    props.open ? "bg-ink" : props.dated ? "hover:bg-rule" : ""
  const ring = (): string =>
    props.today ? "border-accent" : props.open ? "border-ink" : "border-transparent"

  const look = (): string =>
    [
      BOX,
      ink(),
      ground(),
      ring(),
      props.dated ? DOT : "",
      props.dated || props.today || props.open ? "font-semibold" : "",
    ]
      .filter((part) => part !== "")
      .join(" ")

  return (
    <div
      data-testid={TESTID.calendarDay}
      data-date={props.date}
      data-dated={String(props.dated)}
      data-today={String(props.today)}
      data-open={String(props.open)}
    >
      <Show
        when={props.dated}
        fallback={<span class={look()}>{dayNumber(props.date)}</span>}
      >
        <Link
          route={{ kind: "day", date: props.date }}
          class={look()}
          title={props.date}
          label={props.date}
          current={props.open}
        >
          {dayNumber(props.date)}
        </Link>
      </Show>
    </div>
  )
}

import { Link } from "olai-plugin-navigation/routing"
import { TESTID } from "../../testids.ts"
import { TARGET } from "@olai/ui-primitives/touch.ts"
import { dayNumber } from "./month.ts"
import { dayRoute } from "../routes.ts"

/** It carries no colour of its own — every property the marks below touch is
 *  decided in exactly one of them, because two utilities setting the same
 *  property are settled by the order Tailwind emitted its rules in and not by
 *  the order they were written here. */
const BOX = `flex ${TARGET} relative w-full items-center justify-center rounded-control border ` +
  "text-label tabular-nums no-underline md:min-h-6"

/** What it does NOT set is `position` on the cell: this mark and the fold below
 *  are both absolute, so the containing block is the BOX's to declare — two of
 *  them setting one property is the thing the note above forbids. */
const DOT =
  "after:absolute after:bottom-0.5 after:h-1 after:w-1 " +
  "after:rounded-full after:bg-current after:opacity-70 after:content-['']"

const FOLD =
  "before:absolute before:right-px before:top-px before:border-[0.22rem] " +
  "before:border-b-transparent before:border-l-transparent before:border-current " +
  "before:opacity-60 before:content-['']"

export function Day(props: {
  readonly date: string
  readonly dated: boolean
  readonly noted: boolean
  readonly today: boolean
  readonly open: boolean
}) {
  const live = (): boolean => props.dated || props.noted

  const said = (): string =>
    live()
      ? `${props.date}, ${
        props.dated
          ? props.noted ? "has a note and dated items" : "has dated items"
          : "has a note"
      }`
      : props.date

  const ink = (): string =>
    props.open
      ? "text-ink"
      : props.today
      ? "text-accent"
      : live()
      ? "text-ink"
      : "text-muted/70"
  const ground = (): string => props.open ? "bg-ink/8" : "hover:bg-ink/5"
  const ring = (): string =>
    props.today ? "border-accent" : "border-transparent"

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
        tip={props.date}
        label={said()}
        current={props.open}
      >
        {dayNumber(props.date)}
      </Link>
    </div>
  )
}

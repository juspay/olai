import { Link } from "olai-plugin-navigation/routing"
import { TESTID } from "../../testids.ts"
import { TARGET } from "@olai/ui-primitives/touch.ts"
import { dayNumber } from "./month.ts"
import { dayRoute } from "../routes.ts"

const CELL = `flex ${TARGET} relative w-full items-center justify-center rounded-control border ` +
  "text-label tabular-nums no-underline md:min-h-6"

const DATED_DOT =
  "after:absolute after:bottom-0.5 after:h-1 after:w-1 " +
  "after:rounded-full after:bg-current after:opacity-70 after:content-['']"

const NOTED_FOLD =
  "before:absolute before:right-px before:top-px before:border-[0.22rem] " +
  "before:border-b-transparent before:border-l-transparent before:border-current " +
  "before:opacity-60 before:content-['']"

const cellClass = (cell: {
  readonly dated: boolean
  readonly noted: boolean
  readonly today: boolean
  readonly open: boolean
}): string => {
  const live = cell.dated || cell.noted
  return [
    CELL,
    cell.open ? "text-ink" : cell.today ? "text-accent" : live ? "text-ink" : "text-muted/70",
    cell.open ? "bg-ink/8" : "hover:bg-ink/5",
    cell.today ? "border-accent" : "border-transparent",
    cell.dated ? DATED_DOT : "",
    cell.noted ? NOTED_FOLD : "",
    live || cell.today || cell.open ? "font-semibold" : "",
  ]
    .filter((part) => part !== "")
    .join(" ")
}

export function Day(props: {
  readonly date: string
  readonly dated: boolean
  readonly noted: boolean
  readonly today: boolean
  readonly open: boolean
}) {
  const said = (): string =>
    props.dated || props.noted
      ? `${props.date}, ${
        props.dated
          ? props.noted ? "has a note and dated items" : "has dated items"
          : "has a note"
      }`
      : props.date

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
        class={cellClass(props)}
        tip={props.date}
        label={said()}
        current={props.open}
      >
        {dayNumber(props.date)}
      </Link>
    </div>
  )
}

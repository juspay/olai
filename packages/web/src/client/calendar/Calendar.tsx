/**
 * The month, in the sidebar — the way into the journal.
 *
 * There is no journal FILE. A day is a question asked of every dated node in
 * every outline (`@olai/format`'s date derivations), so this aggregates the
 * whole set and no filename is special about anything. It is pure view over
 * the snapshot: nothing is stored, nothing is written, and a directory whose
 * outlines carry no `date` sees a month of inert numbers.
 *
 * Which month is on screen is a reading, not an address — the same standing as
 * what is folded — so it is held by the same `createStamped` (../stamped.ts)
 * that view.ts uses, and starts over when the thing it belongs to moves rather
 * than when an effect gets round to noticing.
 *
 * What it belongs to is the ANCHOR, and that is the whole difference from a
 * reading of a page: a page's folds die with the page, while this is chrome,
 * and walking from one outline to another is no reason to snap the month back
 * to today. Paging therefore survives every navigation that does not change
 * which month the reader is looking at.
 *
 * The dots are asked for per month rather than handed over as a set, so the
 * question is only asked about the month being drawn — and asking it INSIDE a
 * memo is what makes a dated node saved on disk light its day without a
 * reload: the query reads the live derivation, so the frame that changes it
 * re-runs this.
 */

import { createMemo, For, Show } from "solid-js"

import { createStamped } from "../stamped.ts"
import { TESTID, type TestId } from "../testids.ts"
import { monthGrid, monthLabel, monthOfDay, shiftMonth, WEEKDAYS } from "./month.ts"
import { Day } from "./Day.tsx"

export function Calendar(props: {
  /** Today, in the reader's own time zone (../clock.ts). */
  readonly today: string
  /** The day the open page is of, if it is a day at all. */
  readonly open: string | undefined
  /** Which days of a month have at least one node dated them. */
  readonly days: (month: string) => ReadonlySet<string>
}) {
  /** The month the calendar belongs to when nobody has paged it: the day being
   *  read, or today. A `/d/<anything>` address is a day nothing can be dated
   *  and is not a month either — the day view says so, and the grid stays on
   *  the month a reader can still use. */
  const anchor = createMemo(
    // The last answer needs no guard of its own: text that names no month
    // draws no grid, which is month.ts's own contract.
    () => monthOfDay(props.open) ?? monthOfDay(props.today) ?? "",
  )

  const shown = createStamped(anchor, (month) => month)
  const month = shown.value
  const page = (delta: number): void => {
    shown.edit((current) => shiftMonth(current, delta))
  }

  const dated = createMemo(() => props.days(month()))

  return (
    <section class="mb-5" data-testid={TESTID.calendar} data-month={month()}>
      <header class="mb-1 flex items-center justify-between gap-1">
        <Step label="the month before" testid={TESTID.calendarPrev} onStep={() => page(-1)}>
          ‹
        </Step>
        <h2 class="m-0 text-xs font-normal tracking-wide text-muted">
          {monthLabel(month())}
        </h2>
        <Step label="the month after" testid={TESTID.calendarNext} onStep={() => page(1)}>
          ›
        </Step>
      </header>

      <div class="grid grid-cols-7 gap-px">
        <For each={WEEKDAYS}>
          {(weekday) => (
            <div class="text-center text-[0.625rem] text-muted" aria-hidden="true">
              {weekday}
            </div>
          )}
        </For>
        <For each={monthGrid(month())}>
          {(date) => (
            <Show when={date} fallback={<span aria-hidden="true" />}>
              {(day) => (
                <Day
                  date={day()}
                  dated={dated().has(day())}
                  today={day() === props.today}
                  open={day() === props.open}
                />
              )}
            </Show>
          )}
        </For>
      </div>
    </section>
  )
}

/** One step through the months. A button and not a link: paging is a way of
 *  looking, and it has nowhere to go — the address bar still names the page
 *  being read. */
function Step(props: {
  readonly label: string
  readonly testid: TestId
  readonly onStep: () => void
  readonly children: string
}) {
  return (
    <button
      type="button"
      // A chevron is a small thing to hit. Below 48rem it gets the same 44px
      // box every other target on a phone gets — both ways, because unlike a
      // day of the month it has no grid column to fill it out.
      class="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded border-0 bg-transparent px-1 text-xs text-muted hover:bg-rule hover:text-ink md:min-h-0 md:min-w-0"
      data-testid={props.testid}
      aria-label={props.label}
      onClick={props.onStep}
    >
      {props.children}
    </button>
  )
}

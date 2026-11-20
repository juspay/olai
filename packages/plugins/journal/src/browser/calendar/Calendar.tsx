import { Index } from "solid-js"

import { monthOfDay, shiftMonth } from "@olai/format"
import { createMemo, createSelector, For, Show } from "solid-js"

import { createDated, createNoted } from "../dates.ts"
import { createStamped } from "@olai/web/client/stamped.ts"
import { TESTID, type TestId } from "../../testids.ts"
import { TARGET_BOX } from "@olai/ui-primitives/touch.ts"
import { monthGrid, monthLabel, WEEKDAY_HEADINGS } from "./month.ts"
import { Day } from "./Day.tsx"

export function Calendar(props: {
  readonly today: string
  readonly open: string | undefined
}) {
  const anchor = createMemo(
    () => monthOfDay(props.open) ?? monthOfDay(props.today) ?? "",
  )

  const shown = createStamped(anchor, (month) => month)
  const month = shown.value
  const page = (delta: number): void => {
    shown.edit((current) => shiftMonth(current, delta))
  }

  const dated = createDated(month)
  const noted = createNoted(month)

  const isOpen = createSelector(() => props.open)

  return (
    <section
      // A reader who keeps it open spends ~220px of a short window on it, and
      // the file tree has to clear the fold below (`olai-plugin-layout/entry`,
      // and the scenario it names) — so the heading's size and the day cell's
      // `md:min-h` are a budget: grow either and re-read that note first.
      class="mb-2 mt-1 md:px-1"
      data-testid={TESTID.calendar}
      data-month={month()}
    >
      <header class="mb-1 flex items-center justify-between gap-1">
        <Step label="Previous month" testid={TESTID.calendarPrev} onStep={() => page(-1)}>
          ‹
        </Step>
        <h2 class="m-0 text-label font-medium text-ink">
          {monthLabel(month())}
        </h2>
        <Step label="Next month" testid={TESTID.calendarNext} onStep={() => page(1)}>
          ›
        </Step>
      </header>

      <div class="grid grid-cols-7 gap-px">
        <For each={WEEKDAY_HEADINGS}>
          {(weekday) => (
            <div class="text-center text-caption text-muted/70" aria-hidden="true">
              {weekday}
            </div>
          )}
        </For>
        <Index each={monthGrid(month())}>
          {(date) => (
            <Show when={date()} fallback={<span aria-hidden="true" />}>
              {(day) => (
                <Day
                  date={day()}
                  dated={dated().has(day())}
                  noted={noted().has(day())}
                  today={day() === props.today}
                  open={isOpen(day())}
                />
              )}
            </Show>
          )}
        </Index>
      </div>
    </section>
  )
}

function Step(props: {
  readonly label: string
  readonly testid: TestId
  readonly onStep: () => void
  readonly children: string
}) {
  return (
    <button
      type="button"
      class={`inline-flex ${TARGET_BOX} cursor-pointer items-center justify-center rounded-control border-0 bg-transparent px-1 text-label text-muted hover:bg-ink/5 hover:text-ink md:min-h-0 md:min-w-6`}
      data-testid={props.testid}
      aria-label={props.label}
      onClick={props.onStep}
    >
      {props.children}
    </button>
  )
}

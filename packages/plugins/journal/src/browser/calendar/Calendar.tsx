/**
 * The month, in the sidebar — the way into the journal, folded under the
 * `Today` row until a reader opens it (`../sidebar.tsx`, `./fold.ts`).
 *
 * There is no journal FILE. A day is a question asked of every dated node in
 * every outline (`@olai/format`'s date derivations), so this aggregates the
 * whole set and no OUTLINE's name is special about anything. The one filename
 * that is special is a document's: a `.md` named for the date is that day's
 * note, and this is the other reader of that fact — which is why the grid asks
 * two questions per month and draws two marks (./Day.tsx). Both are pure
 * READINGS either way: nothing is stored, nothing is written. Every cell is a
 * link to that day's page, empty or not — a click here never mints.
 *
 * Which month is on screen is a reading, not an address, so it is held by
 * `createStamped` (../stamped.ts) and starts over when the thing it belongs to
 * moves rather than when an effect gets round to noticing.
 *
 * What it belongs to is the ANCHOR, and that is the whole difference from a
 * fold or a done-visibility pick: those are this browser's and outlive every
 * page, while this is chrome whose stamp is the month it is looking at, and
 * walking from one outline to another is no reason to snap the month back to
 * today. Paging therefore survives every navigation that does not change which
 * month the reader is looking at.
 *
 * The dots are asked of the SERVER, per month, and the question is the shown
 * month — so the vault is walked for the month somebody is looking at and for
 * no other. That is `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`'s PR 4: the walk
 * is `@olai/format`'s `datedDays` still, called where the set is. What makes a
 * dated node saved on disk light its day WITHOUT A RELOAD is no longer a memo
 * over a local derivation but the subscription itself — the server re-reads the
 * month on every published revision and sends a frame when the dots moved
 * (../dates.ts).
 *
 * WHICH MONTH IS THE SUBSCRIPTION'S INPUT, so paging closes one and opens the
 * next. That is why the month stays in this component rather than being lifted:
 * the question and the chrome state it is asked about are one thing, and a
 * month held above would be a second place that decides what is being watched.
 *
 * TWO of those questions still, and they stay two: a day may carry a node of
 * the set, a note somebody wrote for it, or both, and the cell draws a
 * different mark for each (./Day.tsx) — so a union computed here would be a
 * fact the cell could not take apart again. They are ASKED THE SAME WAY, both
 * of the month this component owns, and where each is ANSWERED is ../dates.ts's
 * to know and to argue: the dots cross the wire, the notes are a question about
 * a FILENAME asked of the key set this tab already holds. So a `.md` dropped
 * into the directory still lights its day on the frame it arrives, off a member
 * this tab was already subscribed to.
 */

import { monthOfDay, shiftMonth } from "@olai/format"
import { createMemo, createSelector, For, Show } from "solid-js"

import { createDated, createNoted } from "../dates.ts"
import { createStamped } from "@olai/web/client/stamped.ts"
import { TESTID, type TestId } from "../../testids.ts"
import { TARGET_BOX } from "@olai/ui-primitives/touch.ts"
import { monthGrid, monthLabel, WEEKDAY_HEADINGS } from "./month.ts"
import { Day } from "./Day.tsx"

export function Calendar(props: {
  /** Today, in the reader's own time zone (../clock.ts). */
  readonly today: string
  /** The day the open page is of, if it is a day at all. */
  readonly open: string | undefined
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

  const dated = createDated(month)
  const noted = createNoted(month)

  // Which cell is FILLED, as a selector rather than `day() === props.open` in
  // each of them: that form subscribes all thirty-odd days to the open one, so
  // clicking through a week re-runs the whole grid's effects to move one fill.
  // theme/Chips.tsx is the house precedent and the reasoning is the same one;
  // the difference here is that a day is also the cheapest thing on the page to
  // click repeatedly, which is exactly when a grid-wide re-diff is felt.
  //
  // TODAY is deliberately not one. A selector earns its keep by making a
  // comparison cheap to CHANGE, and today changes once a day (../clock.ts) —
  // where the grid it redraws is the whole point.
  const isOpen = createSelector(() => props.open)

  return (
    <section
      // ON THE COLUMN'S OWN GROUND, not a card: the month used to be a bright
      // paper card on the dark spine, the loudest thing on screen. Unfolded
      // under the `Today` row (`../sidebar.tsx`) it reads as part of the list.
      // No horizontal pad below md, so seven cells in the phone drawer still
      // clear the 44px finger rule.
      //
      // A reader who keeps it open spends ~220px of a short window on it, and
      // the file tree has to clear the fold below (`olai-plugin-layout/entry`,
      // and the scenario it names) — so the heading's size and the day cell's
      // `md:min-h` are a budget: grow either and re-read that note first.
      class="mb-2 mt-1 md:px-1"
      data-testid={TESTID.calendar}
      data-month={month()}
    >
      <header class="mb-1 flex items-center justify-between gap-1">
        <Step label="the month before" testid={TESTID.calendarPrev} onStep={() => page(-1)}>
          ‹
        </Step>
        <h2 class="m-0 text-[0.8125rem] font-medium text-paper/80">
          {monthLabel(month())}
        </h2>
        <Step label="the month after" testid={TESTID.calendarNext} onStep={() => page(1)}>
          ›
        </Step>
      </header>

      <div class="grid grid-cols-7 gap-px">
        <For each={WEEKDAY_HEADINGS}>
          {(weekday) => (
            <div class="text-center text-[0.625rem] text-paper/45" aria-hidden="true">
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
                  noted={noted().has(day())}
                  today={day() === props.today}
                  open={isOpen(day())}
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
      // A chevron is a small thing to hit, and unlike a day of the month it
      // has no grid column to fill it out — so it takes the box both ways
      // (../touch.ts).
      class={`inline-flex ${TARGET_BOX} cursor-pointer items-center justify-center rounded border-0 bg-transparent px-1 text-xs text-paper/55 hover:bg-paper/10 hover:text-paper md:min-h-0 md:min-w-6`}
      data-testid={props.testid}
      aria-label={props.label}
      onClick={props.onStep}
    >
      {props.children}
    </button>
  )
}

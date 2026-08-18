/**
 * One day, on the line.
 *
 * Three things stacked in the gutter's own column: the SILENCE since the day
 * above it, the DOT that marks it, and the rows owed on it. What the day says
 * about itself is felt distance rather than an ISO date — "Mon, Aug 24" and
 * "in 6 days" — because a page that made a reader subtract dates to work out
 * whether something was urgent was making them do the one job it exists for
 * (`agenda-spine`, ruled 2026-08-18).
 *
 * ## What each of the three standings looks like, and why
 *
 *   - LATE — "Yesterday · Mon, Aug 17", alarm ink. The felt word comes FIRST
 *     because it is the news; the calendar day behind it is the detail.
 *   - TODAY — "TODAY · Tue, Aug 18", small caps, accent, and drawn even with
 *     nothing under it (then one muted italic line saying so). Now is a place
 *     on the line, not a section that disappears when the day is clear.
 *   - AHEAD — "Mon, Aug 24" first and a muted "in 6 days" beside it: the day is
 *     what a reader is looking for out here, and the distance is the gloss.
 *
 * The whole entry FADES with distance (`Felt.fade`), dot included, so the far
 * future recedes instead of shouting. The heading is still the way THROUGH to
 * that day's own page, where the note somebody wrote on it and the work already
 * finished are read — both of which this page deliberately leaves out.
 *
 * ## No file heading over the rows
 *
 * The day pages still group by outline (../day/DayGroups.tsx); this does not.
 * A heading per file over every day was the chrome that outweighed the content
 * four to one — so the groups are read end to end in the order the format put
 * them (path order, then time), and which outline a row lives in is the muted
 * ancestry line under it and the `data-file` on the row.
 */

import { type DayEntry, isOverdue, owedFact } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { Show } from "solid-js"

import { CRUMB } from "../Breadcrumbs.tsx"
import { DayNode } from "../day/DayNode.tsx"
import { placeOf } from "../day/place.ts"
import { unfiltered, useNarrowed } from "../filter/narrowed.tsx"
import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { useToday } from "../today.tsx"
import {
  inkOf,
  lineOf,
  NOW_RING,
  type Rung,
  SPINE_CELL,
  SPINE_DOT,
  SPINE_INDENT,
  SPINE_LINE,
  SPINE_NOW,
} from "./spine.ts"

/** How a day's own name is set, per standing. Small caps and the accent for
 *  now; the alarm for what has gone; the plain heading weight for what is
 *  coming, whose distance rides beside it in the muted voice. */
const HEADING = {
  late: "text-xs font-semibold text-alarm",
  today: "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-accent",
  ahead: "text-xs font-semibold text-ink",
} as const

export function Day(props: {
  readonly rung: Rung
}) {
  const felt = () => props.rung.felt
  const today = useToday()
  const narrowed = useNarrowed()
  /** The day's rows, read end to end across its outlines — the order the
   *  format grouped them in, with the grouping itself left undrawn. */
  const rows = (): ReadonlyArray<DayEntry> =>
    props.rung.day.groups.flatMap((group) => group.nodes)
  /** What a day CALLS itself: the felt word in front for the two standings
   *  where it is the news, and the calendar day alone for the rest. */
  const named = (): string =>
    felt().standing === "ahead"
      ? felt().calendar
      : `${felt().distance} · ${felt().calendar}`

  return (
    // `flow-root` is load-bearing and not a tidy-up: a row carries its own
    // bottom margin, and the last one in a day would otherwise collapse THROUGH
    // this box and out of it — leaving the section shorter than its content and
    // the line broken between every pair of days. Establishing a formatting
    // context here contains the margin, which is what makes the stretches abut.
    <section
      class="relative flow-root"
      data-testid={TESTID.agendaDay}
      data-date={props.rung.day.date}
      // WHICH SIDE OF NOW, as the fact it is. It replaced `data-section` when
      // the boxes went: a scenario asks what a day IS rather than which heading
      // it was filed under, and the answer is now true of the day itself.
      data-when={felt().standing}
    >
      {/* This rung's stretch of the line. `aria-hidden`: it is the shape of the
          page, and every word it says in colour is said in text beside it. */}
      <span aria-hidden="true" class={SPINE_LINE} style={{ background: lineOf(props.rung) }} />

      {/* THE SILENCE, which is content: a wait long enough to notice says how
          long it was, and every wait takes room that grows with it. */}
      <div class="relative" style={{ height: `${props.rung.quiet.space}rem` }}>
        <Show when={props.rung.quiet.label}>
          {(label) => (
            <span
              class="pl-9 text-[0.6875rem] italic text-muted opacity-60"
              data-testid={TESTID.agendaQuiet}
              data-days={String(props.rung.quiet.days)}
            >
              {label()}
            </span>
          )}
        </Show>
      </div>

      {/* The day itself, receding with distance — the dot with it, because a
          faint row under a full-strength dot would be two different claims
          about how far away the same day is. */}
      <div style={{ opacity: String(felt().fade) }}>
        <h2 class="m-0 mb-1.5 flex items-center">
          <span class={SPINE_CELL} aria-hidden="true">
            <span
              class={felt().standing === "today" ? SPINE_NOW : SPINE_DOT}
              style={{
                background: inkOf(felt().tone),
                ...(felt().standing === "today" ? { "box-shadow": NOW_RING } : {}),
              }}
            />
          </span>
          <span class="flex min-w-0 items-baseline gap-2">
            {/* The way THROUGH: the day's own page is the fuller answer. */}
            <Link
              route={{ kind: "day", date: props.rung.day.date }}
              class={`${CRUMB} ${HEADING[felt().standing]}`}
            >
              {named()}
            </Link>
            <Show when={felt().standing === "ahead"}>
              <span class="shrink-0 text-[0.6875rem] text-muted">
                {felt().distance}
              </span>
            </Show>
          </span>
        </h2>

        {/* "nothing due today" is a claim about the DAY, and a query that
            selected none of it is a claim about the query — which the filter
            bar makes in its own words. So the dot stays and the sentence goes,
            the one reading every page with a sentence like this is drawn on
            (`../filter/narrowed.tsx`). */}
        <Show
          when={rows().length > 0}
          fallback={
            <Show when={unfiltered(narrowed)}>
              <p class={`m-0 ${SPINE_INDENT} text-xs italic text-muted opacity-80`}>
                nothing due today
              </p>
            </Show>
          }
        >
          <ul class={`m-0 list-none p-0 ${SPINE_INDENT}`}>
            {/* An entry is one record of the set, which `file/id` names the
                same way `Row.key` names a place in a tree. */}
            <Key each={rows()} by={placeOf}>
              {(dated) => (
                <DayNode
                  dated={dated()}
                  trail="under"
                  pill={owedFact(
                    dated().date,
                    isOverdue(dated().shows.node, today()),
                    today(),
                  )}
                />
              )}
            </Key>
          </ul>
        </Show>
      </div>
    </section>
  )
}

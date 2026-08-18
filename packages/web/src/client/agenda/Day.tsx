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
 * ## One decision, one table
 *
 * WHICH SIDE OF NOW a day is on decides four things about how it is drawn: how
 * its name is set, whether the felt word leads that name or trails it as a
 * gloss, which dot marks it, and whether that dot is ringed. Those are four
 * readings of ONE fact, so they are one row of {@link FACE} rather than four
 * conditionals down this component — which is what they were, and what a
 * fourth side of now would have had to find all of.
 *
 *   - LATE — "Yesterday · Mon, Aug 17", alarm ink. The felt word LEADS because
 *     it is the news; the calendar day behind it is the detail.
 *   - TODAY — "TODAY · Tue, Aug 18", accent, on a bigger dot with a paper ring
 *     — and drawn even with nothing under it (then one muted italic line saying
 *     so). Now is a place on the line, not a section that disappears when the
 *     day is clear. THE SMALL CAPS ARE THE WORD'S and not the heading's: the
 *     ruled example sets TODAY in caps and leaves the date in title case, so
 *     today's date reads like every other date on the line rather than being
 *     the one day that shouts its own.
 *   - AHEAD — "Mon, Aug 24" first and a muted "in 6 days" BESIDE it: the day is
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
 * four to one — so the groups are read end to end (`rowsOn`, where that
 * decision is written down), and which outline a row lives in is the muted
 * ancestry line under it and the `data-file` on the row.
 */

import { isOverdue, owedFact, type Standing } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createMemo, Show } from "solid-js"

import { CRUMB } from "../Breadcrumbs.tsx"
import { DayNode } from "../day/DayNode.tsx"
import { placeOf } from "../day/place.ts"
import { unfiltered, useNarrowed } from "../filter/narrowed.tsx"
import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { useToday } from "../today.tsx"
import {
  QUIET_INDENT,
  SPINE_CELL,
  SPINE_DOT,
  SPINE_INDENT,
  SPINE_LINE,
  SPINE_NOW,
} from "./gutter.ts"
import { inkOf, lineOf, NOW_RING, type Rung, rowsOn } from "./spine.ts"

/** How one side of now is drawn — see the header. Each field is a VALUE the
 *  markup uses rather than a flag it branches on again, which is what keeps
 *  this a table instead of a state machine spelled in booleans. */
interface Face {
  /** How the day's own name is set — size, weight and ink, for the whole of
   *  it. */
  readonly heading: string
  /** What the felt word takes ON TOP of that, where it leads: today's small
   *  caps, which belong to the word and not to the date after it. */
  readonly lead: string
  /** Which dot marks it (../agenda/gutter.ts). */
  readonly dot: string
  /** The ring around it, where it has one. */
  readonly ring: string | undefined
  /** Where the felt distance goes: in front of the name, or beside it in the
   *  muted voice. */
  readonly distance: "leads" | "beside"
}

/** Typed by the format's own vocabulary, so a fourth side of now is a type
 *  error at this table rather than a heading drawn with no class on it. */
const FACE: Record<Standing, Face> = {
  late: {
    heading: "text-xs font-semibold text-alarm",
    lead: "",
    dot: SPINE_DOT,
    ring: undefined,
    distance: "leads",
  },
  today: {
    heading: "text-[0.6875rem] font-semibold text-accent",
    lead: "uppercase tracking-[0.08em]",
    dot: SPINE_NOW,
    ring: NOW_RING,
    distance: "leads",
  },
  ahead: {
    heading: "text-xs font-semibold text-ink",
    lead: "",
    dot: SPINE_DOT,
    ring: undefined,
    distance: "beside",
  },
}

export function Day(props: {
  readonly rung: Rung
}) {
  const felt = () => props.rung.felt
  const face = (): Face => FACE[felt().standing]
  const today = useToday()
  const narrowed = useNarrowed()
  // MEMOISED: the list is read twice on the way to the screen — once to ask
  // whether the day has anything, once to draw it — and a plain accessor would
  // flatten the day's groups for each of them, every frame.
  const rows = createMemo(() => rowsOn(props.rung.day))
  /** The felt word in FRONT of the day's name, where it is the news — absent
   *  for a day whose distance goes beside the name instead, and for one nothing
   *  could count the distance to, where there is no word to put in front of it
   *  (`@olai/format`'s `Felt`). Its own element rather than a string joined to
   *  the date, because the treatment it takes is the WORD's. */
  const leads = (): string | undefined =>
    face().distance === "leads" ? felt().distance : undefined
  /** The distance drawn BESIDE the name, where that is where it goes. */
  const gloss = (): string | undefined =>
    face().distance === "beside" ? felt().distance : undefined

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
              class={`${QUIET_INDENT} text-[0.6875rem] italic text-muted opacity-60`}
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
              class={face().dot}
              // An absent ring is an absent declaration: Solid drops a style
              // whose value is `undefined`, so the two faces need no branch.
              style={{ background: inkOf(felt().tone), "box-shadow": face().ring }}
            />
          </span>
          <span class="flex min-w-0 items-baseline gap-2">
            {/* The way THROUGH: the day's own page is the fuller answer. */}
            <Link
              route={{ kind: "day", date: props.rung.day.date }}
              class={`${CRUMB} ${face().heading}`}
            >
              {/* ONE inline box inside the link, and it is load-bearing: the
                  crumb is an `inline-flex`, and a bare " · " beside the word
                  would become a flex item of its own with its spaces trimmed
                  off — which is what turned "Yesterday · Mon, Aug 17" into
                  "Yesterday· Mon, Aug 17". Inside a normal inline box the
                  separator keeps the spaces it was written with. */}
              <span>
                <Show when={leads()}>
                  {(word) => (
                    <>
                      <span class={face().lead}>{word()}</span>
                      {" · "}
                    </>
                  )}
                </Show>
                {felt().calendar}
              </span>
            </Link>
            <Show when={gloss()}>
              {(distance) => (
                <span class="shrink-0 text-[0.6875rem] text-muted">
                  {distance()}
                </span>
              )}
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
                    felt(),
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

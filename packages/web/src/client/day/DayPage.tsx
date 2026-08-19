/**
 * One day, as a page.
 *
 * The journal is a QUERY, not a place: nothing on disk says "this is the 10th
 * of August", and no outline is the diary. A day is every node in the served
 * set carrying that date, wherever it was written — which is what makes
 * `/d/<date>` a page over the whole directory rather than a view of one file.
 *
 * Grouped by outline, because that is the only heading that is true. A
 * `parent` never crosses a file, so two nodes in two outlines have no shared
 * ancestry to draw them under; within a group each node brings its own.
 *
 * ## The one filename that is special, and what it does not change
 *
 * A document named for the date is that day's NOTE (`@olai/format`'s
 * `noteDateOf`), and it is drawn first, above the groups (./DayNote.tsx). That
 * is a knowing amendment to the doctrine above rather than a hole in it: the
 * note JOINS the query's answer and never replaces it, so a day still collects
 * every dated node in the directory, still groups them by file, and still says
 * so when there are none. What changed is that the page has two halves — what
 * somebody WROTE about the day, and what the set says was ON it — and a reader
 * who keeps a daily file was previously shown only the second.
 *
 * A day with neither says so and offers nothing to press. Creating one is a
 * WRITE, and this pane writes nothing — that arrives with the editing ops; an
 * empty day promising a thing it cannot do would be worse than an empty day.
 * A day that has a note and no dated nodes is NOT that day: it says nothing
 * about being empty, because it is not — the reader is looking at what they
 * wrote on it.
 *
 * ## What a FILTER does to both halves
 *
 * The groups are narrowed the way an outline's rows are, and by the same
 * matcher (`../filter/narrowing.ts`): the entries that matched stay, an outline
 * with none left goes, and the bar above says how many of how many. Ancestors
 * cost nothing to keep here — every row on this page already arrives carrying
 * its own trail, which is what a day page is for.
 *
 * THE NOTE GOES while a filter is on, and it has gone before it reaches here:
 * a note is a DOCUMENT — prose this grammar has nothing to say about, which is
 * why a document is the one page whose address takes no `?q=` (`../routes.ts`) — so it
 * can never be a match, and what a narrowed page draws is one switch's answer
 * (`../filter/narrowing.ts`) rather than a rule each page keeps for itself.
 * What is left is the answer and only the answer; clearing the box brings the
 * day back whole.
 *
 * What this page does still decide is its own SENTENCE. "Nothing is on this
 * day" is a claim about the DAY, where "the query found none of it" is a claim
 * about the query and the bar's to make ("no matches") — so it is drawn on
 * `unfiltered`, the one reading the four pages with a sentence like that share.
 */

import type { DayGroup } from "@olai/format"
import { For, Show } from "solid-js"

import { useNarrowed } from "../filter/narrowed.tsx"
import { unfiltered } from "../filter/why.ts"
import { PAGE_TITLE } from "../look.ts"
import { TESTID } from "../testids.ts"
import { DayGroups } from "./DayGroups.tsx"
import { DayNote } from "./DayNote.tsx"

export function DayPage(props: {
  readonly date: string
  readonly groups: ReadonlyArray<DayGroup>
  /** The documents named for this date, in path order — none, one, or the two
   *  a vault mid-migration has. */
  readonly notes: ReadonlyArray<string>
  /** Today, so a page can say which day it is rather than only which date. */
  readonly today: string
}) {
  const narrowed = useNarrowed()
  return (
    <section data-testid={TESTID.dayPage} data-date={props.date}>
      <header class="mb-8 flex items-baseline justify-between gap-4">
        <div class="flex items-baseline gap-2">
          {/* Printed verbatim, like every other date in this app: the format
              stores what was written and a heading is no reason to be the first
              place that parses one. */}
          <h1 class={`${PAGE_TITLE} tabular-nums not-italic`}>{props.date}</h1>
          <Show when={props.date === props.today}>
            <span class="text-sm text-accent">today</span>
          </Show>
        </div>
      </header>

      {/* The written half, first — and a filtered day arrives with none, for
          the reason the header gives. `For` rather than `<Key>`: these are
          PATHS, and a string is its own key — two frames naming the same file
          are the same file, so the note keeps its DOM and its rendering across
          every frame the live store publishes. */}
      <For each={props.notes}>{(file) => <DayNote file={file} />}</For>

      {/* NOTHING here at all — said once, as the one condition it is. A day
          whose note is on screen is not a day with nothing on it, and saying so
          under the words somebody wrote would be the page arguing with
          itself. A filtered day says nothing either: what is empty then is the
          ANSWER, and the bar above is where that is said. */}
      <Show
        when={unfiltered(narrowed) && props.groups.length === 0 &&
          props.notes.length === 0}
      >
        <p class="text-muted" data-testid={TESTID.dayEmpty}>
          {/* "On", not "dated": a day holds what was scheduled for it and what
              was marked on it, and only one of those is a `date`. */}
          {props.date === props.today
            ? "Nothing is on today."
            : `Nothing is on ${props.date}.`}
        </p>
      </Show>

      {/* The day's own answer: every node the set has on it, under the outline
          each lives in — the same list the agenda draws (./DayGroups.tsx). */}
      <DayGroups groups={props.groups} heading="h2" />
    </section>
  )
}

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
 * A day with nothing on it says so and offers nothing to press. Creating one
 * is a WRITE, and this pane writes nothing — that arrives with the editing
 * ops; an empty day promising a thing it cannot do would be worse than an
 * empty day.
 */

import type { DayGroup } from "@olai/format"
import { For, Show } from "solid-js"

import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { DayNode } from "./DayNode.tsx"

export function DayPage(props: {
  readonly date: string
  readonly groups: ReadonlyArray<DayGroup>
  /** Today, so a page can say which day it is rather than only which date. */
  readonly today: string
}) {
  return (
    <section data-testid={TESTID.dayPage} data-date={props.date}>
      <header class="mb-4 flex items-baseline gap-2">
        {/* Printed verbatim, like every other date in this app: the format
            stores what was written and a heading is no reason to be the first
            place that parses one. */}
        <h1 class="m-0 text-2xl font-bold tabular-nums">{props.date}</h1>
        <Show when={props.date === props.today}>
          <span class="text-sm text-accent">today</span>
        </Show>
      </header>

      <Show
        when={props.groups.length > 0}
        fallback={
          <p class="text-muted" data-testid={TESTID.dayEmpty}>
            {props.date === props.today
              ? "Nothing is dated today."
              : `Nothing is dated ${props.date}.`}
          </p>
        }
      >
        <For each={props.groups}>
          {(group) => (
            <section class="mb-6" data-testid={TESTID.dayGroup} data-file={group.file}>
              <h2 class="m-0 mb-2 font-mono text-xs text-muted">
                <Link
                  route={{ kind: "outline", file: group.file }}
                  class="inline-flex min-h-11 items-center rounded px-1 text-inherit no-underline hover:bg-rule hover:text-ink md:min-h-0"
                >
                  {group.file}
                </Link>
              </h2>
              <ul class="m-0 list-none p-0">
                <For each={group.nodes}>{(dated) => <DayNode dated={dated} />}</For>
              </ul>
            </section>
          )}
        </For>
      </Show>
    </section>
  )
}

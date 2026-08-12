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
 */

import type { DayGroup } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { For, Show } from "solid-js"

import { CRUMB } from "../Breadcrumbs.tsx"
import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { DayNode } from "./DayNode.tsx"
import { DayNote } from "./DayNote.tsx"
import { placeOf } from "./place.ts"

export function DayPage(props: {
  readonly date: string
  readonly groups: ReadonlyArray<DayGroup>
  /** The documents named for this date, in path order — none, one, or the two
   *  a vault mid-migration has. */
  readonly notes: ReadonlyArray<string>
  /** Today, so a page can say which day it is rather than only which date. */
  readonly today: string
}) {
  return (
    <section data-testid={TESTID.dayPage} data-date={props.date}>
      <header class="mb-4 flex items-baseline justify-between gap-4">
        <div class="flex items-baseline gap-2">
          {/* Printed verbatim, like every other date in this app: the format
              stores what was written and a heading is no reason to be the first
              place that parses one. */}
          <h1 class="m-0 text-2xl font-bold tabular-nums">{props.date}</h1>
          <Show when={props.date === props.today}>
            <span class="text-sm text-accent">today</span>
          </Show>
        </div>
      </header>

      {/* The written half, first. `For` rather than `<Key>`: these are PATHS,
          and a string is its own key — two frames naming the same file are the
          same file, so the note keeps its DOM and its rendering across every
          frame the live store publishes. */}
      <For each={props.notes}>{(file) => <DayNote file={file} />}</For>

      {/* NOTHING here at all — said once, as the one condition it is. A day
          whose note is on screen is not a day with nothing on it, and saying so
          under the words somebody wrote would be the page arguing with
          itself. */}
      <Show when={props.groups.length === 0 && props.notes.length === 0}>
        <p class="text-muted" data-testid={TESTID.dayEmpty}>
          {/* "On", not "dated": a day holds what was scheduled for it and what
              was marked on it, and only one of those is a `date`. */}
          {props.date === props.today
            ? "Nothing is on today."
            : `Nothing is on ${props.date}.`}
        </p>
      </Show>

      <Show when={props.groups.length > 0}>
        {/* Keyed, like the tree is (../Tree.tsx): every frame the live store
            publishes mints these afresh, and a group or an entry that is the
            same one as last frame keeps its DOM — and its rendered note —
            rather than being rebuilt. A group IS its outline, so that is its
            key; an entry is one record of the set, which `file/id` names the
            same way `Row.key` names a place. */}
        <Key each={props.groups} by="file">
          {(group) => (
            <section
              class="mb-6"
              data-testid={TESTID.dayGroup}
              data-file={group().file}
            >
              <h2 class="m-0 mb-2 font-mono text-xs text-muted">
                <Link
                  route={{ kind: "outline", file: group().file }}
                  class={CRUMB}
                >
                  {group().file}
                </Link>
              </h2>
              <ul class="m-0 list-none p-0">
                <Key each={group().nodes} by={placeOf}>
                  {(dated) => <DayNode dated={dated()} />}
                </Key>
              </ul>
            </section>
          )}
        </Key>
      </Show>
    </section>
  )
}

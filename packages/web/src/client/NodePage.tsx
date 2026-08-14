/**
 * One node, as a page — the zoom.
 *
 * The node's title becomes the heading, its note the body, the document it
 * attaches the rest of that body, and its children the familiar tree. Which node this is came from `@olai/format`'s `zoom`: a
 * mirror's id resolves through its chain, so there is exactly one page per
 * node however many placements it has, and the crumbs above it are the
 * canonical ancestry rather than the path that was clicked.
 *
 * The date beside the heading is the node's `date` — what it is SCHEDULED for
 * — and deliberately not the instant on its mark, which a `done` now carries.
 * That is a decision rather than an omission: this page answers "what is this
 * node", where the checkbox says the work is finished and when it happened is
 * a fact about a DAY. The day is where that is read — `/d/<date>` puts the
 * node under the day it was finished on, with the instant on its badge
 * (`day/DayNode.tsx`) — and repeating it here would put a second date beside a
 * heading that already has one, meaning something else.
 */

import { isOverdue, type Row, type Zoomed } from "@olai/format"
import { Show } from "solid-js"

import { blockedIds } from "./blocked.ts"
import { Blocked } from "./Blocked.tsx"
import { Breadcrumbs } from "./Breadcrumbs.tsx"
import { DateBadge } from "./DateBadge.tsx"
import { EdgeRefs } from "./edges/EdgeRefs.tsx"
import { createEdgeEditing } from "./edges/editing.tsx"
import { EdgeVerbs } from "./edges/EdgeVerbs.tsx"
import { Editable } from "./edit/Editable.tsx"
import { StartLine } from "./edit/StartLine.tsx"
import { useNarrowed } from "./filter/narrowed.tsx"
import { only } from "./narrow.ts"
import { NodeBody } from "./NodeBody.tsx"
import { NodeTitle } from "./NodeTitle.tsx"
import { NotFound } from "./NotFound.tsx"
import { ProgressBadge } from "./ProgressBadge.tsx"
import { doneHidden } from "./settings/done.ts"
import { TESTID } from "./testids.ts"
import { useToday } from "./today.tsx"
import { toneOf } from "./tone.ts"
import { Tree } from "./Tree.tsx"

export function NodePage(props: {
  readonly zoomed: Zoomed
  /** The children, off the app's one row derivation — the same rows an outline
   *  draws, so a zoomed page is as live as any other. */
  readonly rows: ReadonlyArray<Row>
}) {
  return (
    <Show
      when={only(props.zoomed, "node")}
      fallback={<NotFound zoomed={props.zoomed} />}
    >
      {(zoomed) => <Zoom zoomed={zoomed()} rows={props.rows} />}
    </Show>
  )
}

function Zoom(props: {
  readonly zoomed: Extract<Zoomed, { readonly kind: "node" }>
  readonly rows: ReadonlyArray<Row>
}) {
  const today = useToday()
  /** Whether this page is narrowed — the one thing the empty state below has
   *  to know, because "nothing under this node" and "nothing here matches" are
   *  two different pieces of news (./filter/narrowed.tsx). */
  const narrowed = useNarrowed()
  /** This page's edge editing — the panel, both doors' writes, and the line
   *  that says what came of them (./edges/editing.tsx). A zoom always lands on
   *  a regular node however it was addressed, so the node is never absent
   *  here. */
  const edges = createEdgeEditing(() => props.zoomed.shows.node)

  return (
    <Editable rows={() => props.rows}>
      <header class="mb-4">
        <Breadcrumbs file={props.zoomed.shows.file} trail={props.zoomed.trail} />

        {/* The subject is a node too — same testid a row uses — so "the
            description of X" and "the node X" mean the same record on a
            zoomed page as they do in a tree. The heading still carries
            zoom-title: that is what a scenario waits on for the route. */}
        <div
          class="mt-2"
          data-testid={TESTID.node}
          data-node-id={props.zoomed.shows.node.id}
          data-status={props.zoomed.status}
          data-blocked={blockedIds(props.zoomed.blocked)}
          data-kind="node"
        >
          <div class="flex items-baseline gap-3">
            <h1
              class={`m-0 flex-1 text-2xl font-bold ${toneOf(props.zoomed.status)}`}
              data-testid={TESTID.zoomTitle}
              data-node-id={props.zoomed.shows.node.id}
              data-status={props.zoomed.status}
            >
              <NodeTitle
                title={props.zoomed.shows.node.title}
                from={props.zoomed.shows.file}
              />
            </h1>
            <Show when={props.zoomed.progress}>
              {(progress) => <ProgressBadge progress={progress()} />}
            </Show>
            <Show when={props.zoomed.shows.node.date}>
              {(date) => (
                <DateBadge
                  date={date()}
                  overdue={isOverdue(props.zoomed.shows.node, today())}
                />
              )}
            </Show>
          </div>

          {/* What the node is waiting on, named in full and above its note:
              a page whose subject cannot start yet should say so before it
              says anything else about it. This is where a row's glyph was
              pointing. DERIVED, and read-only for that reason — half of it can
              be a `blocks` written on another record, and a finished blocker is
              not in it at all (./Blocked.tsx). */}
          <Blocked blocked={props.zoomed.blocked} />
          {/* …and the FIELD under it: what this node itself declares it comes
              after, whether or not the target is still in the way. That is what
              `set_after` writes, so that is what carries the `×`. */}
          <EdgeRefs
            node={props.zoomed.shows.node}
            relation="after"
            onRemove={(target) => edges.drop("after", target)}
          />

          {/* Zoomed, a node's note and document ARE the page under it: the node
              said the rest was here, and the subject is never densified. */}
          <NodeBody
            shows={props.zoomed.shows}
            zoomed
            onUnsee={(target) => edges.drop("see", target)}
          />

          {/* THE TWO EDGE VERBS, on the page rather than in a `•••` menu — the
              heading has none, which is the same gap the ⌘K palette's op rows
              closed for the verbs that need no second gesture (`palette/ops.ts`
              leaves these two out precisely because they open something, the way
              `Set date…` does). So the door is here, where the two rows above are
              read, and it opens the same panel a row's menu opens. */}
          <EdgeVerbs open={edges.open} openFor={edges.openFor()} />
          <edges.Panel />
        </div>
      </header>

      <Show
        when={props.rows.length > 0}
        fallback={
          <Show
            when={props.zoomed.children.length === 0 && !narrowed.active()}
            fallback={
              <p class="text-muted" data-testid={TESTID.emptyUnder}>
                {nothingUnder(props.zoomed, narrowed.active())}
              </p>
            }
          >
            {/* Nothing under it, and nothing hidden either — so the honest
                thing to offer is the first child, which a page with no rows
                has nowhere else to put. */}
            <StartLine
              at={{ kind: "under", id: props.zoomed.shows.node.id }}
              label="Nothing under this node — write the first line under it."
            />
          </Show>
        }
      >
        <Tree rows={props.rows} />
      </Show>
    </Editable>
  )
}

/** An empty page has three causes and they are not the same news: a leaf has
 *  nothing under it; a subtree that is entirely done has been hidden by this
 *  reading and is one pick in Prefs from coming back; and a filter can have
 *  matched nothing, which the bar above already counts — so this says which
 *  reading emptied the page rather than repeating the number. */
const nothingUnder = (
  zoomed: Extract<Zoomed, { readonly kind: "node" }>,
  filtered: boolean,
): string =>
  filtered
    ? "Nothing under this node matches the filter."
    : zoomed.children.length > 0 && doneHidden()
    ? "Everything under this node is done, and Prefs is hiding finished work."
    : "Nothing under this node."

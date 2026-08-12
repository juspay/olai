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

import type { Row, Zoomed } from "@olai/format"
import { Show } from "solid-js"

import { blockedIds } from "./blocked.ts"
import { Blocked } from "./Blocked.tsx"
import { Breadcrumbs } from "./Breadcrumbs.tsx"
import { DateBadge } from "./DateBadge.tsx"
import { DoneToggle } from "./DoneToggle.tsx"
import { only } from "./narrow.ts"
import { NodeBody } from "./NodeBody.tsx"
import { NodeTitle } from "./NodeTitle.tsx"
import { NotFound } from "./NotFound.tsx"
import { ProgressBadge } from "./ProgressBadge.tsx"
import { TESTID } from "./testids.ts"
import { toneOf } from "./tone.ts"
import { Tree } from "./Tree.tsx"
import type { View } from "./view.ts"

export function NodePage(props: {
  readonly zoomed: Zoomed
  /** The children, off the app's one row derivation — the same rows an outline
   *  draws, so a zoomed page is as live as any other. */
  readonly rows: ReadonlyArray<Row>
  readonly view: View
}) {
  return (
    <Show
      when={only(props.zoomed, "node")}
      fallback={<NotFound zoomed={props.zoomed} />}
    >
      {(zoomed) => <Zoom zoomed={zoomed()} rows={props.rows} view={props.view} />}
    </Show>
  )
}

function Zoom(props: {
  readonly zoomed: Extract<Zoomed, { readonly kind: "node" }>
  readonly rows: ReadonlyArray<Row>
  readonly view: View
}) {
  return (
    <>
      <header class="mb-4">
        <div class="flex items-baseline justify-between gap-4">
          <Breadcrumbs file={props.zoomed.shows.file} trail={props.zoomed.trail} />
          <DoneToggle
            hidden={props.view.doneHidden()}
            onToggle={props.view.toggleDone}
          />
        </div>

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
              {(date) => <DateBadge date={date()} />}
            </Show>
          </div>

          {/* What the node is waiting on, named in full and above its note:
              a page whose subject cannot start yet should say so before it
              says anything else about it. This is where a row's glyph was
              pointing. */}
          <Blocked blocked={props.zoomed.blocked} />

          {/* Zoomed, a node's note and document ARE the page under it: the node
              said the rest was here, and the subject is never densified. */}
          <NodeBody shows={props.zoomed.shows} zoomed />
        </div>
      </header>

      <Show
        when={props.rows.length > 0}
        fallback={<p class="text-muted">{nothingUnder(props.zoomed, props.view)}</p>}
      >
        <Tree rows={props.rows} view={props.view} />
      </Show>
    </>
  )
}

/** An empty page has two causes and they are not the same news: a leaf has
 *  nothing under it, a subtree that is entirely done has been hidden by this
 *  reading and is one click from coming back. */
const nothingUnder = (
  zoomed: Extract<Zoomed, { readonly kind: "node" }>,
  view: View,
): string =>
  zoomed.children.length > 0 && view.doneHidden()
    ? "Everything under this node is done, and done nodes are hidden."
    : "Nothing under this node."

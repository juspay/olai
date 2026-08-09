/**
 * One node, as a page — the zoom.
 *
 * The node's title becomes the heading, its note the body, its children the
 * familiar tree. Which node this is came from `@olai/format`'s `zoom`: a
 * mirror's id resolves through its chain, so there is exactly one page per
 * node however many placements it has, and the crumbs above it are the
 * canonical ancestry rather than the path that was clicked.
 */

import type { Row, Zoomed } from "@olai/format"
import { Show } from "solid-js"

import { Breadcrumbs } from "./Breadcrumbs.tsx"
import { DateBadge } from "./DateBadge.tsx"
import { DoneToggle } from "./DoneToggle.tsx"
import { only } from "./narrow.ts"
import { NodeTitle } from "./NodeTitle.tsx"
import { NotFound } from "./NotFound.tsx"
import { Note } from "./Note.tsx"
import { TESTID } from "./testids.ts"
import { TONE } from "./tone.ts"
import { Tree } from "./Tree.tsx"
import type { View } from "./view.ts"

export function NodePage(props: {
  readonly zoomed: Zoomed
  /** The children, as the app's one reconciled row store — the same rows an
   *  outline draws, so a zoomed page is as live as any other. */
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

        <div class="mt-2 flex items-baseline gap-3">
          <h1
            class={`m-0 flex-1 text-2xl font-bold ${TONE[props.zoomed.status]}`}
            data-testid={TESTID.zoomTitle}
            data-node-id={props.zoomed.shows.node.id}
            data-status={props.zoomed.status}
          >
            <NodeTitle title={props.zoomed.shows.node.title} />
          </h1>
          <Show when={props.zoomed.shows.node.date}>
            {(date) => <DateBadge date={date()} />}
          </Show>
        </div>

        <Show when={props.zoomed.shows.node.desc}>
          {(desc) => <Note desc={desc()} class="mt-2 text-muted" />}
        </Show>
      </header>

      <Show
        when={props.rows.length > 0}
        fallback={<p class="text-muted">{nothingUnder(props.zoomed, props.view)}</p>}
      >
        <Tree
          rows={props.rows}
          collapsed={props.view.collapsed()}
          onToggle={props.view.toggle}
        />
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

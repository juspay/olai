/**
 * One dated node, on a day's page.
 *
 * A day collects nodes from all over the set, so a title on its own would say
 * nothing: `order the new cabinets` is a different task under `kitchen
 * remodel` than under `the office move`. Every node therefore arrives with the
 * same context a zoomed page puts above one — its canonical ancestry, its
 * derived status, its tags and its note — because they are the same node and
 * have no business reading differently in two places.
 *
 * The bullet is the link, exactly as it is in the tree: a day is a way of
 * FINDING a node, and the node's own page is where it is read.
 */

import type { DatedNode } from "@olai/format"
import { Show } from "solid-js"

import { Breadcrumbs } from "../Breadcrumbs.tsx"
import { DateBadge } from "../DateBadge.tsx"
import { NodeTitle } from "../NodeTitle.tsx"
import { Note } from "../Note.tsx"
import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { TONE } from "../tone.ts"

export function DayNode(props: { readonly dated: DatedNode }) {
  const node = () => props.dated.shows.node

  return (
    <li
      class="mb-3"
      data-testid={TESTID.node}
      data-node-id={node().id}
      data-status={props.dated.status}
      data-file={props.dated.shows.file}
    >
      {/* A root has no ancestry, and an empty trail is nothing to draw. */}
      <Show when={props.dated.trail.length > 0}>
        <Breadcrumbs trail={props.dated.trail} />
      </Show>

      <div class="flex items-baseline gap-1.5">
        <Link
          route={{ kind: "node", id: node().id }}
          class="w-4 shrink-0 text-center text-muted no-underline hover:text-accent"
          testid={TESTID.zoom}
          title="zoom into this node"
          label={`zoom into ${node().id}`}
        >
          •
        </Link>
        <span class={`flex-1 ${TONE[props.dated.status]}`} data-testid={TESTID.nodeTitle}>
          <NodeTitle title={node().title} />
        </span>
        <Show when={node().date}>
          {(date) => <DateBadge date={date()} />}
        </Show>
      </div>

      <Show when={node().desc}>
        {(desc) => <Note desc={desc()} class="mt-1 ml-5.5 text-[0.9375rem] text-muted" />}
      </Show>
    </li>
  )
}

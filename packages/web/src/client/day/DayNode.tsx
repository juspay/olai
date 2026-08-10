/**
 * One dated node, on a day's page.
 *
 * A day collects nodes from all over the set, so a title on its own would say
 * nothing: `order the new cabinets` is a different task under `kitchen
 * remodel` than under `the office move`. Every node therefore arrives already
 * SITUATED — the same ancestry, derived status and canonical record a zoomed
 * page is built from (`@olai/format`'s `situate`) — because they are the same
 * node and have no business reading differently in two places.
 *
 * The bullet is the link, exactly as it is in the tree: a day is a way of
 * FINDING a node, and the node's own page is where it is read.
 */

import type { Situated } from "@olai/format"
import { Show } from "solid-js"

import { Breadcrumbs } from "../Breadcrumbs.tsx"
import { Bullet } from "../Bullet.tsx"
import { DateBadge } from "../DateBadge.tsx"
import { NodeTitle } from "../NodeTitle.tsx"
import { Note } from "../Note.tsx"
import { TESTID } from "../testids.ts"
import { TONE } from "../tone.ts"

export function DayNode(props: { readonly dated: Situated }) {
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
        <Bullet id={node().id} />
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

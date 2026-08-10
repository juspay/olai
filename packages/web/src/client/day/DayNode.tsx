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
import { NodeBody } from "../NodeBody.tsx"
import { NodeLine } from "../NodeLine.tsx"
import { TESTID } from "../testids.ts"
import { PAST_BULLET } from "../touch.ts"
import type { View } from "../view.ts"
import { placeOf } from "./place.ts"

export function DayNode(props: {
  readonly dated: Situated
  readonly view: View
}) {
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
        <NodeLine
          title={node().title}
          status={props.dated.status}
          date={node().date}
        />
      </div>

      {/* Past the bullet, which is wider where a finger is what taps it —
          ../touch.ts, so this and the bullet cannot drift apart. */}
      <div class={PAST_BULLET}>
        <NodeBody
          shows={props.dated.shows}
          place={placeOf(props.dated)}
          view={props.view}
        />
      </div>
    </li>
  )
}

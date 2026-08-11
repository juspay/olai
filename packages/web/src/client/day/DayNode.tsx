/**
 * One dated node, on a day's page.
 *
 * A day collects nodes from all over the set, so a title on its own would say
 * nothing: `order the new cabinets` is a different task under `kitchen
 * remodel` than under `the office move`. Every node therefore arrives already
 * SITUATED — the same ancestry, mark, rollup and canonical record a zoomed
 * page is built from (`@olai/format`'s `situate`) — because they are the same
 * node and have no business reading differently in two places.
 *
 * The bullet is the link and the checkbox is the status, exactly as they are
 * in the tree: a day is a way of FINDING a node, and the node's own page is
 * where it is read. Notes match the tree too — one dim clamped line under the
 * title, click/tap expands in place (../note/expand.ts).
 */

import type { Situated } from "@olai/format"
import { Show } from "solid-js"

import { Breadcrumbs } from "../Breadcrumbs.tsx"
import { Bullet } from "../Bullet.tsx"
import { Checkbox } from "../Checkbox.tsx"
import { createNoteExpand } from "../note/expand.ts"
import { NodeBody } from "../NodeBody.tsx"
import { NodeLine } from "../NodeLine.tsx"
import { TESTID } from "../testids.ts"
import { PAST_BULLET } from "../touch.ts"

export function DayNode(props: {
  readonly dated: Situated
}) {
  const node = () => props.dated.shows.node
  const note = createNoteExpand()

  return (
    <li
      class="mb-3"
      data-testid={TESTID.node}
      data-node-id={node().id}
      data-status={props.dated.status}
      data-file={props.dated.shows.file}
      data-note-open={note.expanded() ? "true" : "false"}
    >
      {/* A root has no ancestry, and an empty trail is nothing to draw. */}
      <Show when={props.dated.trail.length > 0}>
        <Breadcrumbs trail={props.dated.trail} />
      </Show>

      <div class="flex items-baseline gap-1.5" data-testid={TESTID.nodeGutter}>
        <Bullet id={node().id} />
        <Checkbox status={props.dated.status} />
        <NodeLine
          title={node().title}
          status={props.dated.status}
          progress={props.dated.progress}
          date={node().date}
        />
      </div>

      {/* Past the bullet and the checkbox — ../touch.ts, so this indent and
          those two controls cannot drift apart. */}
      <div class={PAST_BULLET} ref={note.setRoot}>
        <NodeBody
          shows={props.dated.shows}
          expanded={note.expanded()}
          onToggle={note.toggle}
        />
      </div>
    </li>
  )
}

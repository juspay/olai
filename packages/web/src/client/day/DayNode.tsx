/**
 * One dated node, on a day's page — and on the agenda, which asks the same
 * question forward (../agenda/AgendaPage.tsx). One component, because they are
 * one row: a node the set has dated, listed away from the outline it lives in.
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
 *
 * WHY a node is on this day is the one thing a day says that a tree row does
 * not have to. A node is here because it is scheduled for the day or because a
 * mark of its own is dated it — finished on it, started on it — and the entry
 * arrives already knowing which (`@olai/format`'s `Occasion`), so the badge
 * says it in a word. Nothing else changes: it is the same row, and the answer
 * rides the date that was going to be drawn anyway.
 *
 * WHETHER IT IS LATE rides the same badge, and is asked of the node rather than
 * of the date drawn: a row that is here because it was finished today is
 * wearing its `done` instant, and finished work is late at nothing.
 */

import { type DayEntry, isOverdue } from "@olai/format"
import { Show } from "solid-js"

import { blockedIds, WAITING_DIM } from "../blocked.ts"
import { Breadcrumbs } from "../Breadcrumbs.tsx"
import { Bullet } from "../Bullet.tsx"
import { Checkbox } from "../Checkbox.tsx"
import { createNoteExpand } from "../note/expand.ts"
import { NodeBody } from "../NodeBody.tsx"
import { NodeLine } from "../NodeLine.tsx"
import { TESTID } from "../testids.ts"
import { useToday } from "../today.tsx"
import { GUTTER_GAP, PAST_BULLET } from "../touch.ts"

export function DayNode(props: {
  readonly dated: DayEntry
}) {
  const node = () => props.dated.shows.node
  const note = createNoteExpand()
  const today = useToday()

  return (
    <li
      class="mb-3"
      data-testid={TESTID.node}
      data-node-id={node().id}
      data-status={props.dated.status}
      data-file={props.dated.shows.file}
      data-note-open={note.expanded() ? "true" : "false"}
      data-blocked={blockedIds(props.dated.blocked)}
    >
      {/* A root has no ancestry, and an empty trail is nothing to draw. */}
      <Show when={props.dated.trail.length > 0}>
        <Breadcrumbs trail={props.dated.trail} />
      </Show>

      <div
        class={`flex items-baseline ${GUTTER_GAP} ${WAITING_DIM(props.dated.blocked)}`}
        data-testid={TESTID.nodeGutter}
      >
        <Bullet id={node().id} />
        <Checkbox
          status={props.dated.status}
          blocked={props.dated.blocked}
          id={node().id}
        />
        {/* The date this row is HERE for, and which of the node's dates that
            is — not the `date` field, which for work finished on this day is
            either another day's business or not written at all. */}
        <NodeLine
          title={node().title}
          from={props.dated.shows.file}
          status={props.dated.status}
          progress={props.dated.progress}
          date={props.dated.date}
          occasion={props.dated.occasion}
          overdue={isOverdue(node(), today())}
        />
      </div>

      {/* Past the bullet and the checkbox — ../touch.ts, so this indent and
          those two controls cannot drift apart. */}
      <div
        class={`${PAST_BULLET} ${WAITING_DIM(props.dated.blocked)}`}
        ref={note.setRoot}
      >
        <NodeBody
          shows={props.dated.shows}
          expanded={note.expanded()}
          onToggle={note.toggle}
        />
      </div>
    </li>
  )
}

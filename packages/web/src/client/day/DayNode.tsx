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
 * The glyph is both the status and the link, exactly as it is in the tree
 * (../Glyph.tsx): a day is a way of FINDING a node, and the node's own page is
 * where it is read. The fold matches the tree too — a row is its title, the
 * pilcrow beside it opens the note, and where an untouched row starts is this
 * browser's density preference (../settings/density.ts).
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

import { Aside } from "../Aside.tsx"
import { blockedIds, WAITING_DIM } from "../blocked.ts"
import { Breadcrumbs } from "../Breadcrumbs.tsx"
import { matchedAttr, useNarrowed } from "../filter/narrowed.tsx"
import { Glyph } from "../Glyph.tsx"
import { hotOf } from "../hot.ts"
import { NoteMark } from "../note/Mark.tsx"
import { createNoteExpand } from "../note/expand.ts"
import { NodeBody } from "../NodeBody.tsx"
import { NodeLine } from "../NodeLine.tsx"
import { customEntries } from "../props/drawer.ts"
import { density, showsPreview, startsOpen } from "../settings/density.ts"
import { TESTID } from "../testids.ts"
import { useToday } from "../today.tsx"
import { GUTTER_GAP, PAST_BULLET } from "../touch.ts"

export function DayNode(props: {
  readonly dated: DayEntry
}) {
  const node = () => props.dated.shows.node
  const note = createNoteExpand(() => startsOpen(density()))
  const today = useToday()
  const narrowed = useNarrowed()
  /** Has this row anything to OPEN? The tree's rule, one file over
   *  (`../Tree.tsx`), because it is one rule about a node and not two about two
   *  surfaces. */
  const openable = () => {
    const desc = node().desc
    return (desc !== undefined && desc !== "") || customEntries(node()).length > 0
  }

  return (
    <li
      class="mb-3"
      data-testid={TESTID.node}
      data-node-id={node().id}
      data-status={props.dated.status}
      data-file={props.dated.shows.file}
      data-note-open={note.expanded() ? "true" : "false"}
      data-blocked={blockedIds(props.dated.blocked)}
      // Whether the filter SELECTED this row — one spelling, wherever a row
      // says it (../filter/narrowed.tsx). Asked of the node this entry IS: a
      // day collects records rather than placements, so there is no `shows` to
      // follow the way a tree row has one. It answers `true` for every row a
      // filtered day draws, and that is the page's claim rather than a
      // shortcut — a day and the agenda keep no context rows, because every
      // row already carries its ancestry in the crumb above it.
      data-match={matchedAttr(narrowed, node().id)}
    >
      {/* A root has no ancestry, and an empty trail is nothing to draw. */}
      <Show when={props.dated.trail.length > 0}>
        <Breadcrumbs trail={props.dated.trail} />
      </Show>

      <div
        class={`flex items-baseline ${GUTTER_GAP} ${WAITING_DIM(props.dated.blocked)}`}
        data-testid={TESTID.nodeGutter}
      >
        <Glyph
          id={node().id}
          status={props.dated.status}
          blocked={props.dated.blocked}
        />
        {/* The date this row is HERE for, and which of the node's dates that
            is — not the `date` field, which for work finished on this day is
            either another day's business or not written at all.

            The repeat rule rides beside it for the reason the date does: this
            is a row about a node, and a rule is a fact about the node. BOTH
            are read-only here — a day and the agenda are a QUERY over the
            whole set, so each pill says something rather than doing something
            (`../RepeatBadge.tsx`'s `data-picks`, `../DateBadge.tsx`'s). */}
        <NodeLine
          title={node().title}
          from={props.dated.shows.file}
          status={props.dated.status}
          open={note.expanded()}
          aside={
            <Aside hot={hotOf(node(), props.dated.progress, props.dated.status)} />
          }
          mark={
            <Show when={openable()}>
              <NoteMark open={note.expanded()} onToggle={note.toggle} ref={note.setTrigger} />
            </Show>
          }
          date={props.dated.date}
          occasion={props.dated.occasion}
          overdue={isOverdue(node(), today())}
          repeat={node().repeat}
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
          preview={showsPreview(density())}
          onToggle={note.toggle}
        />
      </div>
    </li>
  )
}

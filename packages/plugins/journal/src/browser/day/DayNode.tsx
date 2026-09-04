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
 *
 * ## Two surfaces, and the two things they disagree about
 *
 * They are still one row — same glyph, same line, same note, same `data-`
 * facts — and exactly two decisions are the caller's, because exactly two
 * depend on what the PAGE around the row has already said:
 *
 *   - WHERE THE ANCESTRY GOES. A day page heads each group with its outline, so
 *     the trail sits above the row, under that heading. The agenda's spine cut
 *     the file heading, and the trail became one muted line UNDER the row —
 *     which is what a row on a line of time looks like when nothing is stacked
 *     over it (`agenda-spine`, 2026-08-18).
 *   - WHAT THE DATE PILL SAYS, or whether there is one. A day page draws the
 *     stored date. A day on the spine has already said its own date in its
 *     heading, so the pill is dropped there and kept only for what the heading
 *     cannot say: how late the work is, and the time on a datetime
 *     (`@olai/format`'s `owedFact`).
 *
 * Two props rather than one `surface` flag: what differs is named by what it
 * is, so a third page that wants a trail under its rows says that rather than
 * saying it is the agenda.
 */

import { type DayEntry, isOverdue } from "@olai/format"
import { Show } from "solid-js"

import { Aside } from "@olai/web/client/Aside.tsx"
import { blockedIds, WAITING_DIM } from "@olai/web/client/blocked.ts"
import { Breadcrumbs } from "@olai/web/client/Breadcrumbs.tsx"
import { useNarrowed } from "@olai/web/client/filter/narrowed.tsx"
import { behindTheMark, lighting, matchedAttr } from "@olai/web/client/filter/why.ts"
import { Glyph } from "@olai/web/client/Glyph.tsx"
import { hotOf } from "@olai/web/client/hot.ts"
import { NoteMark } from "@olai/web/client/note/Mark.tsx"
import { createNoteExpand } from "@olai/web/client/note/expand.ts"
import { NodeBody } from "@olai/web/client/NodeBody.tsx"
import { NodeLine } from "@olai/web/client/NodeLine.tsx"
import { hasBody } from "@olai/web/client/body.ts"
import { density, showsPreview, startsOpen } from "@olai/web/client/settings/density.ts"
import { TESTID } from "../../testids.ts"
import { TESTID as WEB_TESTID } from "@olai/web/client/testids.ts"
import { useToday } from "@olai/web/client/today.tsx"
import { TookChip } from "@olai/web/client/live/duration/index.ts"
import { GUTTER_GAP, PAST_BULLET } from "@olai/web/client/touch.ts"

export function DayNode(props: {
  readonly dated: DayEntry
  /** Where the ancestry line sits, relative to the row it is about. */
  readonly trail: "over" | "under"
  /** What the date pill says — absent draws none. See the header. */
  readonly pill?: string
}) {
  const node = () => props.dated.shows.node
  const note = createNoteExpand(() => startsOpen(density()))
  const today = useToday()
  const narrowed = useNarrowed()
  /** Has this row anything to OPEN? One rule about a node, spelled once
   *  (`../body.ts`) — it used to be this line and the tree's, with a comment
   *  here saying they were one rule, which is the shape where two spellings
   *  drift. They had. */
  const openable = () => hasBody(node())
  /** The ancestry, when there is any — a root has none, and an empty trail is
   *  nothing to draw. Asked once and read by whichever of the two slots below
   *  this row's caller chose. */
  const ancestry = () =>
    props.dated.trail.length > 0 ? props.dated.trail : undefined
  const over = () => (props.trail === "over" ? ancestry() : undefined)
  const under = () => (props.trail === "under" ? ancestry() : undefined)

  return (
    <li
      class="mb-3"
      data-testid={WEB_TESTID.node}
      data-node-id={node().id}
      data-status={props.dated.status}
      data-file={props.dated.shows.file}
      data-note-open={note.expanded() ? "true" : "false"}
      data-blocked={blockedIds(props.dated.blocked)}
      // Whether the filter SELECTED this row — one spelling, wherever a row
      // says it (../filter/why.ts). Asked of the node this entry IS: a
      // day collects records rather than placements, so there is no `shows` to
      // follow the way a tree row has one. It answers `true` for every row a
      // filtered day draws, and that is the page's claim rather than a
      // shortcut — a day and the agenda keep no context rows, because every
      // row already carries its ancestry in the crumb above it.
      data-match={matchedAttr(narrowed, node().id)}
    >
      <Show when={over()}>{(trail) => <Breadcrumbs trail={trail()} />}</Show>

      <div
        class={`flex items-baseline ${GUTTER_GAP} ${WAITING_DIM(props.dated.blocked)}`}
          data-testid={WEB_TESTID.nodeGutter}
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
          // A day draws no CONTEXT rows — every row it keeps is a match
          // (`keepingDated`) — so the only two things a narrowed page has to
          // say here are which words landed, and where.
          needles={lighting(narrowed, node().id)}
          open={note.expanded()}
          aside={
            <Aside hot={hotOf(node(), props.dated.progress, props.dated.status)} />
          }
          mark={
            <Show when={openable()}>
              <NoteMark open={note.expanded()} onToggle={note.toggle} ref={note.setTrigger} />
            </Show>
          }
          says={props.pill}
          occasion={props.dated.occasion}
          overdue={isOverdue(node(), today())}
          repeat={node().repeat}
          // The span the work took, or is taking — the same chip the tree
          // wears: a day page and the agenda are the same row drawn
          // read-only, and the figure is no verb either way.
          took={<TookChip node={node()} />}
        />
      </div>

      {/* The trail UNDER the row, where the page over it has no heading of its
          own: indented past the bullet like the note is, so the row and what it
          says about itself hang off one column. */}
      <Show when={under()}>
        {(trail) => (
          <div class={`${PAST_BULLET} ${WAITING_DIM(props.dated.blocked)}`}>
            <Breadcrumbs trail={trail()} />
          </div>
        )}
      </Show>

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
          noteHit={behindTheMark(narrowed, node().id)}
        />
      </div>
    </li>
  )
}

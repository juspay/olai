/**
 * One outline, drawn.
 *
 * The shape of the tree is not decided here. `@olai/format` derives it —
 * sibling order, mirror expansion, the rollup beside a title and the guard
 * that stops a mirror inside its own subtree — and hands back rows, each
 * carrying the mark its node stores; this file turns a row into
 * markup and nothing else. That is the point: the view and the validator agree
 * about what a file means because they are running the same code, not because
 * two implementations were written to the same paragraph.
 *
 * A row's `kind` is what to draw, and each kind carries the answer already —
 * a dangling row knows the id its mirror chain actually died on, a cycle row
 * knows the id it closed on. Recomputing either from the record here would
 * give the FIRST hop, and say something untrue about a mirror three hops long.
 *
 * Every row's bullet is a link to that node's own page (./Bullet.tsx), on the
 * RECORD's id rather than the node it shows: a mirror's id resolves through
 * its chain to the same canonical page, so the two spellings agree and nothing
 * has to resolve anything here.
 *
 * Gutter layout matches Workflowy: on the left, a hover-reveal strip holds the
 * `•••` menu and the collapse triangle; then the filled bullet (with a gray
 * halo when children are hidden); then the status checkbox. The hover strip
 * is always visible on a phone (no hover there) — see ./touch.ts.
 *
 * A row that cannot start yet says so twice and quietly: the mark column draws
 * the waiting glyph instead of the box (./Checkbox.tsx), and the row's own
 * line and body dim. The dim is on those two rather than on the `<li>`,
 * because opacity compounds through a subtree — dimming the item would dim
 * every row nested under it, twice over for a blocked row under a blocked
 * row, and what is waiting is this node rather than everything filed beneath
 * it. The status checkbox beside it (./Checkbox.tsx)
 * reads the same stored done/doing the title tones with, and a row with no
 * mark shows no box at all — a bullet is not a task. Read-only until
 * keyboard-editing.
 *
 * A note on a row is Workflowy-style: one dim line under the title, clamped
 * with an ellipsis; click (or tap) expands in place to the full note and see
 * links; click again or click away collapses (./note/expand.ts). The date
 * badge stays on the title line. The READING (./view.ts) is only folds and
 * done-visibility — notes are not a switch.
 */

import { type Row } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createMemo, Match, Show, Switch } from "solid-js"

import { blockedIds, WAITING_DIM } from "./blocked.ts"
import { Bullet } from "./Bullet.tsx"
import { Checkbox } from "./Checkbox.tsx"
import { foldableKeys } from "./fold.ts"
import { createNoteExpand } from "./note/expand.ts"
import { NodeBody } from "./NodeBody.tsx"
import { NodeLine } from "./NodeLine.tsx"
import { NodeMenu } from "./NodeMenu.tsx"
import { TESTID } from "./testids.ts"
import {
  CHILD_INDENT,
  HOVER_CELL,
  HOVER_GUTTER,
  HOVER_REVEAL,
  PAST_CONTROLS,
} from "./touch.ts"
import type { View } from "./view.ts"

export function Tree(props: {
  readonly rows: ReadonlyArray<Row>
  readonly view: View
}) {
  return (
    <ul class="m-0 list-none p-0" data-testid={TESTID.outlineTree}>
      {/* `<Key>`, not `<For>`, and `Row.key` is why it can be: the walk mints
          fresh rows on every frame the live store publishes, and `<For>`
          compares by reference — so one character changing in one title on
          disk would tear down and rebuild every row on screen, its DOM, its
          collapse memo and its rendered note with it. A key the format already
          mints per PLACE holds each row across the frame, and only the
          bindings whose values actually moved re-run. */}
      <Key each={props.rows} by="key">
        {(row) => <Branch row={row()} view={props.view} />}
      </Key>
    </ul>
  )
}

function Branch(props: {
  readonly row: Row
  readonly view: View
}) {
  // A memo, not a plain accessor: folding one row mints a new Set, and five
  // separate computations in this component read it. Without the memo every
  // row in the tree re-runs all five on every click.
  const collapsed = createMemo(() => props.view.collapsed().has(props.row.key))
  // The RECORD a row shows, file and all — the file is what a note's relative
  // picture and a `doc` are relative to, and for a mirror that is the file the
  // node is DEFINED in rather than the one being read.
  const shown = () => (props.row.kind === "node" || props.row.kind === "mirror")
    ? props.row.shows
    : undefined

  const hasChildren = () => props.row.children.length > 0
  // Keys for expand/collapse all — recomputed only when the row object moves.
  const foldable = createMemo(() => foldableKeys(props.row))

  // Click/tap expand — local to this place, not a reading cell. No hover.
  const note = createNoteExpand()

  return (
    <li
      class="my-0.5"
      data-testid={TESTID.node}
      data-node-id={props.row.at.node.id}
      data-status={props.row.status}
      data-collapsed={String(collapsed())}
      data-kind={props.row.kind}
      data-file={props.row.at.file}
      data-line={props.row.at.line}
      data-note-open={note.expanded() ? "true" : "false"}
      // The ids this row is waiting on, in the promised order — absent when
      // nothing is in its way. The dim beside it is a styling decision a
      // refactor may change; this is the fact a scenario asks about.
      data-blocked={blockedIds(props.row.blocked)}
    >
      {/* group/row is on the LINE, not the <li>: a parent li also contains
          every nested child, and a named group-hover on the li would reveal
          every descendant's menu and triangle at once. */}
      <div
        class={`group/row flex items-center gap-1 ${WAITING_DIM(props.row.blocked)}`}
        data-testid={TESTID.nodeGutter}
      >
        {/* Hover gutter: ••• menu + collapse triangle, left of the bullet.
            Always shown on a phone; hover/focus-only on a pointer device.
            Reveal class is on each control (not the strip) so a computed
            opacity a test reads is the control's own, not a parent's that
            children do not inherit. */}
        <div class={HOVER_GUTTER}>
          <NodeMenu
            id={props.row.at.node.id}
            placeKey={props.row.key}
            hasChildren={hasChildren()}
            collapsed={collapsed()}
            foldable={foldable()}
            view={props.view}
          />
          <Show
            when={hasChildren()}
            fallback={<span class={HOVER_CELL} aria-hidden="true" />}
          >
            <button
              type="button"
              class={`${HOVER_CELL} ${HOVER_REVEAL} cursor-pointer border-0 bg-transparent p-0 text-[0.6rem] leading-none text-muted hover:text-ink`}
              data-testid={TESTID.toggle}
              aria-expanded={!collapsed()}
              aria-label={collapsed() ? "expand" : "collapse"}
              onClick={() => props.view.toggle(props.row.key)}
            >
              {/* Small filled triangle — Workflowy's chevron, rotated. */}
              <span
                class="inline-block transition-transform duration-100"
                classList={{ "-rotate-90": collapsed() }}
                aria-hidden="true"
              >
                ▼
              </span>
            </button>
          </Show>
        </div>

        <Bullet
          id={props.row.at.node.id}
          collapsed={hasChildren() && collapsed()}
        />
        <Checkbox
          status={props.row.status}
          blocked={props.row.blocked}
          id={props.row.at.node.id}
        />

        <Switch>
          <Match when={props.row.kind === "dangling" ? props.row : undefined}>
            {(row) => (
              <span class="flex-1 text-[0.9375rem] leading-snug text-alarm" data-testid={TESTID.nodeTitle}>
                a mirror of `{row().missing}`, which no node declares
              </span>
            )}
          </Match>
          <Match when={shown()}>
            {(shows) => (
              <NodeLine
                title={shows().node.title}
                status={props.row.status}
                progress={props.row.progress}
                date={shows().node.date}
              >
                <Show when={props.row.kind !== "node"}>
                  <span class="mr-1 text-muted" title="a mirror of another node">
                    ⇢
                  </span>
                </Show>
              </NodeLine>
            )}
          </Match>
        </Switch>
      </div>

      {/* Indented past the gutter controls — which are wider where a finger is
          what taps them, so the note and the document under it line up with the
          title on either. The note control root is what "click away" uses. */}
      <Show when={!collapsed() && shown()}>
        {(shows) => (
          <div
            class={`${PAST_CONTROLS} ${WAITING_DIM(props.row.blocked)}`}
            ref={note.setRoot}
          >
            <NodeBody
              shows={shows()}
              expanded={note.expanded()}
              onToggle={note.toggle}
            />
          </div>
        )}
      </Show>

      <Show when={props.row.kind === "cycle" ? props.row : undefined}>
        {(row) => (
          <div class={`${PAST_CONTROLS} text-sm text-alarm`}>
            this mirror is inside the subtree it shows (`{row().through}`) — not
            expanded
          </div>
        )}
      </Show>

      <Show when={!collapsed() && props.row.children.length > 0}>
        <ul class={CHILD_INDENT}>
          <Key each={props.row.children} by="key">
            {(child) => <Branch row={child()} view={props.view} />}
          </Key>
        </ul>
      </Show>
    </li>
  )
}

/**
 * One outline, drawn.
 *
 * The shape of the tree is not decided here. `@olai/format` derives it —
 * status, sibling order, mirror expansion and the guard that stops a mirror
 * inside its own subtree — and hands back rows; this file turns a row into
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
 * has to resolve anything here. The status checkbox beside it (./Checkbox.tsx)
 * reads the same derived done/doing the title tones with, and a row with no
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

import { Bullet } from "./Bullet.tsx"
import { Checkbox } from "./Checkbox.tsx"
import { createNoteExpand } from "./note/expand.ts"
import { NodeBody } from "./NodeBody.tsx"
import { NodeLine } from "./NodeLine.tsx"
import { TESTID } from "./testids.ts"
import { CONTROL, CONTROL_SPACER, PAST_CONTROLS } from "./touch.ts"
import type { View } from "./view.ts"

export function Tree(props: {
  readonly rows: ReadonlyArray<Row>
  readonly view: View
}) {
  return (
    <ul class="list-none m-0 p-0" data-testid={TESTID.outlineTree}>
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
    >
      <div class="flex items-baseline gap-1.5" data-testid={TESTID.nodeGutter}>
        <Show
          when={props.row.children.length > 0}
          fallback={<span class={CONTROL_SPACER} aria-hidden="true" />}
        >
          <button
            type="button"
            // Sized like the bullet beside it, from the same place: the gutter
            // is one width, and the blank above and the indents below are all
            // arithmetic over it (./touch.ts).
            class={`${CONTROL} cursor-pointer border-0 bg-transparent p-0 text-center text-xs text-muted hover:text-ink`}
            data-testid={TESTID.toggle}
            aria-expanded={!collapsed()}
            aria-label={collapsed() ? "expand" : "collapse"}
            onClick={() => props.view.toggle(props.row.key)}
          >
            {collapsed() ? "▸" : "▾"}
          </button>
        </Show>

        <Bullet id={props.row.at.node.id} />
        <Checkbox status={props.row.status} />

        <Switch>
          <Match when={props.row.kind === "dangling" ? props.row : undefined}>
            {(row) => (
              <span class="flex-1 text-sm text-alarm" data-testid={TESTID.nodeTitle}>
                a mirror of `{row().missing}`, which no node declares
              </span>
            )}
          </Match>
          <Match when={shown()}>
            {(shows) => (
              <NodeLine
                title={shows().node.title}
                from={shows().file}
                status={props.row.status}
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

      {/* Indented past both controls — which are wider where a finger is what
          taps them, so the note and the document under it line up with the
          title on either. The note control root is what "click away" uses. */}
      <Show when={!collapsed() && shown()}>
        {(shows) => (
          <div class={PAST_CONTROLS} ref={note.setRoot}>
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
        <ul class="ml-5 list-none border-l border-rule pl-3">
          <Key each={props.row.children} by="key">
            {(child) => <Branch row={child()} view={props.view} />}
          </Key>
        </ul>
      </Show>
    </li>
  )
}

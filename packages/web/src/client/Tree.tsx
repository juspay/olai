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
 * mark shows no box at all — a bullet is not a task. The box stays
 * display-only: what ticks it is `Ctrl+Enter` in the row's own editor, and what
 * walks it round the other two answers is `Ctrl+Shift+Enter` — which is where
 * every other edit is made too (./edit/editing.tsx).
 *
 * A row is EDITABLE in place. Click its title and the title span is replaced
 * by an input in the same cell — no second layout and no mode — and the keys
 * of the Workflowy loop are that input's (../keys.ts says which, and why they
 * are the editor's rather than the window's). Two more things belong to the
 * same editor and are drawn only while it is here: a note being written as
 * TEXT rather than rendered, and the reason a commit was refused. A row being
 * typed is still not a row that has changed — nothing is echoed, and what the
 * tree draws is the file.
 *
 * A note on a row is Workflowy-style: one dim line under the title, clamped
 * with an ellipsis; click (or tap) expands in place to the full note and see
 * links; click again or click away collapses (./note/expand.ts). The date
 * badge stays on the title line. The READING (./view.ts) is only folds and
 * done-visibility — notes are not a switch.
 */

import { isOverdue, type Row } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createMemo, Match, Show, Switch } from "solid-js"

import { blockedIds, WAITING_DIM } from "./blocked.ts"
import { Bullet } from "./Bullet.tsx"
import { Checkbox } from "./Checkbox.tsx"
import { useDerived } from "./derived.tsx"
import { useEditor } from "./edit/editing.tsx"
import { useUndo } from "./edit/undoing.ts"
import { NewRow } from "./edit/NewRow.tsx"
import { DescEditor, keyHandler, Said, TitleEditor } from "./edit/RowEditor.tsx"
import { foldableKeys } from "./fold.ts"
import { createNoteExpand } from "./note/expand.ts"
import { NodeBody } from "./NodeBody.tsx"
import { NodeLine } from "./NodeLine.tsx"
import { nodeMenuActions } from "./menu/actions.ts"
import { NodeMenu } from "./menu/NodeMenu.tsx"
import { useRouter } from "./router.tsx"
import { TESTID } from "./testids.ts"
import { useToday } from "./today.tsx"
import {
  CHILD_INDENT,
  GUTTER_GAP,
  HOVER_CELL,
  HOVER_GUTTER,
  HOVER_REVEAL,
  PAST_CONTROLS,
  ROW_TITLE,
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
  // SPA navigate for the menu's "Zoom in" — same path as the bullet, never
  // location.assign (which reloads the document and kills the reading).
  const router = useRouter()
  // The SET's own indexes, for the one menu verb whose question the rows
  // cannot answer: how much an archive takes with it. These rows are a
  // reading — done-hidden has already dropped branches from them — and the
  // confirm has to name what the write moves (./menu/subtree.ts).
  const derived = useDerived()
  // ⌘Z is one stack for this page, whichever hand wrote: a menu verb files
  // what would take it back exactly as a keystroke does (./menu/writes.ts).
  const undo = useUndo()
  // Whether this row's date has gone by on work nobody has finished. Asked of
  // the node the row SHOWS — a mirror carries neither a date nor a mark — and
  // of the one clock this app reads (./today.tsx).
  const today = useToday()

  // Click/tap expand — local to this place, not a reading cell. No hover.
  const note = createNoteExpand()

  // The editor is one draft for the whole page, and this is the one question a
  // row asks of it: is the caret HERE? Asked of WHERE the caret is rather than
  // of the draft — three primitives that do not move while a person types — so
  // one character typed re-runs nothing in the rows around it. The row that
  // matches then reads the draft for its text, which is the one place that
  // value is wanted.
  //
  // A row being typed is matched by `Row.key`, its PLACE: the same node reached
  // through two mirrors is two rows, and only the one that was clicked has the
  // caret. A row being ADDED is matched by the anchor it named, which is a row
  // on screen — the new line is drawn after the line it will follow.
  const editor = useEditor()
  const typing = (field: "title" | "desc") => {
    const at = editor.where()
    if (at.place !== props.row.key || at.field !== field) return undefined
    const draft = editor.draft()
    return draft?.kind === "row" ? draft : undefined
  }
  const pending = () => {
    if (editor.where().after !== props.row.at.node.id) return undefined
    const draft = editor.draft()
    return draft?.kind === "new" ? draft : undefined
  }
  /** Is the caret in THIS row? What the row draws to say so, and what a
   *  scenario asks. A blinking text cursor at the end of a title was the whole
   *  affordance a walk with `↑`/`↓` had, and in a tree of a hundred rows that
   *  is a pixel nobody finds — so the row is toned while it holds the caret,
   *  and the bullet beside it takes the accent. */
  const editing = () => editor.where().place === props.row.key

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
      data-editing={editing() ? "true" : undefined}
      // The ids this row is waiting on, in the promised order — absent when
      // nothing is in its way. The dim beside it is a styling decision a
      // refactor may change; this is the fact a scenario asks about.
      data-blocked={blockedIds(props.row.blocked)}
    >
      {/* group/row is on the LINE, not the <li>: a parent li also contains
          every nested child, and a named group-hover on the li would reveal
          every descendant's menu and triangle at once. Gap is GUTTER_GAP —
          the same number PAST_CONTROLS is arithmetic over (./touch.ts). */}
      <div
        class={`group/row flex items-center ${GUTTER_GAP} ${WAITING_DIM(props.row.blocked)}`}
        classList={{ "rounded-sm bg-accent/10": editing() }}
        data-testid={TESTID.nodeGutter}
      >
        {/* Hover strip: triangle always (phone) / hover-reveal (pointer);
            ••• menu only on pointer devices (hidden below md). */}
        <div class={HOVER_GUTTER}>
          {/* The catalog is built where it is READ, which is inside the open
              panel: Solid compiles a dynamic component prop to a getter, so
              this call does not run for the rows nobody has opened a menu on.
              That is load-bearing rather than incidental — one of the verbs
              counts the rows under this one (`menu/subtree.ts`), and a walk
              per row per frame would be the tree squared. */}
          <NodeMenu
            actions={nodeMenuActions({
              row: props.row,
              derived: derived(),
              collapsed: collapsed(),
              foldable: foldable(),
              view: props.view,
              go: router.go,
              record: undo.record,
            })}
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
          holding={editing()}
        />
        <Checkbox
          status={props.row.status}
          blocked={props.row.blocked}
          id={props.row.at.node.id}
        />

        <Switch>
          <Match when={props.row.kind === "dangling" ? props.row : undefined}>
            {(row) => (
              <span class={`flex-1 ${ROW_TITLE} text-alarm`} data-testid={TESTID.nodeTitle}>
                a mirror of `{row().missing}`, which no node declares
              </span>
            )}
          </Match>
          {/* The caret, where the title was. One `<Show>` rather than a
              second row: the editor takes the title's own cell, so nothing
              in the gutter moves and the line does not jump under the
              pointer that opened it. */}
          <Match when={typing("title")}>
            {(draft) => (
              <TitleEditor
                text={draft().text}
                onInput={editor.type}
                onKey={keyHandler("line", editor.press)}
                onBlur={(left) => editor.blur({ row: props.row.at.node.id, field: "title" }, left)}
              />
            )}
          </Match>
          <Match when={shown()}>
            {(shows) => (
              <NodeLine
                title={shows().node.title}
                from={shows().file}
                status={props.row.status}
                progress={props.row.progress}
                date={shows().node.date}
                overdue={isOverdue(shows().node, today())}
                onEdit={() => editor.open(props.row, "title")}
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

      {/* What the last write said about this row — the reason it was refused,
          or the nudge from one that landed. Above the body rather than in it,
          because a COLLAPSED row draws no body and a refusal must be visible
          wherever the caret is. */}
      <Show when={typing("title") ?? typing("desc")}>
        {(draft) => (
          <div class={PAST_CONTROLS}>
            <Said draft={draft()} />
          </div>
        )}
      </Show>

      {/* Indented past the gutter controls — which are wider where a finger is
          what taps them, so the note and the document under it line up with the
          title on either. The note control root is what "click away" uses. */}
      <Show when={!collapsed() && shown()}>
        {(shows) => (
          <div
            class={`${PAST_CONTROLS} ${WAITING_DIM(props.row.blocked)}`}
            ref={note.setRoot}
          >
            {/* The note as TEXT while it is being written, rendered markdown
                the rest of the time — the same swap the title makes, one
                level down. */}
            <Show
              when={typing("desc")}
              fallback={
                <NodeBody
                  shows={shows()}
                  expanded={note.expanded()}
                  onToggle={note.toggle}
                  onEdit={() => editor.open(props.row, "desc")}
                />
              }
            >
              {(draft) => (
                <DescEditor
                  text={draft().text}
                  onInput={editor.type}
                  onKey={keyHandler("block", editor.press)}
                  onBlur={(left) => editor.blur({ row: props.row.at.node.id, field: "desc" }, left)}
                />
              )}
            </Show>
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

      {/* A row being typed that is not a node yet, drawn where it will land:
          INSIDE this item and after its children, which is exactly where the
          next sibling appears in an outline. It is not a row of the tree — no
          `<li>`, no testid a scenario counts nodes with — because nothing has
          been written. */}
      <Show when={pending()}>
        {(draft) => (
          <NewRow
            draft={draft()}
            onInput={editor.type}
            onKey={keyHandler("line", editor.press)}
            onBlur={(left) => editor.blur({ row: props.row.at.node.id, field: "new" }, left)}
          />
        )}
      </Show>
    </li>
  )
}

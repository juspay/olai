import { useRowElement } from "./row-elements.ts"
import { useLicences } from "./reading.tsx"
import { dressed } from "./faces.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import { isOverdue, type Row, shownRecord } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createEffect, createMemo, createSignal, Match, onCleanup, Show, Switch } from "solid-js"

import { Aside } from "./Aside.tsx"
import { blockedIds, WAITING_DIM } from "./blocked.ts"
import { Glyph } from "./Glyph.tsx"
import { useDragging } from "./drag/dragging.ts"
import { Handle } from "./drag/Handle.tsx"
import { useSelection } from "./select/selection.ts"
import { RowForms, useRowForms } from "./date/memory.tsx"
import { createDatePicking } from "./date/picking.tsx"

import { createEdgeEditing } from "./edges/editing.tsx"
import { useEditor } from "./edit/editing.tsx"
import { Ghosts } from "./edit/Ghosts.tsx"
import { offsetAt, titleBox } from "./edit/point.ts"
import { useMoving } from "./move/moving.tsx"
import { useNarrowed } from "./filter/narrowed.tsx"
import { behindTheMark, CONTEXT_DIM, lighting, matchedAttr } from "./filter/why.ts"
import { onATag } from "./filter/tag.ts"
import { useUndo } from "./edit/undoing.ts"
import { DescEditor, DraftSaid, keyHandler, TitleEditor } from "./edit/RowEditor.tsx"
import { setFolded } from "./fold/memory.ts"
import { FoldProvider, useFolded } from "./fold/reading.ts"
import { foldIdOf, foldOf, foldsUnder } from "./fold/rows.ts"
import { useFocused, selectNode } from "./focus.ts"
import { doneUnder } from "@olai/web/client/hidden.ts"
import { isEditingTarget } from "@olai/web/client/keys.ts"
import { hotOf } from "./hot.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { NoteMark } from "./note/Mark.tsx"
import { createNoteExpand } from "./note/expand.ts"
import { hasBody } from "./body.ts"
import { NodeBody } from "./NodeBody.tsx"
import { NodeLine } from "./NodeLine.tsx"
import { nodeMenuActions } from "./menu/actions.ts"
import { usePins } from "./pins.ts"
import { createMenuDoor } from "./menu/door.ts"
import { NodeMenu } from "./menu/NodeMenu.tsx"
import { useGo, useRouter } from "olai-plugin-navigation/routing"
import { density, showsPreview, startsOpen } from "./settings/density.ts"

import { useToday } from "./clock.ts"
import { TookChip } from "./live/duration/index.ts"
import {
  CHILD_INDENT,
  GUTTER_GAP,
  HELD,
  HOVER_CELL,
  HOVER_GUTTER,
  HOVER_REVEAL,
  PAST_CONTROLS,
  ROOT_RAIL,
  ROW_LINE,
  ROW_TITLE,
} from "@olai/ui-primitives/touch.ts"
import { applying } from "./writes.ts"
import { Tip } from "@olai/web/client/Tip.tsx"

const MIRRORED = "Mirrored from elsewhere"

export function Tree(props: {
  readonly rows: ReadonlyArray<Row>
}) {
  return (
    <FoldProvider><RowForms>
      <ul
        class={`olai-tree my-0 list-none ${ROOT_RAIL}`}
        data-sweep=""
        data-testid={TESTID.outlineTree}
      >
        <Key each={props.rows} by="key">
          {(row) => <Branch row={row()} depth={0} />}
        </Key>
      </ul>
    </RowForms></FoldProvider>
  )
}

function Branch(props: {
  readonly row: Row
  readonly depth: number
}) {
  const narrowed = useNarrowed()
  const folded = useFolded()
  const collapsed = createMemo(() => folded(foldIdOf(props.row)))
  const shown = () => (props.row.kind === "node" || props.row.kind === "mirror")
    ? props.row.shows
    : undefined

  const hasChildren = () => props.row.children.length > 0
  const foldable = () => foldsUnder(props.row)
  const go = useGo()
  const routes = useRouter().routes
  const pins = usePins()
  const licences = useLicences()
  const undo = useUndo()
  const today = useToday()

  const note = createNoteExpand(() => startsOpen(density()))

  const section = () => props.depth === 0

  const openable = () => {
    const shows = shown()
    if (shows === undefined) return false
    return hasBody(shows.node)
  }

  const menu = createMenuDoor()

  const [band, setBand] = createSignal<number>()
  createEffect(() => {
    const line = menu.at()
    if (!section() || line === undefined) return
    const seen = new ResizeObserver(() => setBand(line.getBoundingClientRect().height))
    seen.observe(line)
    onCleanup(() => seen.disconnect())
  })

  const forms = useRowForms(props.row.key)
  const dates = createDatePicking(() => shown()?.node, forms)

  const [adding, setAdding] = createSignal(false)

  const edges = createEdgeEditing(() => shown()?.node, forms.edges)

  const moving = useMoving()

  const editor = useEditor()
  const typing = (field: "title" | "desc") => {
    if (!editor.isEditing(props.row.key) || editor.where().field !== field) return undefined
    const draft = editor.draft()
    return draft?.kind === "row" ? draft : undefined
  }
  const live = (kind: "after" | "before" | "under") => {
    if (!editor.pendingAt(kind, props.row.at.node.id)) return undefined
    return editor.live() ?? undefined
  }
  const titleCell = () => (
    <TitleEditor
      text={typing("title")?.text ?? ""}
      caret={typing("title")?.caret}
      section={section()}
      onInput={editor.type}
      onKey={keyHandler("line", editor.press)}
      onBlur={(left) => editor.blur({ row: props.row.at.node.id, field: "title" }, left)}
    />
  )
  const parked = (kind: "after" | "before" | "under") =>
    editor.ghostsAt(kind, props.row.at.node.id)

  const editing = () => editor.isEditing(props.row.key)
  const isFocused = useFocused()
  const focused = () => isFocused(foldIdOf(props.row))

  const shownId = createMemo(() => shownRecord(props.row).node.id)
  const rowElement = useRowElement(() => props.row.at.node.id, shownId)

  const selection = useSelection()
  const dragging = useDragging()
  const picked = () => selection.has(props.row.key)
  const carried = () => dragging.carrying(props.row.key)

  const clickTitle = (event: MouseEvent) => {
    if (onATag(event)) return
    if (event.target instanceof Element && event.target.closest("a[href]")) return
    if (isEditingTarget(event.target)) return
    if (event.shiftKey) {
      selection.extend(props.row.key)
      return
    }
    if (event.metaKey || event.ctrlKey) {
      selection.toggle(props.row.key)
      return
    }
    const title = props.row.kind === "node" || props.row.kind === "mirror"
      ? props.row.shows.node.title
      : ""
    const here = titleBox(event)
    const caret = here === null
      ? undefined
      : offsetAt(title, here.box, event.clientX, here.widthOf)
    editor.open(props.row, "title", caret === undefined ? undefined : { caret })
  }

  return (
    <li
      class="my-0"
      classList={{ "olai-section": section() }}
      style={section() && band() !== undefined ? { "--olai-pinned-band": `${band()}px` } : undefined}
      data-sweep=""
      ref={rowElement}
      data-testid={TESTID.node}
      data-node-id={props.row.at.node.id}
      data-status={props.row.status}
      data-collapsed={String(collapsed())}
      data-kind={props.row.kind}
      data-file={props.row.at.file}
      data-line={props.row.at.line}
      data-note-open={note.expanded() ? "true" : "false"}
      data-editing={editing() ? "true" : undefined}
      data-picked={picked() ? "true" : undefined}
      data-carried={carried() ? "true" : undefined}
      data-focused={focused() ? "true" : undefined}
      onFocusIn={event => {
        if (event.target.closest(`[data-testid="${TESTID.newRow}"]`) !== null) return
        if (!event.target.closest("[data-outline-fold]") && event.target.closest(`[data-testid="${TESTID.node}"]`) === event.currentTarget) {
          selectNode(foldIdOf(props.row))
        }
      }}
      data-blocked={blockedIds(props.row.blocked)}
      data-match={matchedAttr(narrowed, shownId())}
    >
      <Ghosts parked={parked("before")} live={live("before")} />

      <div
        ref={menu.line}
        class={`group/row ${ROW_LINE} ${HELD} ${
          WAITING_DIM(props.row.blocked)
        } ${CONTEXT_DIM(narrowed, shownId())}`}
        onPointerDown={menu.hold.onPointerDown}
        onContextMenu={menu.hold.onContextMenu}
        classList={{
          [`sticky top-[var(--height-chrome)] mt-2 py-1 ${LAYER.row}`]: section(),
          "bg-paper": section() && !editing() && !picked(),
          "rounded-control bg-accent/8": editing() || picked(),
          "rounded-control ring-1 ring-accent/35": focused(),
          "opacity-40": carried(),
        }}
        data-testid={TESTID.nodeGutter}
        data-row-key={props.row.key}
        data-active={focused() || editing() ? "" : undefined}
      >
        <div class={HOVER_GUTTER}>
          <NodeMenu
            door={menu}
            actions={nodeMenuActions({
              placement: { kind: (key, value) => licences()(shown()?.file ?? props.row.at.file, key, value),
                at: kind => dressed("outline.row.placement").get(kind) },
              routes,
              row: props.row,
              pins: pins(),
              foldable: foldable(),
              go,
              record: undo.record,
              panels: {
                pickDate: dates.openDate,
                pickRepeat: dates.openRepeat,
                pickEdge: edges.open,
                addProp: () => {
                  setAdding(true)
                },
                pickMove: () => moving.open({ record: props.row.at.node.id, place: props.row.key }),
              },
            })}
          />
          <Show
            when={hasChildren()}
            fallback={<span class={HOVER_CELL} aria-hidden="true" />}
          >
            <button
              type="button"
              class={`${HOVER_CELL} ${HOVER_REVEAL} cursor-pointer border-0 bg-transparent p-0 text-caption leading-none text-muted hover:text-ink`}
              data-testid={TESTID.toggle}
              aria-expanded={!collapsed()}
              aria-label={collapsed() ? "Expand" : "Collapse"}
              onClick={() => setFolded([foldOf(props.row)], !collapsed())}
            >
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

        <Handle row={props.row}>
          <Glyph
            id={props.row.at.node.id}
            status={props.row.status}
            blocked={props.row.blocked}
            collapsed={hasChildren() && collapsed()}
            holding={editing()}
          />
        </Handle>

        <Switch>
          <Match when={props.row.kind === "dangling" ? props.row : undefined}>
            {(row) => (
              <span class={`flex-1 ${ROW_TITLE} text-alarm`} data-testid={TESTID.nodeTitle}>
                a mirror of `{row().missing}`, which no node declares
              </span>
            )}
          </Match>
          <Match when={shown()}>
            {(shows) => (
              <NodeLine
                record={props.row.at.node.id}
                node={shows().node.id}
                title={shows().node.title}
                from={shows().file}
                status={props.row.status}
                needles={lighting(narrowed, shownId())}
                section={section()}
                open={note.expanded()}
                aside={
                  <Aside
                    hot={hotOf(shows().node, props.row.progress, props.row.status)}
                    folded={collapsed() ? doneUnder(props.row) : undefined}
                  />
                }
                mark={
                  <Show when={openable()}>
                    <NoteMark open={note.expanded()} onToggle={note.toggle} ref={note.setTrigger} />
                  </Show>
                }
                says={shows().node.date}
                repeat={shows().node.repeat}
                overdue={isOverdue(shows().node, today())}
                took={<TookChip node={shows().node} />}
                onEdit={clickTitle}
                onPickDate={dates.openDate}
                onPickRepeat={dates.openRepeat}
                titleEditor={typing("title") === undefined ? undefined : titleCell}
              >
                <Show when={props.row.kind !== "node"}>
                  <Tip text={MIRRORED}>
                    <span class="mr-1 text-muted" role="img" aria-label={MIRRORED}>
                      ⇢
                    </span>
                  </Tip>
                </Show>
              </NodeLine>
            )}
          </Match>
        </Switch>
      </div>

      <dates.Panels class={PAST_CONTROLS} />

      <Show when={edges.showing()}>
        <div class={PAST_CONTROLS}>
          <edges.Panel />
        </div>
      </Show>

      <Show when={moving.showing(props.row.key)}>
        <div class={PAST_CONTROLS}>
          <moving.Panel />
        </div>
      </Show>

      <Show when={typing("title") ?? typing("desc")}>
        {(draft) => (
          <div class={PAST_CONTROLS}>
            <DraftSaid draft={draft()} />
          </div>
        )}
      </Show>

      <Show when={!collapsed() && shown()}>
        {(shows) => (
          <div
            class={`${PAST_CONTROLS} ${WAITING_DIM(props.row.blocked)} ${
              CONTEXT_DIM(narrowed, shownId())
            }`}
            ref={note.setRoot}
          >
            <Show
              when={typing("desc")}
              fallback={
                <NodeBody
                  record={props.row.at.node.id}
                  shows={shows()}
                  expanded={note.expanded()}
                  noteHit={behindTheMark(narrowed, shownId())}
                  preview={showsPreview(density())}
                  onToggle={note.toggle}
                  onEdit={(caret) =>
                    editor.open(
                      props.row,
                      "desc",
                      caret === undefined ? undefined : { caret },
                    )}

                  onUnsee={(target) => edges.drop("see", target)}
                  onProp={(key, value, was) =>
                    applying(
                      { verb: "prop", id: shows().node.id, key, value, was },
                      undo.record,
                    )}
                  addingProp={adding()}
                  onAddingPropEnd={() => setAdding(false)}
                />
              }
            >
              {(draft) => (
                <DescEditor
                  text={draft().text}
                  caret={draft().caret}
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
          <div class={`${PAST_CONTROLS} text-body text-alarm`}>
            this mirror is inside the subtree it shows (`{row().through}`) — not
            expanded
          </div>
        )}
      </Show>

      <Show
        when={parked("under").length > 0 || live("under") !== undefined ||
          (!collapsed() && props.row.children.length > 0)}
      >
        <ul class={CHILD_INDENT} data-sweep="">
          <Ghosts parked={parked("under")} live={live("under")} />
          <Show when={!collapsed()}>
            <Key each={props.row.children} by="key">
              {(child) => <Branch row={child()} depth={props.depth + 1} />}
            </Key>
          </Show>
        </ul>
      </Show>

      <Ghosts parked={parked("after")} live={live("after")} />
    </li>
  )
}

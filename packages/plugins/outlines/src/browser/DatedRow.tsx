import { useRowElement } from "./row-elements.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import { type DayEntry, isOverdue } from "@olai/format"
import { useGo, useRouter } from "olai-plugin-navigation/routing"
import { Show } from "solid-js"

import { Aside } from "./Aside.tsx"
import { blockedIds, WAITING_DIM } from "./blocked.ts"
import { Breadcrumbs } from "./Breadcrumbs.tsx"
import { useNarrowed } from "./filter/narrowed.tsx"
import { behindTheMark, lighting, matchedAttr } from "./filter/why.ts"
import { Glyph } from "./Glyph.tsx"
import { hotOf } from "./hot.ts"
import { NoteMark } from "./note/Mark.tsx"
import { createNoteExpand } from "./note/expand.ts"
import { NodeBody } from "./NodeBody.tsx"
import { NodeLine } from "./NodeLine.tsx"
import { hasBody } from "./body.ts"
import { density, showsPreview, startsOpen } from "./settings/density.ts"


import { useToday } from "./clock.ts"
import { TookChip } from "./live/duration/index.ts"
import { GUTTER_GAP, HANGING_MENU, HELD, PAST_BULLET } from "@olai/ui-primitives/touch.ts"
import { createRowForm } from "./date/memory.tsx"
import { createDatePicking } from "./date/picking.tsx"
import { createEdgeEditing } from "./edges/editing.tsx"
import { useUndo } from "./edit/undoing.ts"
import { subjectMenuActions } from "./menu/actions.ts"
import { createMenuDoor } from "./menu/door.ts"
import { NodeMenu } from "./menu/NodeMenu.tsx"
import { subjectOfSituated } from "./menu/verbs.ts"
import { usePins } from "./pins.ts"
import { useFocused, selectNode } from "./focus.ts"

export function DatedRow(props: {
  readonly dated: DayEntry
  readonly trail: "over" | "under"
  readonly pill?: string
}) {
  const isFocused = useFocused()
  const node = () => props.dated.shows.node
  const rowElement = useRowElement(() => node().id, () => node().id)
  const note = createNoteExpand(() => startsOpen(density()))
  const today = useToday()
  const narrowed = useNarrowed()
  const openable = () => hasBody(node())
  const ancestry = () =>
    props.dated.trail.length > 0 ? props.dated.trail : undefined
  const over = () => (props.trail === "over" ? ancestry() : undefined)
  const under = () => (props.trail === "under" ? ancestry() : undefined)

  const menu = createMenuDoor()
  const forms = createRowForm()
  const dates = createDatePicking(node, forms)
  const edges = createEdgeEditing(node, forms.edges)
  const go = useGo()
  const routes = useRouter().routes
  const pins = usePins()
  const undo = useUndo()

  return (
    <li
      class="mb-3"
      ref={rowElement} data-testid={TESTID.node}
      data-node-id={node().id}
      data-status={props.dated.status}
      data-file={props.dated.shows.file}
      data-note-open={note.expanded() ? "true" : "false"}
      data-blocked={blockedIds(props.dated.blocked)}
      data-match={matchedAttr(narrowed, node().id)}
    >
      <Show when={over()}>{(trail) => <Breadcrumbs trail={trail()} />}</Show>

      <div
        ref={menu.line}
        class={`group/row relative flex items-baseline ${HELD} ${GUTTER_GAP} ${WAITING_DIM(props.dated.blocked)}`}
        data-testid={TESTID.nodeGutter}
        onPointerDown={menu.hold.onPointerDown}
        onContextMenu={menu.hold.onContextMenu}
        onClick={event => { if (!(event.target instanceof Element && event.target.closest("a[href]"))) selectNode(node().id) }}
        data-active={isFocused(node().id) ? "" : undefined}
      >
        <div class={HANGING_MENU}>
          <NodeMenu
            door={menu}
            actions={subjectMenuActions({
              routes,
              subject: subjectOfSituated(props.dated),
              under: props.dated.under,
              pins: pins(),
              go,
              record: undo.record,
              panels: {
                pickDate: dates.openDate,
                pickRepeat: dates.openRepeat,
                pickEdge: edges.open,
              },
            })}
          />
        </div>
        <Glyph
          id={node().id}
          status={props.dated.status}
          blocked={props.dated.blocked}
        />
        <NodeLine
          node={node().id}
          title={node().title}
          from={props.dated.shows.file}
          status={props.dated.status}
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
          took={<TookChip node={node()} />}
        />
      </div>

      <Show when={under()}>
        {(trail) => (
          <div class={`${PAST_BULLET} ${WAITING_DIM(props.dated.blocked)}`}>
            <Breadcrumbs trail={trail()} />
          </div>
        )}
      </Show>

      <dates.Panels class={PAST_BULLET} />
      <Show when={edges.showing()}>
        <div class={PAST_BULLET}>
          <edges.Panel />
        </div>
      </Show>

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

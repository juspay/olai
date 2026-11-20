import { createMemo } from "solid-js"
import { sameList } from "@olai/web/client/same.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import { RowForms, useRowForms } from "./date/memory.tsx"
import { isOverdue, type Row, type Zoomed } from "@olai/format"
import { Show } from "solid-js"

import { Backlinks } from "./backlinks/Backlinks.tsx"
import { blockedIds } from "./blocked.ts"
import { Blocked } from "./Blocked.tsx"
import { Breadcrumbs } from "./Breadcrumbs.tsx"
import { DateBadge } from "./DateBadge.tsx"
import { EdgeRefs } from "./edges/EdgeRefs.tsx"
import { createEdgeEditing } from "./edges/editing.tsx"
import { useUndo } from "./edit/undoing.ts"
import { EdgeVerbs } from "./edges/EdgeVerbs.tsx"
import { Editable } from "./edit/Editable.tsx"
import { StartLine } from "./edit/StartLine.tsx"
import { useNarrowed } from "./filter/narrowed.tsx"
import { only } from "@olai/web/client/narrow.ts"
import { NodeBody } from "./NodeBody.tsx"
import { PluginAsides } from "./Asides.tsx"
import { PluginPageHead, PluginPageFoot } from "./PageFaces.tsx"
import { NodeTitle } from "./NodeTitle.tsx"
import { NotFound } from "./NotFound.tsx"
import { ProgressBadge } from "@olai/web/client/ProgressBadge.tsx"
import { RepeatBadge } from "./RepeatBadge.tsx"
import { doneHiddenOn } from "./settings/done.ts"
import { PAGE_TITLE } from "@olai/web/client/look.ts"
import { applying } from "./writes.ts"

import { useToday } from "./clock.ts"
import { toneOf } from "./tone.ts"
import { Tree } from "./Tree.tsx"

export function NodePage(props: {
  readonly zoomed: Zoomed
  readonly rows: ReadonlyArray<Row>
}) {
  return (
    <Show
      when={only(props.zoomed, "node")}
      fallback={<NotFound zoomed={props.zoomed} />}
    >
      {(zoomed) => <RowForms namespace="zoom"><Zoom zoomed={zoomed()} rows={props.rows} /></RowForms>}
    </Show>
  )
}

function Zoom(props: {
  readonly zoomed: Extract<Zoomed, { readonly kind: "node" }>
  readonly rows: ReadonlyArray<Row>
}) {
  const today = useToday()
  const narrowed = useNarrowed()
  const within = createMemo(() => [...props.zoomed.trail.map(crumb => crumb.node.id), props.zoomed.shows.node.id], [], { equals: sameList })
  const forms = useRowForms(`heading:${props.zoomed.shows.node.id}`)
  const edges = createEdgeEditing(() => props.zoomed.shows.node, forms.edges)
  const undo = useUndo()

  return (
    <Editable
      rows={() => props.rows}
      file={props.zoomed.shows.file}
      within={within()}
    >
      <div class="contents">

        <div
          class="grow"
          data-testid={TESTID.node}
          data-node-id={props.zoomed.shows.node.id}
          data-status={props.zoomed.status}
          data-blocked={blockedIds(props.zoomed.blocked)}
          data-kind="node"
        >
          <div class={`sticky top-[var(--height-chrome)] ${LAYER.page} h-0 md:hidden`} aria-hidden="true">
            <p class="m-0 truncate border-b border-rule bg-paper py-2 font-sans text-body font-semibold" data-testid={TESTID.zoomPinnedTitle}>
              <NodeTitle title={props.zoomed.shows.node.title} from={props.zoomed.shows.file} links={false} />
            </p>
          </div>
          <header class={`relative md:sticky md:top-[var(--height-chrome)] ${LAYER.page} bg-paper pb-2`}>
            <Breadcrumbs file={props.zoomed.shows.file} trail={props.zoomed.trail} />
          <div class="group/row mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1
              class={`min-w-0 grow basis-full sm:basis-0 ${PAGE_TITLE} ${toneOf(props.zoomed.status)}`}
              data-testid={TESTID.zoomTitle}
              data-node-id={props.zoomed.shows.node.id}
              data-status={props.zoomed.status}
            >
              <NodeTitle
                title={props.zoomed.shows.node.title}
                from={props.zoomed.shows.file}
              />
            </h1>
            <Show when={props.zoomed.progress}>
              {(progress) => <ProgressBadge progress={progress()} />}
            </Show>
            <PluginAsides node={props.zoomed.shows.node.id} />
            <Show when={props.zoomed.shows.node.date}>
              {(date) => (
                <DateBadge
                  says={date()}
                  overdue={isOverdue(props.zoomed.shows.node, today())}
                />
              )}
            </Show>
            <Show when={props.zoomed.shows.node.repeat}>
              {(repeat) => <RepeatBadge repeat={repeat()} />}
            </Show>
          </div>

          <PluginPageHead node={props.zoomed.shows.node.id} />
          </header>

          <Blocked blocked={props.zoomed.blocked} />
          <EdgeRefs
            node={props.zoomed.shows.node}
            relation="after"
            onRemove={(target) => edges.drop("after", target)}
          />

          <NodeBody
            shows={props.zoomed.shows}
            zoomed
            onUnsee={(target) => edges.drop("see", target)}
            onProp={(key, value, was) =>
              applying(
                { verb: "prop", id: props.zoomed.shows.node.id, key, value, was },
                undo.record,
              )}
          />

          <EdgeVerbs open={edges.open} openFor={edges.openFor()} />
          <edges.Panel />

          <Backlinks id={props.zoomed.shows.node.id} />

      <Show
        when={props.rows.length > 0 || narrowed.active()}
        fallback={
          <Show
            when={props.zoomed.children.length === 0}
            fallback={
              <p class="text-muted" data-testid={TESTID.emptyUnder}>
                {nothingUnder(props.zoomed)}
              </p>
            }
          >
            <StartLine
              at={{ kind: "under", id: props.zoomed.shows.node.id }}
              label="Nothing here yet. Write the first line."
            />
          </Show>
        }
      >
        <Tree rows={props.rows} />
      </Show>
      <PluginPageFoot node={props.zoomed.shows.node.id} />
        </div>
      </div>
    </Editable>
  )
}

const nothingUnder = (
  zoomed: Extract<Zoomed, { readonly kind: "node" }>,
): string =>
  zoomed.children.length > 0 && doneHiddenOn(zoomed.shows.file)
    ? "Everything here is finished, and finished items are hidden."
    : "Nothing here yet."

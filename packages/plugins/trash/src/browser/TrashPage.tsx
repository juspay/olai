import { TESTID as IDS_OUTLINES } from "olai-plugin-outlines/testids"
import { TESTID as IDS_TRASH } from "olai-plugin-trash/testids"
import { isMirror,type Row,settles,shownRecord } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createMemo,Match,Show,Switch } from "solid-js"

import type { TrashGroup } from "@olai/format"
import { Empty } from "@olai/web/client/Empty.tsx"
import { PAGE_TITLE } from "@olai/web/client/look.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { createSaying } from "@olai/web/client/saying.ts"
import { SHOWN_WITHOUT_HOVER } from "@olai/ui-primitives/touch.ts"

import { applying } from "./writes.ts"
import { useNarrowed } from "olai-plugin-outlines/filter"
import { CONTEXT_DIM,lighting,matchedAttr,unfiltered } from "olai-plugin-outlines/filter-values"
import { EmptyTrash } from "./EmptyTrash.tsx"
import { useTrashUndo as useUndo } from "./history.ts"
import { NodeTitle } from "./PageView.tsx"

export function TrashPage(props: {
  readonly files: ReadonlyArray<string>
  readonly groups: ReadonlyArray<TrashGroup>
  readonly records: number
}) {
  const narrowed = useNarrowed()

  return (
    <div data-testid={IDS_TRASH.trashPage}>
      <header class="mb-8">
        <h1 class={`${PAGE_TITLE} italic text-ink`}>Trash</h1>
        <p class="m-0 mt-1 text-body text-muted">
          What was put away, kept whole. Put a row back and it returns where it
          came from, everything under it included.
        </p>
        <EmptyTrash recordsInTrash={props.records} />
      </header>
      <Show
        when={props.groups.length > 0}
        fallback={
          <Show when={unfiltered(narrowed)}>
            <Empty testid={IDS_TRASH.trashEmpty} line="Trash is empty" detail="Deleted outlines and rows appear here." />
          </Show>
        }
      >
        <Key each={props.groups} by="file">
          {(group) => (
            <section data-testid={IDS_TRASH.trashGroup} data-file={group().file}>
              <Show when={props.files.length > 1}>
                <h2 class="mb-1 mt-4 text-body font-medium text-muted">
                  {group().file}
                </h2>
              </Show>
              <Rows rows={group().rows} />
            </section>
          )}
        </Key>
      </Show>
    </div>
  )
}

function Rows(props: {
  readonly rows: ReadonlyArray<Row>
}) {
  return (
    <ul class="m-0 list-none p-0">
      <Key each={props.rows} by="key">
        {(row) => <Branch row={row()} />}
      </Key>
    </ul>
  )
}

function Branch(props: {
  readonly row: Row
}) {
  const undo = useUndo()
  const narrowed = useNarrowed()
  const { said, say } = createSaying()

  const putBack = async () => {
    const answer = await applying(
      { verb: "untrash", id: props.row.at.node.id },
      undo.record,
    )
    say(answer)
  }

  const shownId = createMemo(() => shownRecord(props.row).node.id)

  return (
    <li
      data-testid={IDS_TRASH.trashRow}
      data-node-id={props.row.at.node.id}
      data-match={matchedAttr(narrowed, shownId())}
    >
      <div
        class={`group flex min-h-6 items-baseline gap-2 py-0.5 ${
          CONTEXT_DIM(narrowed, shownId())
        }`}
      >
        <span class="select-none text-muted" aria-hidden="true">
          {isMirror(props.row.at.node) ? "⇢" : "•"}
        </span>
        <span
          class="flex-1 text-ink"
          data-testid={IDS_OUTLINES.nodeTitle}
          classList={{
            "line-through opacity-60": props.row.status !== undefined &&
              settles(props.row.status),
          }}
        >
          <Title row={props.row} needles={lighting(narrowed, shownId())} />
        </span>
        <Show when={props.row.kind === "node" ? props.row : undefined}>
          {(row) => (
            <button
              type="button"
              class={`shrink-0 rounded-control border border-rule/60 bg-panel px-2 py-0.5 text-label text-muted opacity-0 transition-opacity hover:bg-rule/60 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 ${SHOWN_WITHOUT_HOVER}`}
              data-testid={IDS_TRASH.trashPutBack}
              aria-label={`put back “${row().shows.node.title}”`}
              onClick={() => void putBack()}
            >
              Put back
            </button>
          )}
        </Show>
      </div>
      <Show when={said()}>
        {(line) => (
          <SaidLine
            said={line()}
            class="m-0 mb-1 ml-6 text-body"
            testid={IDS_TRASH.trashSaid}
          />
        )}
      </Show>
      <Show when={props.row.children.length > 0}>
        <div class="ml-5">
          <Rows rows={props.row.children} />
        </div>
      </Show>
    </li>
  )
}

function Title(props: {
  readonly row: Row
  readonly needles?: ReadonlyArray<string>
}) {
  return (
    <Switch>
      <Match
        when={props.row.kind === "node" || props.row.kind === "mirror"
          ? props.row
          : undefined}
      >
        {(row) => (
          <NodeTitle
            title={row().shows.node.title}
            from={row().shows.file}
            needles={props.needles}
          />
        )}
      </Match>
      <Match when={props.row.kind === "dangling" ? props.row : undefined}>
        {(row) => (
          <span class="text-muted">
            a mirror of `{row().missing}`, which no node declares
          </span>
        )}
      </Match>
      <Match when={props.row.kind === "cycle" ? props.row : undefined}>
        {(row) => (
          <span class="text-muted">
            this mirror is inside the subtree it shows (`{row().through}`) — not
            expanded
          </span>
        )}
      </Match>
    </Switch>
  )
}

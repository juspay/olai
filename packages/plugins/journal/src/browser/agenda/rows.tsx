import { feltOn, type OwedReading, type OwedRow, owedMore } from "@olai/format"
import { Tip } from "@olai/web/client/Tip.tsx"
import { Key } from "@solid-primitives/keyed"
import { type Accessor, createMemo, Show } from "solid-js"

import { ENTRY_SHAPE, HEAD_ACTION, ROW_GAP } from "olai-plugin-layout/entry"
import { Link } from "olai-plugin-navigation/routing"
import { zoomNode } from "olai-plugin-navigation/routes"

import { TESTID } from "../../testids.ts"
import { agendaRoute } from "../routes.ts"
import { agendaRowsFolded, setAgendaRowsFolded } from "./fold.ts"
import { ROW_DOT } from "./owed.ts"

export const ROWS_ID = "journal-agenda-rows"

function Row(props: { readonly row: Accessor<OwedRow>; readonly today: string }) {
  const felt = createMemo(() => feltOn(props.row().date, props.today))
  const late = () => felt().standing === "late"
  return (
    <li
      data-testid={TESTID.agendaRow}
      data-node-id={props.row().id}
      data-file={props.row().file}
      data-when={felt().standing}
      data-date={props.row().date}
    >
      <Link
        route={zoomNode(props.row().id)}
        class={`${ENTRY_SHAPE} ${ROW_GAP}`}
        tip={props.row().title}
        label={props.row().title}
      >
        <span
          class={`size-1.5 shrink-0 rounded-full ${late() ? ROW_DOT.overdue : ROW_DOT.today}`}
          data-mark={late() ? "filled" : "ring"}
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1 truncate">{props.row().title}</span>
        <Show when={late() ? felt().distance : undefined}>
          {(distance) => <span class="shrink-0 text-label text-alarm">{distance()}</span>}
        </Show>
      </Link>
    </li>
  )
}

export function AgendaRows(props: {
  readonly reading: OwedReading
  readonly today: string
}) {
  const anyLate = createMemo(() =>
    props.reading.rows.some((row) => feltOn(row.date, props.today).standing === "late")
  )
  const more = createMemo(() => owedMore(props.reading))
  return (
    <div
      id={ROWS_ID}
      class={`ml-3 border-l pl-2 ${anyLate() ? "border-alarm/40" : "border-muted/40"}`}
      data-testid={TESTID.agendaRows}
    >
      <ul class="m-0 list-none p-0">
        <Key each={props.reading.rows} by={(row) => row.id}>
          {(row) => <Row row={row} today={props.today} />}
        </Key>
      </ul>
      <Show when={more() > 0}>
        <Link
          route={agendaRoute}
          testid={TESTID.agendaMore}
          class="block px-2 py-1 text-caption text-muted no-underline hover:text-ink"
        >
          {more()} more on the agenda
        </Link>
      </Show>
    </div>
  )
}

export function AgendaFold() {
  const folded = agendaRowsFolded
  const said = () => (folded() ? "Show what is owed" : "Hide what is owed")
  return (
    <Tip text={said()}>
      <button
        type="button"
        class={HEAD_ACTION}
        data-testid={TESTID.agendaFold}
        aria-expanded={!folded()}
        aria-controls={ROWS_ID}
        aria-label={said()}
        onClick={(event) => {
          event.stopPropagation()
          setAgendaRowsFolded(!folded())
        }}
      >
        <svg
          viewBox="0 0 16 16"
          class="size-3.5 transition-transform duration-100"
          classList={{ "rotate-90": !folded() }}
          aria-hidden="true"
          fill="currentColor"
        >
          <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 1 1-1.06-1.06L9.44 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
        </svg>
      </button>
    </Tip>
  )
}

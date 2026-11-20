import { For, Show } from "solid-js"

import { type CiRun, identityOf, liveOf, type RunCell } from "olai-plugin-odu/appliance/wire"

import type { BlockContext, OduClocks } from "./app.ts"
import { useClocks } from "./clocks.tsx"
import { TESTID } from "../testids.ts"
import { inkOf } from "./hue.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { useRuns } from "./runs.tsx"

const spanOf = (cell: RunCell, now: number, clocks: OduClocks): string => {
  if (cell.ms !== null) return clocks.wordsOf(cell.ms / 1000)
  if (cell.status === "running" && cell.startedAt !== null) {
    return clocks.tickingOf(now - cell.startedAt)
  }
  return "—"
}

const spanTitle = (cell: RunCell, clocks: OduClocks): string | undefined =>
  cell.ms === null ? undefined : `Took ${clocks.exactOf(cell.ms / 1000)}`

export function RunMatrix(context: BlockContext) {
  const runs = useRuns()
  const run = () => runs.runOf(context.entry.value)
  return (
    <Show when={run()}>
      {(held) => <Matrix run={held()} />}
    </Show>
  )
}

function Matrix(props: { readonly run: CiRun }) {
  const clocks = useClocks()
  const now = clocks.createTicking(clocks.SECOND)
  const head = () => {
    const which = identityOf(props.run)
    return liveOf(props.run.state) ? which : `${which} · ${props.run.state}`
  }
  return (
    <div
      class="mb-1 overflow-x-auto rounded-control border border-rule bg-panel px-2 py-1 font-mono text-label"
      data-testid={TESTID.ciMatrix}
      data-run={props.run.id}
      data-live={liveOf(props.run.state) ? "yes" : "no"}
    >
      <p class="text-muted">
        {head()}
        <Show when={props.run.lanes.length > 0}>
          {" · "}
          {props.run.lanes.join(" ")}
        </Show>
      </p>
      <Show
        when={props.run.cells.length > 0}
        fallback={<p class="text-muted">no nodes yet — {props.run.phase}</p>}
      >
        <For each={props.run.cells}>
          {(cell) => (
            <div
              class="flex items-baseline gap-2 whitespace-nowrap"
              data-testid={TESTID.ciCell}
              data-node={cell.id}
              data-status={cell.status}
            >
              <span class={`w-3 shrink-0 ${inkOf(cell.hue)}`}>{cell.glyph}</span>
              <span class="min-w-0 grow truncate">
                {cell.name}
                {cell.attempt > 1 ? ` #${cell.attempt}` : ""}
              </span>
              <span class="shrink-0 text-muted">{cell.platform}</span>
              <span class={`shrink-0 ${inkOf(cell.hue)}`}>{cell.status}</span>
              <Tip text={spanTitle(cell, clocks) ?? ""} disabled={spanTitle(cell, clocks) === undefined}>
                <span class={`shrink-0 tabular-nums ${inkOf(cell.hue)}`}>
                  {spanOf(cell, now(), clocks)}
                </span>
                <Show when={spanTitle(cell, clocks)}>{(exact) => <span class="sr-only">{exact()}</span>}</Show>
              </Tip>
            </div>
          )}
        </For>
      </Show>
    </div>
  )
}

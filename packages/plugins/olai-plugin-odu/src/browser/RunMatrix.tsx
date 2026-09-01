/**
 * THE RUN MATRIX — `odu attach`'s view, drawn by olai.
 *
 * What the chip's press opens: every node of the run in the run's OWN
 * scheduling order, with its glyph, its status word, which lane ran it, and
 * how long it took or has been taking. The pane hangs under the property run
 * rather than inside the chip, for the reason `@olai/web`'s live seam gives — a
 * chip is an inline box in a wrapping line and a matrix is a grid.
 *
 * ## Why olai draws it rather than borrowing one
 *
 * The terminal door does the opposite: it renders kolu's own Dock row, because
 * kolu SHIPS one and a second visual vocabulary for one fleet is two surfaces
 * free to disagree. odu ships no such component — its matrix is an `@opentui`
 * grid for a terminal, which is not a thing a browser can mount — so this is
 * olai's drawing, and what it must not do instead is invent a second
 * VOCABULARY. It does not: the status word, the glyph, the hue and the redness
 * are odu's own `STATUS_META`, folded once where the thin client is
 * (`@olai/odu-client`'s `project.ts`) and carried per node, so what this file
 * decides is only which ink a hue takes on a page (`./hue.ts`).
 *
 * ## What a cell does NOT do
 *
 * PRESS. There is nothing behind a node in this phase: the log is a member
 * this build deliberately does not carry (`@olai/odu-client`'s `project.ts`
 * says why, and what shape it takes the day somebody wants it), and rerun and
 * cancel are WRITES — phase 4's, where they arrive as procedures with an
 * argument rather than as verbs smuggled onto a readout. So the matrix is a
 * readout, whole, and nothing in it is a button.
 */

import { For, Show } from "solid-js"

import { type CiRun, identityOf, type RunCell } from "@olai/odu-client/wire"

import type { BlockContext, OduClocks } from "./app.ts"
import { useClocks } from "./clocks.tsx"
import { TESTID } from "../testids.ts"
import { inkOf } from "./hue.ts"
import { useRuns } from "./runs.tsx"

/** How long this node ran, in the app's own register: the settled span in
 *  words, the running one ticking, and a dash for a node that has not begun.
 *  BOTH SPELLINGS ARE THE APP'S, handed across (`./app.ts`), so a duration in
 *  this matrix and a duration beside a title are one vocabulary rather than two
 *  that agree today. */
const spanOf = (cell: RunCell, now: number, clocks: OduClocks): string => {
  if (cell.ms !== null) return clocks.wordsOf(cell.ms / 1000)
  if (cell.status === "running" && cell.startedAt !== null) {
    return clocks.tickingOf(now - cell.startedAt)
  }
  return "—"
}

/** ...and the exact figure on the hover, where there is one to be exact about. */
const spanTitle = (cell: RunCell, clocks: OduClocks): string | undefined =>
  cell.ms === null ? undefined : `took ${clocks.exactOf(cell.ms / 1000)}`

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
  // ONE CLOCK for the whole pane rather than one per row: a matrix of twenty
  // nodes has at most a couple running, and a signal per row would be twenty
  // timers for two moving digits.
  //
  // BY THE SECOND and ungated, which a chip could not afford and a pane can:
  // this component exists only while somebody has it open (the drawer mounts
  // it on a press and drops it on the next), so the timer's whole lifetime is
  // a person looking at it — the same economy the live terminal pane keeps one
  // seam over. `createTicking` disposes with the component, which is what
  // makes that a fact rather than a habit.
  const now = clocks.createTicking(clocks.SECOND)
  const head = () => {
    const which = identityOf(props.run)
    return props.run.live ? which : `${which} · the socket is gone`
  }
  return (
    <div
      class="mb-1 overflow-x-auto rounded border border-rule bg-panel px-2 py-1 font-mono text-xs"
      data-testid={TESTID.ciMatrix}
      data-worktree={props.run.id}
      data-live={props.run.live ? "yes" : "no"}
    >
      {/* THE RUN'S OWN IDENTITY FIRST, because a verdict that does not say
          which run it describes is the ambiguity odu's `<sha7>#<seq>` spelling
          was introduced to end. The lane roster beside it is the run's
          environment — `platform=host`, or the pool a lease is still claiming
          from — folded upstream so olai never restates odu's union. */}
      <p class="text-muted">
        {head()}
        <Show when={props.run.lanes.length > 0}>
          {" · "}
          {props.run.lanes.join(" ")}
        </Show>
      </p>
      {/* A RUN WITH NO NODES IS A SENTENCE, not an empty grid: a run that is
          still claiming a machine has published a roster and nothing else, and
          drawing a header over nothing would read as a run whose pipeline came
          back empty. odu's own phase word, verbatim. */}
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
              {/* The glyph and the status word are odu's, side by side and
                  neither derived from the other: the glyph is what the TUI
                  draws and the word is what the wire says, so a status this
                  build has never heard of still prints its own name. */}
              <span class={`w-3 shrink-0 ${inkOf(cell.hue)}`}>{cell.glyph}</span>
              <span class="min-w-0 grow truncate">{cell.name}</span>
              <span class="shrink-0 text-muted">{cell.platform}</span>
              <span class={`shrink-0 ${inkOf(cell.hue)}`}>{cell.status}</span>
              <span
                class={`shrink-0 tabular-nums ${inkOf(cell.hue)}`}
                title={spanTitle(cell, clocks)}
              >
                {spanOf(cell, now(), clocks)}
              </span>
            </div>
          )}
        </For>
      </Show>
    </div>
  )
}

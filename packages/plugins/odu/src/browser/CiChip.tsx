/**
 * THE CI CHIP — a `worktree` property's living face, drawn beside the path it
 * is about.
 *
 * The live-properties seam's SECOND tenant (`@olai/web`'s live seam), and
 * deliberately the quieter shape of the two. The terminal door takes a row,
 * because a terminal somebody named is worth one; a `worktree` is a path on a
 * row and is worth exactly nothing until something is happening in it —
 * so this draws NOTHING most of the time and one chip when there is a run,
 * and the line a reader sees is otherwise the line they have always seen.
 *
 * ## It ticks, and the tick is THE APP'S, handed across
 *
 * The running node's start instant crosses the wire once with the row and the
 * clock is the reader's own — the app's two-speed seam, the same one the
 * pomodoro pill and the header's uptime chip wear. No polling, and no duration
 * the server would have to keep re-sending: a figure computed at the write is
 * stale the moment it is encoded, and this is the third readout in olai to take
 * that lesson.
 *
 * The clock and the register it speaks arrive as FURNITURE (`./app.ts`, read
 * through `./clocks.tsx`) rather than being written here, and that is the same
 * rule the run's own fact line follows: a plugin that spelled its own duration
 * ladder would be a second vocabulary on a page whose whole point is that a
 * ticking number looks the same wherever it appears — free to drift the day the
 * app changed its, with the app's own suite green because the face it broke is
 * in another package.
 *
 * ONE CLOCK PER OPEN CHIP, and only while something is running. A settled
 * verdict never moves, so a settled chip keeps no clock at all — and a page of
 * twelve such rows with one live run has one ticking chip on it.
 *
 * ## Pressing it opens the matrix
 *
 * ...but the pane is drawn by the DRAWER, under the run (the seam's
 * `Pane`), because a chip is an inline box in a wrapping line and cannot carry
 * a grid. What this component owns is the button; what is open is one answer
 * per run, held where the editor's own "which chip is open" is held, so
 * pressing a second chip closes the first.
 *
 * WHICH MAKES THIS CHIP THE PANE'S ONLY CLOSER, and that is a promise it has
 * to keep without a press. A row can go while the matrix is open — the node
 * loses the property, the vault drops it, the server restarts — and the
 * drawer cannot see it: what `paned` names is a KEY, and nothing tells the
 * drawer that the face behind that key has stopped drawing. So the face says
 * so ({@link closeWithTheRow}). Without it the matrix would sit there with
 * nothing to shut it, and the next run in that checkout would open itself.
 */

import { createEffect, Show } from "solid-js"

import type { CiRun } from "olai-plugin-odu/appliance/wire"

import { TESTID } from "../testids.ts"
import { useClocks } from "./clocks.tsx"
import type { ChipContext } from "./app.ts"
import { useRuns } from "./runs.tsx"
import { runningIn, type CiTone, wordsFor } from "./words.ts"

/** The chip's box — the run's own chip geometry, in the mono face a figure
 *  that moves needs (`tabular-nums` keeps a ticking `m:ss` from shimmying). */
const CHIP =
  "inline-flex min-w-0 max-w-full shrink-0 items-baseline gap-1 rounded-full border px-2 py-px font-mono text-xs tabular-nums"

/** The four inks, by what the run is doing rather than by odu's own hues —
 *  a per-NODE hue is `./hue.ts`'s and belongs to the matrix, where there are
 *  nodes to colour. `going` is the app's accent for `TookChip`'s reason: work
 *  in flight is the one thing on a page worth finding at a glance. */
const TONE: Record<CiTone, string> = {
  going: "border-accent/30 bg-accent/10 text-accent",
  ok: "border-rule bg-panel text-done",
  red: "border-alarm/40 bg-alarm/10 text-alarm",
  quiet: "border-rule bg-desk text-muted",
}

export function CiChip(context: ChipContext) {
  const runs = useRuns()
  /** The run for THIS property's value — a lookup by the board's own word,
   *  never a resolution: the server keyed the row by the value it read
   *  precisely so a browser never has to know where a worktree is. */
  const run = () => runs.runOf(context.entry.value)
  /**
   * THE TICK, armed off the running node's start and disarmed by everything
   * else — a settled run's words never move, so a settled chip keeps no clock.
   *
   * The instant goes in AS IT ARRIVED. odu stamps in milliseconds and the
   * app's other three readouts carry ISO text, and `instantOf` is where the
   * two stop being two questions (the app's own `instantOf`, behind
   * `createNow`); this used to spell the
   * number into a string so that parse could turn it back, which is a value
   * laundered through text on every read to satisfy a signature.
   */
  const started = (): number | null => {
    const held = run()
    if (held === undefined || !held.live) return null
    return runningIn(held)?.startedAt ?? null
  }
  const clocks = useClocks()
  const now = clocks.createNow(started)
  closeWithTheRow(run, context)
  return (
    <Show when={run()}>
      {(held) => {
        // ONE GATE, and it is the row. `wordsFor` always has something to say
        // about a run this server watched (`./words.ts` argues why it stopped
        // declining); "nothing to draw" is a checkout with no reading at all,
        // which is the ordinary state and is this `Show`.
        const said = () => wordsFor(held(), now(), clocks.tickingOf)
        return (
        <Show
          when={context.onToggle}
          fallback={
            <span
              class={`${CHIP} ${TONE[said().tone]}`}
              data-testid={TESTID.ciChip}
              data-state={said().tone}
              data-worktree={context.entry.value}
              title={said().title}
            >
              {said().text}
            </span>
          }
        >
          {(toggle) => (
            <button
              type="button"
              class={`${CHIP} ${TONE[said().tone]} cursor-pointer`}
              data-testid={TESTID.ciChip}
              data-state={said().tone}
              data-worktree={context.entry.value}
              data-open={context.opened ? "yes" : "no"}
              title={`${said().title} — press for the run matrix`}
              onClick={(event) => {
                // The row beneath answers a click by opening; this one is a
                // door of its own and the run's line must not also move.
                event.stopPropagation()
                toggle()()
              }}
            >
              {said().text}
            </button>
          )}
        </Show>
        )
      }}
    </Show>
  )
}

/**
 * SHUT THE MATRIX WHEN THE ROW IT IS ABOUT GOES.
 *
 * The pane outlives nothing else: it is mounted by the drawer while `paned`
 * names this key, and the only press that clears `paned` is this chip's. So a
 * row disappearing — which happens without anybody touching the page — has to
 * reach the drawer through the one thing that can see both, which is here.
 *
 * An EFFECT rather than a guard inside the drawer, because the drawer holds a
 * key and this holds the answer. It fires on the crossing alone: `opened` is
 * false the rest of the time, so a page of twelve rows with nothing open runs
 * this and stops.
 */
const closeWithTheRow = (
  run: () => CiRun | undefined,
  context: ChipContext,
): void => {
  createEffect(() => {
    if (run() === undefined && context.opened) context.onToggle?.()
  })
}

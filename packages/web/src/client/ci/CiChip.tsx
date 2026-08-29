/**
 * THE CI CHIP — a `worktree` property's living face, drawn beside the path it
 * is about.
 *
 * The live-properties seam's SECOND tenant (`../props/live.ts`), and
 * deliberately the quieter shape of the two. The terminal door takes a row,
 * because a terminal somebody named is worth one; a `worktree` is a path on a
 * lane row and is worth exactly nothing until something is happening in it —
 * so this draws NOTHING most of the time and one chip when there is a run,
 * and the line a reader sees is otherwise the line they have always seen.
 *
 * ## It ticks, and the tick is local
 *
 * The running node's start instant crosses the wire once with the row and the
 * clock is the reader's own — `../took.ts`'s two-speed seam, the same one the
 * pomodoro pill and the header's uptime chip wear. No polling, and no duration
 * the server would have to keep re-sending: a figure computed at the write is
 * stale the moment it is encoded, which is the lesson `TookChip` states one
 * directory up and this is the third readout to take it.
 *
 * ONE CLOCK PER OPEN CHIP, and only while something is running. A settled
 * verdict never moves, so a settled chip keeps no clock at all — and a page of
 * twelve lanes with one live run has one ticking chip on it.
 *
 * ## Pressing it opens the matrix
 *
 * ...but the pane is drawn by the DRAWER, under the run (`../props/live.ts`'s
 * `Pane`), because a chip is an inline box in a wrapping line and cannot carry
 * a grid. What this component owns is the button; what is open is one answer
 * per run, held where the editor's own "which chip is open" is held, so
 * pressing a second chip closes the first.
 */

import { Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { createNow } from "../took.ts"
import type { ChipContext } from "../props/live.ts"
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
   * else. `createNow` takes the instant as ISO text (three other readouts hand
   * it one straight off the wire), so the wire's `Date.now()` number is spelled
   * into one here rather than a second clock being written for the one member
   * that carries a number — the seam is the argument, not the encoding.
   */
  const started = (): string | undefined => {
    const held = run()
    if (held === undefined || !held.live) return undefined
    const at = runningIn(held)?.startedAt
    return at === null || at === undefined ? undefined : new Date(at).toISOString()
  }
  const now = createNow(started)
  const words = () => {
    const held = run()
    return held === undefined ? undefined : wordsFor(held, now())
  }
  return (
    <Show when={words()}>
      {(said) => (
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
      )}
    </Show>
  )
}

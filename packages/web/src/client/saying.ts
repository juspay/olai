/**
 * A SAID-LINE's lifetime: the sentence a surface is currently showing, and the
 * six seconds after which it takes itself away.
 *
 * The thing that varies here — and the only thing — is HOW LONG a remark
 * lingers and what clears it. `SAID_MS` was already pulled out beside the
 * `Said` type for exactly that reason ("the `•••` menu's dwell and the trash's
 * were equal only by hand-maintenance"), and the constant turned out to be
 * half the job: the two surfaces still spelled the machinery around it
 * separately, and had already drifted into two shapes for the same three
 * rules. This is the other half.
 *
 * THE THREE RULES, in one place:
 *
 *   - a new sentence REPLACES the one before it, timer and all — otherwise the
 *     previous remark's countdown takes the new one away early;
 *   - saying NOTHING clears the line and arms no timer, so a verb with nothing
 *     to report leaves no empty box behind;
 *   - the timer dies with the owner, because a surface that has gone cannot be
 *     written to and a pending write to it is a leak.
 *
 * What it is NOT is the running of anything. A verb that has to be attempted,
 * may throw, and needs its failure worded is the caller's own business —
 * `menu/picking.ts` is one such caller, and the Trash's `Put back` is the
 * other and needs no such thing (its write answers with a `Said` rather than
 * throwing). One receptacle for the line, no opinion about what filled it.
 *
 * Call it in the owner whose lifetime the LINE has — the row rather than the
 * panel, where those differ.
 */

import { type Accessor, createSignal, onCleanup } from "solid-js"

import { type Said, SAID_MS } from "./edit/undoing.ts"

export interface Saying {
  /** What is on screen right now, or `null`. */
  readonly said: Accessor<Said | null>
  /** Show it for {@link SAID_MS}. Nothing clears the line instead — which is
   *  why callers hand this an answer straight through rather than asking
   *  first whether there was one. `void` is in the type for that reason and
   *  not by accident: what a verb answers with is `Said | void` (a write with
   *  nothing to add, an action that only navigated), and making the caller
   *  translate that would be the branch this exists to delete. */
  readonly say: (message: Said | null | void) => void
}

export const createSaying = (): Saying => {
  const [said, setSaid] = createSignal<Said | null>(null)
  let clearing: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(clearing))

  return {
    said,
    say: (message) => {
      clearTimeout(clearing)
      const next = message ?? null
      setSaid(next)
      if (next !== null) clearing = setTimeout(() => setSaid(null), SAID_MS)
    },
  }
}

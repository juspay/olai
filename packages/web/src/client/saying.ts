/**
 * WHAT THIS CLIENT SAYS: the two moods it says anything in, how long a line
 * lingers, and the receptacle that holds one.
 *
 * The MOODS are the whole of {@link Said}, and every surface that answers a
 * person reaches for them — the `•••` menu, the trash's `Put back`, the
 * pickers, the panels, the palette, ⌘Z. They were declared inside
 * `./edit/undoing.ts` because undo was the first to need them, which made a
 * type half the client mints an import out of one feature's module; they are
 * here, at the top level, for `./refusals.tsx`'s reason — none of the readers
 * owns it. Drawn, they are `./SaidLine.tsx`, and the two are deliberately not
 * one file: half the client MINTS a `Said` without ever drawing one (a verb
 * answers with a sentence and hands it to whichever line is open), and a
 * module with JSX in it cannot be imported by a unit test in this repo — the
 * constraint `./edit/undoing.ts`'s own header already documents.
 *
 * The rest is the LIFETIME, and the thing that varies about it — and the only
 * thing — is HOW LONG a remark lingers and what clears it. `SAID_MS` was
 * pulled out beside the type for exactly that reason ("the `•••` menu's dwell
 * and the trash's were equal only by hand-maintenance"), and the constant
 * turned out to be half the job: the two surfaces still spelled the machinery
 * around it separately, and had already drifted into two shapes for the same
 * three rules. This is the other half.
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

import type { OpFailure } from "@olai/format"
import { type Accessor, createSignal, onCleanup } from "solid-js"

/** The two moods anything this client says is in: `alarm` for a refusal, which
 *  is why nothing happened, and `aside` for a remark about something that did.
 *  What each mood MEANS — the colour it is drawn in, and whether a screen
 *  reader is interrupted to deliver it — is {@link ./SaidLine.tsx}'s. */
export interface Said {
  readonly tone: "alarm" | "aside"
  readonly text: string
  /** WHICH RULE said it, where the sentence came from the ops layer and the
   *  minter still had the failure in hand — drawn as `data-kind`, so a
   *  scenario can name the rule rather than matching its wording.
   *
   *  BESIDE the mood rather than a prop of its own at the line: both are facts
   *  in the markup about one sentence, and a caller that had to hand one over
   *  through the value and the other around it is a caller that can pass a
   *  kind belonging to some other refusal. Optional because most sentences
   *  have no tag to give — a refused QUERY is a token and a reason
   *  (`@olai/format`'s `Refusal`), and a remark is nobody's failure. */
  readonly kind?: OpFailure["_tag"]
}

/** How long a surface's said-line stays before clearing itself. ONE number,
 *  beside the type every such line renders: the `•••` menu's dwell and the
 *  trash's were equal only by hand-maintenance while each spelled its own. */
export const SAID_MS = 6_000

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

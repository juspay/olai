/**
 * Auto-commit: the timer that watches a flurry finish, and the stop.
 *
 * The rules are `./flurry.ts`; this is the plumbing over them, and it is ONE
 * effect over the ecosystem's own debounce (`@solid-primitives/scheduled`,
 * which `fold/refiling.ts` and the two search boxes already ride — HACKING.md's
 * SolidJS rule, and it owns the timeout, the restart and the teardown so this
 * file owns none of them). Everything the effect reads is a signal, so the
 * window is re-armed by the arrival of an edit rather than by a poll — and
 * cleared by the same reading the moment there is nothing to record, which is
 * what a commit landing looks like from here.
 *
 * ONE GATE: the effect arms the window exactly when {@link mayRecord} says yes
 * and clears it otherwise, so "is there a flurry" and "may it be recorded" are
 * one question asked in one place rather than a condition here and a count
 * there.
 *
 * **It drives the SAME committer the button drives.** `commit.commit("")` is
 * the panel's own verb with no message and no selection: no message so the
 * server composes the same summary the panel would have suggested, and no
 * selection so it is a full sweep — which is the one that clears the per-writer
 * counters, and the only honest reading of "everything that was waiting". One
 * committer, a new trigger; nothing here knows how a commit is made.
 *
 * **With Auto-push on, the push comes free.** A recorded commit is followed by
 * the same `send` whichever door asked for it (`./record.ts`, inside
 * `./state.ts`), so this file says nothing about pushing except when a failed
 * one stops it. Auto-commit alone records and the commits accumulate unpushed,
 * which the pill's `· N unpushed` says out loud.
 *
 * **The stop is a fact about this browser and it is deliberate.** Any commit or
 * push that git REFUSED pauses the loop — including one somebody pressed by
 * hand, because the promise Auto-commit makes is that changes reach git without
 * being watched, and the moment a verb fails in this browser that promise is
 * broken. A timer going round again in the background after that is precisely
 * the "retrying blindly" the ruling forbids. ONE gesture resumes it: turn
 * Auto-commit off and on again, which is a person saying they have dealt with
 * whatever git said. Nothing clears it on olai's own initiative — a loop that
 * un-paused itself would be the retry wearing a different hat.
 */

import { debounce } from "@solid-primitives/scheduled"
import { type Accessor, createEffect, createMemo, createSignal, untrack } from "solid-js"

import { flurryOf, mayRecord, QUIET_MS, type Standing, stoppedBy, stoppedByPush } from "./flurry.ts"
import type { Commit } from "./state.ts"

/**
 * What the loop is doing, as ONE value.
 *
 * Not "armed, and separately a reason it stopped": those are a product of two
 * fields whose valid combinations are a rule rather than a shape — off AND
 * paused is a state nothing may be in, and the machinery that kept it from
 * arising would be exactly the reconciliation that says the two were one thing
 * all along. A loop nobody armed HAS no reason; a stopped one always has one,
 * and here it cannot be missing.
 *
 * The tags are the words the chrome draws (`data-auto`), for the reason
 * `./said.ts`' {@link Face} is spelled in lower case: this value is not on the
 * wire, and a second table turning `"Paused"` into `"paused"` would be a table
 * to keep true.
 */
export type Auto =
  | { readonly _tag: "off" }
  | { readonly _tag: "armed" }
  | { readonly _tag: "paused"; readonly said: string }

/** A loop nobody armed, spelled once. */
const OFF: Auto = { _tag: "off" }
const ARMED: Auto = { _tag: "armed" }

export const createAuto = (input: {
  /** The preference (`../settings/autocommit.ts`), handed in as an accessor so
   *  this file does not import it — the same shape `createCommit` takes
   *  Auto-push in, and what lets the rules be asked with any answer. */
  readonly on: Accessor<boolean>
  /** Whether this is the tab of this browser that records (`./elected.ts`). */
  readonly alone: Accessor<boolean>
  readonly commit: Commit
  /** The quiet window, for a test that cannot wait fifteen seconds. The SPAN is
   *  a product decision and lives with the rules. */
  readonly quiet?: number
}): Accessor<Auto> => {
  const [paused, setPaused] = createSignal<string | null>(null)
  const quiet = input.quiet ?? QUIET_MS

  /**
   * What is waiting, as one word.
   *
   * MEMOISED, and that is the debounce's correctness rather than a saving: the
   * pending value is republished when a commit lands and when a push does, and
   * neither is an edit. A window re-armed on those would be a window that moved
   * for reasons nobody typed.
   */
  const flurry = createMemo(() => flurryOf(input.commit.pending()))

  const standing = (): Standing => ({
    armed: input.on(),
    paused: paused(),
    alone: input.alone(),
    heard: input.commit.heard(),
    flurry: flurry(),
    repo: input.commit.pending().repo,
    git: input.commit.git(),
    working: input.commit.working(),
    pushing: input.commit.pushing(),
  })

  /**
   * The window itself, which this file does not own the timer of.
   *
   * Asked AGAIN at the moment it fires, untracked: a timer and a frame can land
   * in the same tick, and the answer that matters is the one at the instant the
   * commit would be made. `commit("")` is the panel's own verb with no message
   * and no selection — see this file's header.
   */
  const record = debounce(() => {
    if (untrack(() => mayRecord(standing()))) input.commit.commit("")
  }, quiet)

  // ONE effect, and it is the whole trigger: every read in it is a reason to
  // start the window again, and the window is started nowhere else.
  createEffect(() => {
    if (mayRecord(standing())) record()
    else record.clear()
  })

  /**
   * What a finished attempt did to the loop.
   *
   * `untrack` on the preference so this reads what the loop's state IS rather
   * than subscribing to it: taking `on()` as a dependency would re-run the
   * whole judgement when somebody turned Auto-commit back on, and re-pause it
   * on the attempt that stopped it in the first place.
   */
  const judge = (said: string | null): void => {
    if (said !== null && untrack(input.on)) setPaused(said)
  }
  createEffect(() => judge(stoppedBy(input.commit.attempt())))
  createEffect(() => judge(stoppedByPush(input.commit.pushed())))

  // Turning it OFF forgets the reason, which is the whole of "off and on again
  // resumes it" — see this file's header for why nothing else clears it. It is
  // not what hides the pause from a reader (the value below does that, and
  // cannot be read any other way); it is what makes the NEXT arming clean.
  createEffect(() => {
    if (!input.on()) setPaused(null)
  })

  return () => {
    if (!input.on()) return OFF
    const said = paused()
    return said === null ? ARMED : { _tag: "paused", said }
  }
}

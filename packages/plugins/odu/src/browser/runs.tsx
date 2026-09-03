/**
 * THE CI RUNS, as this tab holds them — ONE subscription, however many chips.
 *
 * `olai-plugin-kolu`'s `appliance/props/fleet.tsx` one appliance over, and the economy is the
 * same: an outline can carry a `worktree` property on a dozen rows, and every
 * one of them wants to know whether its checkout is mid-run. That costs one
 * subscription per TAB and one probe per SERVER — so a chip must not
 * subscribe, and this context is what it reads instead. It is `@olai/web`'s `served.tsx`'s
 * arrangement exactly: subscribe once at the shell, hand every leaf an
 * accessor over the answer.
 *
 * ## Why this one is SMALLER than the fleet's, and deliberately
 *
 * The fleet is a collection with deltas, folded into a map that is MUTATED so
 * a busy machine's thirty terminals do not cost a copy per frame. This is one
 * CELL carrying an array, because the population is different in kind: live CI
 * runs are bounded by the worktrees a vault names at once, which is a
 * handful, and the cell's `equals` (`@olai/odu-client`'s `sameCi`) already
 * swallows every frame that moved nothing. A `Map` rebuilt per frame over five
 * entries, a few times a minute, is not a cost worth a mutation protocol —
 * and the arrayKey on the member is what keeps a repeated frame from being a
 * frame at all (juspay/kolu#2190).
 *
 * ## A missing run is not a missing anything
 *
 * `runOf` answers `undefined` for a worktree with no run, and every face here
 * draws nothing for it. That is the ORDINARY answer — a checkout with no live
 * run is the steady state of every checkout on the machine — so there is no
 * hollow state, no "looked where?" line and no amber: those belong to padi,
 * whose socket is a daemon's and whose absence IS news. This one's absence is
 * the weather.
 */

import { type Accessor, createContext, createMemo, type JSX, useContext } from "solid-js"

import { type CiRun, type CiRuns, NO_RUNS } from "olai-plugin-odu/appliance/wire"

/** What a chip asks: the run for this worktree value, or `undefined`. */
export interface Runs {
  /** By the board's OWN value — the `worktree` property verbatim, which is
   *  what the server keyed the row by precisely so a browser never has to
   *  resolve a path (`@olai/odu-client`'s `wire`). */
  readonly runOf: (worktree: string) => CiRun | undefined
}

const RunsContext = createContext<Runs>()

/** The context's answer where nothing mounted one — a page with no CI half at
 *  all, which is every unit test and every face that is not the app. Minted
 *  once, and it is the same answer a server with nothing running gives. */
const NO_CI: Runs = { runOf: () => undefined }

export const useRuns = (): Runs => useContext(RunsContext) ?? NO_CI

/**
 * Mount the tab's CI half over the page.
 *
 * The cell arrives as `undefined` until the first frame lands, which is the
 * same wire truth every other member has and is answered the same way: the
 * seed reading, in which nothing is running. A chip that distinguished "not
 * arrived" from "nothing running" would be drawing a loading state for a
 * fact whose honest default is silence.
 */
export function RunsProvider(props: {
  readonly runs: Accessor<CiRuns | undefined>
  readonly children: JSX.Element
}): JSX.Element {
  /** ONE memo per tab over the whole reading, so a page of twelve such rows does
   *  twelve map READS per frame rather than twelve walks of the array. The
   *  memo re-runs only when the cell publishes, which the member's `equals`
   *  has already narrowed to frames that moved something. */
  const byWorktree = createMemo(() => {
    const held = new Map<string, CiRun>()
    for (const run of (props.runs() ?? NO_RUNS).runs) held.set(run.id, run)
    return held
  })
  return (
    <RunsContext.Provider
      value={{ runOf: (worktree) => byWorktree().get(worktree) }}
    >
      {props.children}
    </RunsContext.Provider>
  )
}

/**
 * WHICH PLUGINS THIS SERVE IS RUNNING, as the browser learns it — and the TWO
 * licences that come off one roster, because drawing and SUBSCRIBING are not
 * the same risk.
 *
 * A tab REGISTERS what the build has, because import time is all it has
 * (`../live/dressings.ts`). Whether a registered half may actually run is a
 * different question with a different answer at a different moment: it is a
 * fact about the SERVE, and it arrives on the `plugins` cell the same way the
 * git policy's pin does.
 *
 * ## Two readers, and the difference between them is what a wrong guess COSTS
 *
 * {@link createRunning} is the DRAW licence and it is generous before the
 * roster lands: it answers TRUE for every plugin, which is the built-in default
 * and therefore what nearly every serve is. Drawing a face for one frame and
 * taking it away is a flicker; NOT drawing it and putting it back is the same
 * flicker on every ordinary page. A tab that guesses the common case and is
 * corrected within a frame is right nearly always and briefly generous
 * otherwise; one that guesses the rare case is wrong nearly always.
 *
 * {@link createComposed} is the SUBSCRIBE licence and it is the opposite:
 * nothing until the roster says so. The asymmetry is not taste, and it is the
 * gap grok's review named. A plugin's tab half BINDS ITS MEMBERS the moment it
 * mounts — kolu's takes five, odu's takes one — and a subscription to a sibling
 * this serve did not compose fails with `Unknown request tag`, which the
 * per-subscription retry fence correctly declines to retry: the failure is the
 * fiber's exit and no frame can follow one. So it LATCHES. A guess that is
 * corrected a frame later cannot un-latch it; the readout stays `degraded`
 * naming a sibling nobody asked for, for the life of the page. A draw is
 * reversible and a subscription is not, so the two guesses point opposite ways.
 *
 * ## Three arms on the subscribe side, because a roster can also FAIL
 *
 * PENDING is the one above: mount nothing, wait a beat.
 *
 * ARRIVED is the answer: mount exactly what this serve composed.
 *
 * FAILED is the third and it is not the same as pending. A `plugins` cell that
 * errors is a tab talking to a server too old to declare the member, which is
 * the one case where waiting forever would blank the whole app rather than
 * degrade it. So it falls back to the BUILD — which is what this app did before
 * any of this existed, and is honest under a readout that is already amber and
 * already naming what stopped.
 *
 * ## And why none of this is read from the registry
 *
 * `@olai/plugins`' registry knows what the BUILD has and cannot know what this
 * serve composed — the two differ exactly when `--plugins` was given, which is
 * the only case this module exists for.
 */

import { createMemo } from "solid-js"

import { ALL_RUNNING, type Running } from "../live/seam.ts"
import { ROSTER } from "./roster.ts"
import { olai } from "../wire.ts"

/** The roster as this tab has it: which plugins this serve is running, or
 *  `undefined` while the cell has not answered — with `failed` distinguishing
 *  the answer that is never coming from the one that has not come yet. */
const held = () => {
  const roster = olai.cells.plugins.use()
  return {
    off: (): ReadonlySet<string> | undefined => {
      const value = roster.value()
      return value === undefined
        ? undefined
        : new Set(value.built.filter((one) => !one.running).map((one) => one.name))
    },
    failed: () => roster.error() !== undefined,
  }
}

/**
 * THE DRAW LICENCE — may this plugin's face appear.
 *
 * Spent by `../live/seam.ts`'s `dressingFor` at the moment a property is laid
 * out. Generous before the roster; see the header for why that is the right way
 * round for a face and the wrong way round for a subscription.
 */
export const createRunning = (): (() => Running) => {
  const roster = held()
  return createMemo<Running>(() => {
    const off = roster.off()
    // The seam names this answer and says why it is the generous one; a second
    // `() => true` spelled here would be the same decision with nowhere to
    // argue it.
    if (off === undefined) return ALL_RUNNING
    // A name the roster does not carry is a plugin this SERVE has never heard
    // of, which a tab can reach only by being newer than the server it dialled.
    // It draws — the same generosity the pre-roster answer shows, and for the
    // same reason: a face too many is a face, and a face too few is a hole
    // nobody can explain.
    return (plugin) => !off.has(plugin)
  })
}

/**
 * THE SUBSCRIBE LICENCE — may this plugin's half BIND ITS MEMBERS.
 *
 * Spent by `./Mounted.tsx` and `./Chrome.tsx`, which are the two places a
 * plugin's own components come into existence and therefore the two places its
 * subscriptions are opened.
 *
 * WHAT COMES BACK IS THE NAMES, not a predicate, and that is deliberate: both
 * callers have to REBUILD when the answer moves, and a rebuild has to happen
 * exactly as often as the answer actually changes rather than as often as the
 * cell publishes. A sorted, joined list is a value the default memo equality
 * can compare, so a server republishing an identical roster — a reconnect does
 * — moves nothing and re-creates nothing. A predicate would be a new closure
 * every frame and would tear the page down with it.
 *
 * `undefined` is PENDING and means mount nothing yet. It is not the same as the
 * empty list, which is a serve that answered `--plugins=` and genuinely runs
 * none.
 */
export const createComposed = (): (() => ReadonlyArray<string> | undefined) => {
  const roster = held()
  const signature = createMemo<string | undefined>(() => {
    const off = roster.off()
    // FAILED, not pending — the header's third arm. Everything the build has,
    // which is what a tab that could not ask has always drawn.
    if (off === undefined) return roster.failed() ? BUILT : undefined
    return ROSTER.filter((plugin) => !off.has(plugin.name)).map((plugin) => plugin.name).join("\n")
  })
  // A second memo over the string, so the ARRAY identity moves only when the
  // signature does. Splitting inside the callers would hand each of them a
  // fresh array per read and undo the whole point of the string.
  return createMemo(() => {
    const words = signature()
    return words === undefined ? undefined : words === "" ? [] : words.split("\n")
  })
}

/** Every plugin this BUILD has, as a signature — the failed arm's answer. */
const BUILT = ROSTER.map((plugin) => plugin.name).join("\n")

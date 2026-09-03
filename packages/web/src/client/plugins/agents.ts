/**
 * THIS TAB'S TWO ENGINE FACES, by the word core already has.
 *
 * An ACP engine is a PLUGIN, so its row in the panel's *which agent?* question
 * and its row on the face drawn when this machine has no agent at all are
 * DRAWINGS ABOUT A PLUGIN — which is exactly what `@olai/bundle`'s
 * `fence.test.ts` holds no general package may hold a table of. `../plugins/
 * marks.ts` is the same lookup one slot over, and its header argues the shape:
 * a lookup rather than a table, because a table here would be a core file
 * edited every time an engine core has never heard of ships.
 *
 * ## The key is the id, and there is only one of it
 *
 * An engine's id IS its plugin's word — the row's `id` in `olai.yml`, which is
 * what the fiber is bound under and what the slot table is keyed by — so the
 * string the panel already holds for *who is this conversation with* is the
 * string these are looked up by. Nothing composes an address.
 *
 * ## `undefined` is a face this TAB does not have
 *
 * Which is a real state and not an error: an engine whose chunk the roster did
 * not name registers nothing, and a browser half whose `apply` failed has been
 * contained and left the slot empty. Each caller draws its own fallback — the
 * wire's own `name` for a picker row, nothing at all for an install sentence —
 * because what is honest to say differs, and a fallback answered from here
 * would put core's own drawing behind a function whose name says "the
 * plugin's".
 */

import type { JSX } from "solid-js"

import { hung } from "./runtime.ts"

/** The row this engine draws in the *which agent?* question, or `undefined`. */
export const rowOf = (id: string): (() => JSX.Element) | undefined =>
  hung("chat.agent.row").find((one) => one.plugin === id)?.face

/** ...and every engine's own sentence about being installed, in the build's
 *  order — the whole of what the no-agent face lists.
 *
 *  THE LIST RATHER THAN A LOOKUP, because that face has no other source for
 *  WHICH engines to name: the roster it would ask is empty by definition there,
 *  and the slot table is what a serve composed. An engine that hangs no face is
 *  simply not listed, which is the honest answer for one with nothing to say
 *  about being got. */
export const installs = (): ReadonlyArray<{
  readonly plugin: string
  readonly face: () => JSX.Element
}> => [...hung("chat.agent.install")]

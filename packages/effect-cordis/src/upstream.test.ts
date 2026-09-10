/**
 * THE PIN'S OWN BEHAVIOUR, ASKED DIRECTLY — no Effect, no bridge, no olai.
 *
 * Every other file in this package asserts what the BRIDGE does. This one
 * asserts what the RUNTIME UNDERNEATH IT does, in Cordis's own vocabulary,
 * because the bridge's most consequential compensation is a reaction to a
 * behaviour that has no type, no document and no test upstream: a fiber's
 * disposers are unloaded CONCURRENTLY.
 *
 * ## What it is FOR, which is two things
 *
 * **An upstream reproduction.** The first case below is a complete, minimal
 * demonstration of the ordering problem, written so it can be lifted into an
 * issue against cordiverse/cordis with nothing removed: one context, one
 * plugin, two effects, and an assertion that the second releases while the
 * first is still waiting. `nix/cordis.nix` carries the ask it belongs to.
 *
 * **A guard.** A pin bump that made the unload sequential would not break
 * anything — the bridge's own ordering still holds — but it would make
 * `lifecycle.ts`'s compensation dead weight nobody could tell was dead. These
 * cases are how a reader finds out that the reason moved.
 *
 * ## The assumptions asked here, and the ones asked elsewhere
 *
 * Here: the concurrent unload, and the disposer identity `offer` takes
 * ownership of. Elsewhere, on purpose, because a claim belongs beside the code
 * that rests on it: the duplicate-provider PROSE is `./lifecycle.test.ts`, the
 * disposer handoff's own assertion is `lifecycle.ts` at the offer, and the
 * bridge's whole ordering is `./lifecycle.test.ts`'s dependent-cleanup cases.
 * `../README.md` is the index over all of them.
 */

import { expect, test } from "bun:test"
import { Context } from "cordis"

/** A promise, and the hand that settles it. */
const held = (): { readonly wait: Promise<void>; readonly let: () => void } => {
  const { promise, resolve } = Promise.withResolvers<void>()
  return { wait: promise, let: () => { resolve() } }
}

test("the pinned runtime unloads a fiber's disposers concurrently", async () => {
  // ── THE REPRODUCTION, verbatim ────────────────────────────────────────────
  // A plugin registers two effects. One disposer WAITS — which is what a
  // disposer that has to join something else does — and the other releases a
  // resource the waiting one is still standing in.
  //
  // If the disposers were unloaded one at a time, in either direction, the
  // resource could not go while the waiting one is still inside its wait. It
  // does, every time: `Fiber._unload` is one `Promise.all` over the whole set.
  const order: Array<string> = []
  const waiting = held()
  const ctx = new Context()
  await ctx.plugin({
    name: "two-effects",
    apply: (inner: Context) => {
      inner.effect(() => () => { order.push("the resource released") })
      inner.effect(() => async () => {
        order.push("the waiting disposer entered")
        await waiting.wait
        order.push("the waiting disposer left")
      })
    },
  })
  const unloading = ctx.fiber.dispose()
  // A beat, so the unload has certainly started and certainly cannot finish:
  // one disposer is parked on `waiting`.
  await new Promise((resume) => { setTimeout(resume, 20) })
  // THE CLAIM, and the order between these two is not part of it: one disposer
  // is standing inside its wait, and the resource beside it is already gone.
  expect(order).toContain("the waiting disposer entered")
  expect(order).toContain("the resource released")
  expect(order).not.toContain("the waiting disposer left")
  waiting.let()
  await unloading
  expect(order).toContain("the waiting disposer left")
  // ── END OF THE REPRODUCTION ───────────────────────────────────────────────
  //
  // WHY IT MATTERS HERE. `lifecycle.ts` revokes this activation's service
  // offers and joins every dependent's cleanup BEFORE it closes the Effect
  // scope holding the provider's resources. Doing that inside a disposer left
  // beside the others would be this test: the waiting one waits, and the ones
  // next to it release the very resources the dependents are still calling
  // through. So the bridge takes its provisions' disposers out of the set and
  // runs them itself, in order.
})

test("a provision's disposer is one the pinned runtime pushes into that set", () => {
  // THE OTHER HALF OF THE SAME COMPENSATION, and the one that has a runtime
  // assertion behind it in `lifecycle.ts`: taking the ordering means taking
  // the disposer OUT, which is only possible because `ctx.provide` answers
  // with the very function it pushed. A revision that answered with a fresh
  // wrapper, or pushed a second entry, would leave the bridge revoking through
  // one hand while the concurrent unload revoked through the other.
  const ctx = new Context()
  const before = [...ctx.fiber._disposables]
  const revoke = ctx.provide("a-toy-service", () => ({}))
  const after = [...ctx.fiber._disposables]
  expect(after).toHaveLength(before.length + 1)
  expect(after.includes(revoke as unknown as (typeof after)[number])).toBe(true)
})

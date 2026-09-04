/**
 * THE THREE EXITS OF A CALL, and the one that had no arm — the claim a page
 * error that named no application code is written after.
 *
 * ## The bug
 *
 * The edge was `Effect.runPromise(Effect.result(effect))`. `Effect.result`
 * folds a DECLARED failure into data and leaves an INTERRUPT alone, so an
 * interrupted call rejected the promise underneath it — and both callers read
 * that promise with a `.then` that had no rejection handler. What a person got
 * was an uncaught
 *
 *     Error: All fibers interrupted without error
 *
 * with nothing but Effect's own frames under it, in a scenario that had made no
 * call it knew about.
 *
 * It became reachable when the tab started following the roster: a redial
 * supersedes the connection, and every call still in flight on the old one is
 * interrupted at that moment. That is the ordinary end of a roster change and
 * of every boot whose roster lands after the first paint — so this was a page
 * error a person could hit on an ordinary load, on a slow machine, for nothing.
 *
 * ## So the claim is that the edge CANNOT REJECT, and what each exit becomes
 *
 * Every case below runs a whole call through `runAsync` and asks what it hands
 * back. The interrupt case is the regression; the other two are here because a
 * fix that swallowed everything would pass an interrupt case alone — a defect
 * that stopped reaching the console loudly is the same class of silence this
 * file's header refuses, one exit over.
 */

import { expect, test } from "bun:test"
import { Effect, Result } from "effect"

import { BusyFailure, isOpFailure } from "@olai/format"
import { runAsync } from "./run.ts"

/** A DECLARED FAILURE is data — the arm that already worked, held so a fix to
 *  the arm below cannot quietly take it with it. */
test("a call that fails with a declared refusal hands the refusal back", async () => {
  const refusal = new BusyFailure({ reason: "the server said no" })
  const outcome = await runAsync(Effect.fail(refusal))
  expect(Result.isFailure(outcome)).toBe(true)
  if (Result.isFailure(outcome)) expect(outcome.failure).toBe(refusal)
})

/** ...and a SUCCESS is its value, which is the case that would go on passing
 *  over an edge that had stopped answering at all. */
test("a call that succeeds hands its value back", async () => {
  const outcome = await runAsync(Effect.succeed(7))
  expect(Result.isSuccess(outcome)).toBe(true)
  if (Result.isSuccess(outcome)) expect(outcome.success).toBe(7)
})

/**
 * THE REGRESSION — an INTERRUPTED call settles rather than rejecting.
 *
 * `Effect.interrupt` is what a superseded connection does to everything still
 * in flight on it, spelled as one effect. Before the fix this line rejected,
 * and `await` would have thrown here the way the page did.
 *
 * It comes back as `busy` rather than as silence because a caller that
 * SEQUENCES has to be told: `runAsync` exists for the row editor, which commits
 * a title and then moves the row, and a first step that never landed must not
 * be followed by a second judged against it.
 */
test("a call whose fiber was interrupted comes back as busy, and does not reject", async () => {
  const outcome = await runAsync(Effect.interrupt)
  expect(Result.isFailure(outcome)).toBe(true)
  if (!Result.isFailure(outcome)) return
  // A failure the panel can draw, in this app's own vocabulary rather than
  // Effect's — `All fibers interrupted without error` is not a sentence to put
  // in front of somebody whose page is simply moving to a newer wire.
  expect(isOpFailure(outcome.failure)).toBe(true)
  expect(outcome.failure._tag).toBe("BusyFailure")
  expect(String(outcome.failure.reason)).not.toContain("fibers")
})

/**
 * ...AND A DEFECT IS STILL LOUD, which is the half a fix could have destroyed
 * without any test noticing.
 *
 * The header's rule is that a defect is a bug and belongs in the console: it is
 * NOT folded into a failure a panel draws over, because that would turn every
 * crash in a procedure into a shrug that says "try again". So this asserts the
 * rejection rather than a `Result`, and that the thrown value is the defect
 * itself rather than something wrapped around it.
 */
test("a call that dies still rejects, with the defect itself", async () => {
  const defect = new Error("a bug, not a refusal")
  await expect(runAsync(Effect.die(defect))).rejects.toBe(defect)
})

/**
 * ...AND THE ONE DEFECT THAT IS NOT A BUG: the sibling this call was reaching
 * has left the bundle, because somebody switched that plugin off.
 *
 * The far side of the interrupt case above. A roster change produces both: the
 * interrupt is this tab giving up on a superseded wire, and this is the server
 * refusing a member it no longer serves — which `@olai/server`'s `runtime.ts`
 * promises rather than warns about, since a call left hanging on a producer
 * nobody drives would be worse. Before this arm the tab reported an uncaught
 * `surface: "surface/chat/conversation/sessions" is no longer served` at a
 * person who had just pressed a switch, on a page where nothing was wrong.
 *
 * TWO SHAPES, because a tagged error arrives as either: the value itself, whose
 * `_tag` and `name` are both the tag, and the plain object a
 * serialize-deserialize leaves behind, which keeps `_tag` alone. The framework's
 * own `messageOf` reads exactly this pair, in this order, for the same reason.
 */
test("a call whose sibling was dropped comes back as busy, in either shape", async () => {
  const shapes = [
    Object.assign(new Error(`surface: "surface/chat/conversation/sessions" is no longer served`), {
      _tag: "SurfaceSiblingDropped",
      name: "SurfaceSiblingDropped",
    }),
    // ...and the same fact having crossed a wire, which keeps the tag and
    // nothing else about the class.
    { _tag: "SurfaceSiblingDropped", key: "chat" },
  ]
  for (const shape of shapes) {
    const outcome = await runAsync(Effect.die(shape))
    expect(Result.isFailure(outcome)).toBe(true)
    if (!Result.isFailure(outcome)) return
    expect(isOpFailure(outcome.failure)).toBe(true)
    expect(outcome.failure._tag).toBe("BusyFailure")
    // ...and it says what happened in this app's words rather than the
    // framework's tag, which names a thing a reader has never heard of.
    expect(String(outcome.failure.reason)).toContain("plugin")
    expect(String(outcome.failure.reason)).not.toContain("SurfaceSiblingDropped")
  }
})

/**
 * ...AND THE NARROWING IS THE TAG, never the sentence — which is the half that
 * would collapse silently.
 *
 * A defect that merely TALKS about a dropped sibling is still a bug, and the
 * cheap version of this arm — matching the message, or swallowing anything
 * transport-shaped — would fold the class of real faults into the one expected
 * end. This is the case that fails if the recognition ever loosens to prose.
 */
test("a defect that only mentions a dropped sibling is still loud", async () => {
  const impostor = new Error(
    `surface: "surface/chat/conversation/sessions" is no longer served — ` +
      `the sibling "chat" was dropped from this rooted bundle`,
  )
  await expect(runAsync(Effect.die(impostor))).rejects.toBe(impostor)
})

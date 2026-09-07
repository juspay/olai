/**
 * THE THREE RULES `heldFaces` IS, held one at a time — the twin of
 * `@olai/ui-primitives`' `held.browsertest.ts` for the browser's slot table.
 *
 * The middle one is a review finding rather than a hypothetical. The release
 * compared the SERVICE VALUE, and `Faces` is one object a provider hands to
 * everybody — so two activations holding the same table made the second's
 * release match the first's hold and clear it. The third case is what a token
 * still cannot fix and is the reason `heldFaces` is a factory: one holder is
 * one slot, so two consumers with two lifetimes are two holders.
 *
 * Under the browser condition for `held.browsertest.ts`'s reason — the readings
 * are meant to be observed from a memo, and a server-resolved Solid never
 * recomputes one.
 */
import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"

import { heldFaces, type Faces } from "./browser.ts"

/** A table that answers one thing, so a case can say WHICH table a reading came
 *  from. Nothing here exercises the slot rules; those are `Locations`'. */
const table = (said: string): Faces => ({
  hung: (() => [{ plugin: said, face: said }]) as Faces["hung"],
  dressed: (() => new Map([[said, said]])) as Faces["dressed"],
  only: (() => ({ plugin: said, face: said })) as unknown as Faces["only"],
})

const wordsIn = (faces: Pick<Faces, "hung">): ReadonlyArray<string> =>
  faces.hung("app.route").map((one) => one.plugin)

test("two callers get two holders, so minting one shares nothing", () =>
  Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const one = heldFaces()
    const other = heldFaces()
    yield* one.hold(table("first"))
    expect(wordsIn(one)).toEqual(["first"])
    // ...and the other answers the empty reading, which is what a face drawn
    // before its row's renderer arrived has always been told.
    expect(wordsIn(other)).toEqual([])
    expect(other.dressed("outline.row.chip").size).toBe(0)
    expect(other.only("app.panel")).toBeNull()
  }))))

/**
 * ONE `Faces`, TWO ACTIVATIONS — the identity half of the finding.
 *
 * The §4 rule is that a stopped activation clears its own value and never a
 * replacement's, and the old release asked `held === faces`. That reads as
 * correct until the two activations hold the SAME object, which is the ordinary
 * case for a service: ui-renderer hands one slot table to everybody. Then the
 * outgoing activation's finalizer matches the standing hold and empties it.
 *
 * The ordering here is the one a token fixes: the FIRST hold released after a
 * second is installed, which is the ordering `held.browsertest.ts` pins for
 * `heldService` and which the value check gets wrong only when the values are
 * equal.
 */
test("a stopped activation clears its own hold and never a live one, even for the SAME table", () =>
  Effect.runPromise(Effect.gen(function*() {
    const held = heldFaces()
    const shared = table("shared")
    const first = yield* Scope.make()
    const second = yield* Scope.make()
    yield* Scope.provide(held.hold(shared), first)
    yield* Scope.provide(held.hold(shared), second)
    // The first activation's finalizer runs while the second's hold stands.
    yield* Scope.close(first, Exit.void)
    expect(wordsIn(held)).toEqual(["shared"])
    yield* Scope.close(second, Exit.void)
    expect(wordsIn(held)).toEqual([])
  })))

/**
 * ...AND WHAT THE TOKEN DOES NOT BUY, which is why the repair upstream is two
 * holders rather than a better identity check.
 *
 * One holder is ONE SLOT. A second hold displaces the first, and releasing the
 * second leaves the first consumer reading the empty table rather than the one
 * it is still entitled to — whatever the release compares. That is the exact
 * shape navigation had: two components holding into one holder, the palette
 * holding second and stopping first, and the renderer left reading `[]`. It is
 * correct behaviour for a holder, which belongs to ONE consumer, and it is
 * pinned here so the next reader with two consumers reaches for a second
 * `heldFaces()` rather than for a cleverer token.
 */
test("one holder is one slot: a second hold displaces the first, and its release empties it", () =>
  Effect.runPromise(Effect.gen(function*() {
    const held = heldFaces()
    const first = yield* Scope.make()
    const second = yield* Scope.make()
    yield* Scope.provide(held.hold(table("first")), first)
    yield* Scope.provide(held.hold(table("second")), second)
    expect(wordsIn(held)).toEqual(["second"])
    yield* Scope.close(second, Exit.void)
    expect(wordsIn(held)).toEqual([])
    yield* Scope.close(first, Exit.void)
  })))

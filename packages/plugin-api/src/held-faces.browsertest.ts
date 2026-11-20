import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"

import { singleConsumerFaces, type Faces } from "./browser.ts"

const table = (said: string): Faces => ({
  hung: (() => [{ plugin: said, face: said }]) as Faces["hung"],
  dressed: (() => new Map([[said, said]])) as Faces["dressed"],
  only: (() => ({ plugin: said, face: said })) as unknown as Faces["only"],
})

const wordsIn = (faces: Pick<Faces, "hung">): ReadonlyArray<string> =>
  faces.hung("app.route").map((one) => one.plugin)

test("two callers get two holders, so minting one shares nothing", () =>
  Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const one = singleConsumerFaces()
    const other = singleConsumerFaces()
    yield* one.hold(table("first"))
    expect(wordsIn(one)).toEqual(["first"])
    expect(wordsIn(other)).toEqual([])
    expect(other.dressed("outline.row.chip").size).toBe(0)
    expect(other.only("app.viewer")).toBeNull()
  }))))

test("a stopped activation clears its own hold and never a live one, even for the SAME table", () =>
  Effect.runPromise(Effect.gen(function*() {
    const held = singleConsumerFaces()
    const shared = table("shared")
    const first = yield* Scope.make()
    const second = yield* Scope.make()
    yield* Scope.provide(held.hold(shared), first)
    yield* Scope.provide(held.hold(shared), second)
    yield* Scope.close(first, Exit.void)
    expect(wordsIn(held)).toEqual(["shared"])
    yield* Scope.close(second, Exit.void)
    expect(wordsIn(held)).toEqual([])
  })))

test("one holder is one slot: a second hold displaces the first, and its release empties it", () =>
  Effect.runPromise(Effect.gen(function*() {
    const held = singleConsumerFaces()
    const first = yield* Scope.make()
    const second = yield* Scope.make()
    yield* Scope.provide(held.hold(table("first")), first)
    yield* Scope.provide(held.hold(table("second")), second)
    expect(wordsIn(held)).toEqual(["second"])
    yield* Scope.close(second, Exit.void)
    expect(wordsIn(held)).toEqual([])
    yield* Scope.close(first, Exit.void)
  })))

import { expect, test } from "bun:test"
import { claims } from "@olai/format"
import { TEST_CLAIMS } from "@olai/format/testlib"
import { Deferred, Effect, Exit, Fiber, Scope } from "effect"
import { openBodyReader } from "./body-reader.ts"

test("only claimed unkept text reaches the disk, and text is read anew per request", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  let text = "a,b"
  const reads: string[] = []
  const body = yield* openBodyReader(path => Effect.sync(() => { reads.push(path); return text }), () => TEST_CLAIMS)
  for (const path of ["notes.md", "a.olai", "a.png", "a.pdf", "a.txt", "../a.csv"]) {
    expect(yield* body(path)).toEqual({ text: null, refused: true })
  }
  expect(reads).toEqual([])
  expect(yield* body("a.csv")).toEqual({ text: "a,b", refused: false })
  text = "c,d"
  expect(yield* body("a.csv")).toEqual({ text: "c,d", refused: false })
  expect(reads).toEqual(["a.csv", "a.csv"])
}))))

test("withdrawal during a read refuses its result and return reads fresh bytes", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  let current = TEST_CLAIMS
  const entered = yield* Deferred.make<void>()
  const finish = yield* Deferred.make<void>()
  const body = yield* openBodyReader(() => Effect.gen(function*() {
    yield* Deferred.succeed(entered, undefined)
    yield* Deferred.await(finish)
    return "a,b"
  }), () => current)
  const request = yield* Effect.forkScoped(body("a.csv"))
  yield* Deferred.await(entered)
  current = claims([...current.byKind.values()].filter(claim => claim.kind !== "csv"))
  yield* Deferred.succeed(finish, undefined)
  expect(yield* Fiber.join(request)).toEqual({ text: null, refused: true })
  current = TEST_CLAIMS
  expect(yield* body("a.csv")).toEqual({ text: "a,b", refused: false })
}))))

test("closing the reader settles outstanding requests and refuses retained handles", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const owner = yield* Scope.make()
  const entered = yield* Deferred.make<void>()
  const body = yield* openBodyReader(() => Effect.andThen(Deferred.succeed(entered, undefined), Effect.never), () => TEST_CLAIMS)
    .pipe(Scope.provide(owner))
  const request = yield* Effect.forkScoped(body("a.csv"))
  yield* Deferred.await(entered)
  yield* Scope.close(owner, Exit.void)
  expect(yield* Fiber.join(request)).toEqual({ text: null, refused: true })
  expect(yield* body("a.csv")).toEqual({ text: null, refused: true })
}))))

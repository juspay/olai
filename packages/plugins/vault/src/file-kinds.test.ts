import { expect, test } from "bun:test"
import { Effect, Exit, Scope, Stream } from "effect"
import type { FileClaim } from "@olai/plugin-api/services"
import { openViews } from "./views.ts"

const claim = (exts: FileClaim["exts"]): FileClaim => ({
  exts, holds: "bytes", kept: false, fetched: true, noun: "file", article: "a",
})

test("file claims are scoped, stamped and isolated between vaults", () => Effect.runPromise(Effect.gen(function*() {
  const one = openViews().fileKinds
  const two = openViews().fileKinds
  const scope = yield* Scope.make()
  yield* Scope.provide(one.provision("actual").register({ ...claim([".first"]), kind: "forged" } as FileClaim), scope)
  const snapshot = one.current()
  expect([...snapshot.byKind.keys()]).toEqual(["actual"])
  expect(two.current().byKind.size).toBe(0)
  yield* Scope.close(scope, Exit.void)
  expect(one.current().byKind.size).toBe(0)
  expect(snapshot.byKind.has("actual")).toBe(true)
})))

test("a multi-suffix loser installs nothing and cannot withdraw the winner", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const table = openViews().fileKinds
  yield* table.provision("first").register(claim([".taken"]))
  const failed = yield* Effect.exit(Effect.scoped(table.provision("second").register(claim([
    ".one", ".two", ".three", ".four", ".taken", ".six", ".seven", ".eight", ".nine",
  ]))))
  expect(Exit.isFailure(failed)).toBe(true)
  expect([...table.current().byExt]).toEqual([[".taken", "first"]])
  expect(Exit.isFailure(yield* Effect.exit(Effect.scoped(table.provision("first").register(claim([".other"])))))).toBe(true)
  expect([...table.current().byExt]).toEqual([[".taken", "first"]])
}))))

test("a later claim does not invalidate an earlier owner's cleanup token", () => Effect.runPromise(Effect.gen(function*() {
  const table = openViews().fileKinds
  const first = yield* Scope.make()
  const second = yield* Scope.make()
  yield* Scope.provide(table.provision("first").register(claim([".first"])), first)
  yield* Scope.provide(table.provision("second").register(claim([".second"])), second)
  yield* Scope.close(first, Exit.void)
  expect([...table.current().byKind.keys()]).toEqual(["second"])
  yield* Scope.close(second, Exit.void)
  expect(table.current().byKind.size).toBe(0)
})))

test("a file-kind subscriber sees the standing table on subscription", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const table = openViews().fileKinds
  yield* table.provision("one").register(claim([".first"]))
  yield* Stream.runForEach(Stream.take(table.changes, 1), () => Effect.sync(() => {
    expect(table.current().byKind.has("one")).toBe(true)
  }))
}))))

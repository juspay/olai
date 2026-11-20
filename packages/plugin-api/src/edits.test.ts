import { expect, test } from "bun:test"
import { Effect, Exit, Result, Scope } from "effect"
import { NotFoundFailure } from "@olai/format"

import { Edits, NO_EDITS, openApp, type EditWriters } from "./browser.ts"
import { definePlugin, mountPlugin } from "./runtime.ts"

const edit = { verb: "title" as const, id: "writer-test", title: "new" }
const writer = (said: string) => () => Effect.fail(new NotFoundFailure({ reason: said }))
const sent = <A>(effect: Effect.Effect<A, unknown>) => Effect.runPromise(Effect.result(effect))
const scope = () => Effect.runPromise(Scope.make())
const close = (one: Scope.Closeable) => Effect.runPromise(Scope.close(one, Exit.void))
const claim = (
  table: EditWriters,
  verbs: ReadonlyArray<string>,
  write: ReturnType<typeof writer>,
  into: Scope.Scope,
) => Effect.runPromise(Effect.exit(Scope.provide(table.register(verbs, write as never), into)))

const appTable = (): Promise<{ readonly table: EditWriters; readonly stop: () => Promise<void> }> =>
  Effect.runPromise(Effect.gen(function*() {
    const held = yield* Scope.make()
    const app = yield* Scope.provide(openApp(), held)
    let table: EditWriters | undefined
    yield* mountPlugin(app.host, definePlugin({
      name: "writer-row",
      needs: [Edits],
      apply: Effect.flatMap(Edits, (edits) => Effect.sync(() => { table = edits })),
    }))
    return { table: table!, stop: () => Effect.runPromise(Scope.close(held, Exit.void)) }
  }))

test("an absent owner produces a typed refusal, and a fresh activation takes the verb", async () => {
  const { table, stop } = await appTable()
  expect(Result.isFailure(await sent(table.write(edit)))).toBe(true)
  let calls = 0
  const first = await scope()
  await claim(table, ["title"], () => { calls++; return writer("owned refusal")() }, first)
  await sent(table.write(edit))
  expect(calls).toBe(1)
  await close(first)
  await sent(table.write(edit))
  expect(calls).toBe(1)

  const fresh = await scope()
  await claim(table, ["title"], writer("owned refusal"), fresh)
  await close(first)
  const answer = await sent(table.write(edit))
  expect(Result.isFailure(answer) && (answer.failure as NotFoundFailure).message).toBe("owned refusal")
  await close(fresh)
  await stop()
})

test("a provider's transport failure reaches the execution edge unchanged", async () => {
  const { table, stop } = await appTable()
  const transport = { _tag: "SurfaceCallFailure", reason: "connection replaced" }
  const held = await scope()
  await claim(table, ["title"], (() => Effect.fail(transport)) as never, held)
  const answer = await sent(table.write(edit))
  expect(Result.isFailure(answer) && answer.failure).toBe(transport)
  await close(held)
  await stop()
})

test("a duplicate discriminator is refused without a partial registration", async () => {
  const { table, stop } = await appTable()
  const held = await scope()
  await claim(table, ["title"], writer("first"), held)
  const both = await claim(table, ["date", "title"], writer("second"), held)
  expect(Exit.isFailure(both)).toBe(true)
  expect(String(both)).toContain("already registered: title")
  const other = await scope()
  expect(Exit.isFailure(await claim(table, ["date"], writer("date's"), other))).toBe(false)
  const answer = await sent(table.write(edit))
  expect(Result.isFailure(answer) && (answer.failure as NotFoundFailure).message).toBe("first")
  await close(other)
  await close(held)
  await stop()
})

test("two apps are two tables, and a claim in one is invisible in the other", async () => {
  const one = await appTable()
  const other = await appTable()
  const held = await scope()
  await claim(one.table, ["title"], writer("one's"), held)
  const mine = await sent(one.table.write(edit))
  expect(Result.isFailure(mine) && (mine.failure as NotFoundFailure).message).toBe("one's")
  const theirs = await sent(other.table.write(edit))
  expect(Result.isFailure(theirs) && (theirs.failure as NotFoundFailure).message)
    .toBe("the capability for title is not active")
  expect(Exit.isFailure(await claim(other.table, ["title"], writer("other's"), held))).toBe(false)
  await close(held)
  await one.stop()
  await other.stop()
})

const PADS = 2200

const pad = (n: number) =>
  Effect.forEach(Array.from({ length: n }, (_, at) => at), () => Effect.sync(() => 0), { discard: true })

const gappy = () => {
  let held: string | undefined
  return (door: string) =>
    Effect.suspend(() =>
      held !== undefined
        ? Effect.die(new Error("taken"))
        : Effect.acquireRelease(
          Effect.sync(() => { held = door }),
          () => Effect.sync(() => { if (held === door) held = undefined }),
        ).pipe(Effect.asVoid),
    )
}

const racing = (
  n: number,
  claiming: (door: string) => Effect.Effect<void, never, Scope.Scope>,
  into: Scope.Scope,
): Promise<number> =>
  Effect.runPromise(Effect.all([
    Effect.exit(Scope.provide(Effect.andThen(pad(n), claiming("first")), into)),
    Effect.exit(Scope.provide(Effect.andThen(pad(n), claiming("second")), into)),
  ], { concurrency: "unbounded" })).then((outcomes) => outcomes.filter(Exit.isSuccess).length)

test("the sweep below reaches a yield boundary, or it is asking nothing", async () => {
  const held = await scope()
  const landed: number[] = []
  for (let n = 0; n <= PADS; n++) {
    const table = gappy()
    if (await racing(n, table, held) !== 1) landed.push(n)
  }
  expect(landed.length).toBeGreaterThan(0)
  await close(held)
})

test("two rows claiming one verb at the same time: exactly one lands, at every distance from a yield", async () => {
  const { table, stop } = await appTable()
  const held = await scope()
  const doubled: number[] = []
  for (let n = 0; n <= PADS; n++) {
    const verb = `sweep-${n}`
    const landed = await racing(n, (door) => table.register([verb], writer(door) as never), held)
    if (landed !== 1) doubled.push(n)
  }
  expect(doubled).toEqual([])
  await close(held)
  await stop()
})

test("two rows whose verb lists overlap: exactly one lands, and nothing is half-taken", async () => {
  const { table, stop } = await appTable()
  const held = await scope()
  const wrong: string[] = []
  for (let n = 0; n <= PADS; n++) {
    const wide = `wide-${n}`
    const shared = `shared-${n}`
    const outcomes = await Effect.runPromise(Effect.all([
      Effect.exit(Scope.provide(
        Effect.andThen(pad(n), table.register([wide, shared], writer("wide") as never)), held,
      )),
      Effect.exit(Scope.provide(
        Effect.andThen(pad(n), table.register([shared], writer("narrow") as never)), held,
      )),
    ], { concurrency: "unbounded" }))
    if (outcomes.filter(Exit.isSuccess).length !== 1) { wrong.push(`${n}: both claims landed`); continue }
    const won = Exit.isSuccess(outcomes[0]!) ? "wide" : "narrow"
    const onShared = await sent(table.write({ verb: shared }))
    if (!Result.isFailure(onShared) || (onShared.failure as NotFoundFailure).message !== won) {
      wrong.push(`${n}: the shared verb does not answer through the winner`)
    }
    const onWide = await sent(table.write({ verb: wide }))
    const expected = won === "wide" ? "wide" : `the capability for ${wide} is not active`
    if (!Result.isFailure(onWide) || (onWide.failure as NotFoundFailure).message !== expected) {
      wrong.push(`${n}: a refused claim left ${wide} half-taken`)
    }
  }
  expect(wrong).toEqual([])
  await close(held)
  await stop()
})

test("the empty table refuses a write and defects on a registration", async () => {
  const refused = await sent(NO_EDITS.write(edit))
  expect(Result.isFailure(refused) && (refused.failure as NotFoundFailure).message)
    .toBe("the capability for title is not active")
  expect(Exit.isFailure(await Effect.runPromise(Effect.exit(
    Effect.scoped(NO_EDITS.register(["title"], writer("no") as never)),
  )))).toBe(true)
})

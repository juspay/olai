import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
import { NO_LEDGER, NO_SEARCH, type Ledger, type Search } from "@olai/ops"

import { openViews, type Views } from "./views.ts"

const ledgerNamed = (name: string): Ledger => ({ ...NO_LEDGER, whyWaiting: () => Effect.succeed(name) })
const searchNamed = (name: string): Search => ({ nodes: () => Effect.succeed({ found: [], total: 0, said: name } as never) })
const registers = (views: Views) => ({
  ledger: (door: Ledger): Effect.Effect<void, never, Scope.Scope> =>
    views.door.ledger(door as never),
  search: (door: Search): Effect.Effect<void, never, Scope.Scope> =>
    views.door.search(door as never),
})

const nameOf = (door: Ledger): Promise<string | null> => Effect.runPromise(door.whyWaiting("web"))

test("a table with nobody registered answers the vault's own refusals", () => {
  const views = openViews()
  expect(views.ledger()).toBe(NO_LEDGER)
  expect(views.search()).toBe(NO_SEARCH)
})

test("two tables are two tables, and a registration in one is invisible in the other", () =>
  Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const one = openViews()
    const other = openViews()
    yield* registers(one).ledger(ledgerNamed("first"))
    yield* registers(other).ledger(ledgerNamed("second"))
    expect(yield* Effect.promise(() => nameOf(one.ledger()))).toBe("first")
    expect(yield* Effect.promise(() => nameOf(other.ledger()))).toBe("second")
  }))))

test("a provider that leaves takes its view with it, and one that returns brings it back", () =>
  Effect.runPromise(Effect.gen(function*() {
    const views = openViews()
    const first = yield* Scope.make()
    yield* Scope.provide(registers(views).ledger(ledgerNamed("git")), first)
    expect(yield* Effect.promise(() => nameOf(views.ledger()))).toBe("git")
    yield* Scope.close(first, Exit.void)
    expect(views.ledger()).toBe(NO_LEDGER)
    const again = yield* Scope.make()
    yield* Scope.provide(registers(views).ledger(ledgerNamed("git again")), again)
    expect(yield* Effect.promise(() => nameOf(views.ledger()))).toBe("git again")
    yield* Scope.close(again, Exit.void)
    expect(views.ledger()).toBe(NO_LEDGER)
  })))

test("the matcher follows the same rule as the ledger", () =>
  Effect.runPromise(Effect.gen(function*() {
    const views = openViews()
    const scope = yield* Scope.make()
    expect(views.search()).toBe(NO_SEARCH)
    yield* Scope.provide(registers(views).search(searchNamed("index")), scope)
    expect(views.search()).not.toBe(NO_SEARCH)
    yield* Scope.close(scope, Exit.void)
    expect(views.search()).toBe(NO_SEARCH)
  })))

test("a second row registering a ledger is a defect, and the first one still stands", () =>
  Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const views = openViews()
    yield* registers(views).ledger(ledgerNamed("git"))
    const second = yield* Effect.exit(registers(views).ledger(ledgerNamed("other git")))
    expect(Exit.isFailure(second)).toBe(true)
    expect(String(second)).toContain("a second row registered the ledger")
    expect(yield* Effect.promise(() => nameOf(views.ledger()))).toBe("git")
  }))))

test("...and so is a second matcher", () =>
  Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const views = openViews()
    yield* registers(views).search(searchNamed("index"))
    const second = yield* Effect.exit(registers(views).search(searchNamed("other index")))
    expect(Exit.isFailure(second)).toBe(true)
    expect(String(second)).toContain("a second row registered the matcher")
  }))))

test("a refused registration leaves nothing behind when its scope closes", () =>
  Effect.runPromise(Effect.gen(function*() {
    const views = openViews()
    const standing = yield* Scope.make()
    yield* Scope.provide(registers(views).ledger(ledgerNamed("git")), standing)
    const loser = yield* Scope.make()
    yield* Effect.exit(Scope.provide(registers(views).ledger(ledgerNamed("other")), loser))
    yield* Scope.close(loser, Exit.void)
    expect(yield* Effect.promise(() => nameOf(views.ledger()))).toBe("git")
    yield* Scope.close(standing, Exit.void)
    expect(views.ledger()).toBe(NO_LEDGER)
  })))

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
  const held = await Effect.runPromise(Scope.make())
  const landed: number[] = []
  for (let n = 0; n <= PADS; n++) {
    const slot = gappy()
    if (await racing(n, slot, held) !== 1) landed.push(n)
  }
  expect(landed.length).toBeGreaterThan(0)
  await Effect.runPromise(Scope.close(held, Exit.void))
})

test("two rows registering a ledger at once: exactly one lands, at every distance from a yield", async () => {
  const held = await Effect.runPromise(Scope.make())
  const wrong: string[] = []
  for (let n = 0; n <= PADS; n++) {
    const views = openViews()
    const landed = await racing(n, (door) => registers(views).ledger(ledgerNamed(door)), held)
    if (landed !== 1) { wrong.push(`${n}: both claims landed`); continue }
    const said = await nameOf(views.ledger())
    if (said !== "first" && said !== "second") wrong.push(`${n}: the store answers ${String(said)}`)
  }
  expect(wrong).toEqual([])
  await Effect.runPromise(Scope.close(held, Exit.void))
})

test("...and the same for two matchers", async () => {
  const held = await Effect.runPromise(Scope.make())
  const doubled: number[] = []
  for (let n = 0; n <= PADS; n++) {
    const views = openViews()
    if (await racing(n, (door) => registers(views).search(searchNamed(door)), held) !== 1) doubled.push(n)
  }
  expect(doubled).toEqual([])
  await Effect.runPromise(Scope.close(held, Exit.void))
})

/**
 * A VAULT'S OPTIONAL VIEWS ARE THE VAULT'S — the bench for the ownership the
 * table used to lack.
 *
 * These were two `let`s at module scope, which is private to this package and
 * owned by nobody: one process opening two hosts had ONE pair of them, so the
 * second serve's git row answered the first serve's writes. Every case below
 * is about the difference between "private" and "owned", plus the two arms the
 * store has always had — nobody registered, and a provider that left.
 *
 * The wiring one door up (`./setup.ts` minting the table inside its own apply,
 * and two real hosts not sharing it) is `@olai/server`'s `vault.test.ts`.
 */
import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
import { NO_LEDGER, NO_SEARCH, type Ledger, type Search } from "@olai/ops"

import { openViews, type Views } from "./views.ts"

/**
 * A door with nothing behind it but a name to read back: what these cases
 * compare is WHICH ledger a table answers with, never what one does.
 *
 * Cast at the registration, because the two ends of this key spell the same
 * door twice on purpose: `@olai/plugin-api` may not import the floor, so
 * {@link VaultViews} takes the structural shape and the vault hands over the
 * floor's own type. `./setup.ts` casts at the same seam and for the same
 * reason.
 */
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
    // THE WHOLE FINDING, in two lines: with the views at module scope the
    // second registration answered for both.
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
    // ...and the absence is the vault's own word rather than a stale door.
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

/**
 * ...AND A SECOND CLAIMANT IS REFUSED, which the contract promised and the
 * implementation did not keep: it wrote unconditionally, so the second row's
 * door answered every write and the FIRST row's release — guarded by identity —
 * then did nothing at all, leaving the store pointed at a departed ledger.
 */
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

/** A refusal is not a withdrawal: the row that lost the race must be able to
 *  leave without taking the standing view with it. */
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

/**
 * TWO ROWS REGISTERING AT ONCE, which is the second review's finding.
 *
 * The refusal was a `suspend` that READ the slot and an `acquireRelease` that
 * WROTE it. Effect may hand the fiber over between any two Effects, so two
 * claimants could both find the slot empty and both install — and the store
 * then recorded through whichever wrote last, which is the exact failure
 * `VaultViews` says out loud it does not have. It is one synchronous body now.
 *
 * ## Why a SWEEP and not one number
 *
 * The gap is only reachable when the runtime's op budget runs out BETWEEN the
 * two Effects, which happens at one exact op count. A case padded to that
 * number would stop testing anything the day Effect changes its budget or this
 * module gains a line — so every pad up to a bracket around it is swept, and
 * the sweep carries its own proof that it got there: {@link gappy} is the shape
 * the finding was about, and the sweep must catch it.
 */
const PADS = 2200

const pad = (n: number) =>
  Effect.forEach(Array.from({ length: n }, (_, at) => at), () => Effect.sync(() => 0), { discard: true })

/** The shape the finding was about, as this sweep's canary. */
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
    // A FRESH TABLE per pad, because a vault's views are a vault's: what is
    // swept is one activation's registration, not a table's history.
    const views = openViews()
    const landed = await racing(n, (door) => registers(views).ledger(ledgerNamed(door)), held)
    if (landed !== 1) { wrong.push(`${n}: both claims landed`); continue }
    // ...and the store records through the one that won rather than the one
    // that wrote last.
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

/**
 * WHERE A VERB'S WRITE GOES — the dispatch, whose table it is, and what two
 * claimants racing for one verb get.
 *
 * These moved here with the table. Three of them are `@olai/edit-history`'s
 * original claims, kept at the new service boundary because they are about the
 * dispatch and not about where it lives: an absent owner refused in words and a
 * fresh one taking over, a provider's transport failure reaching the caller as
 * itself, and a duplicate refused without a partial registration.
 *
 * The rest are what the move and the review added: one table per app, and a
 * refusal with no gap in it.
 */
import { expect, test } from "bun:test"
import { Effect, Exit, Result, Scope } from "effect"
import { NotFoundFailure } from "@olai/format"

import { Edits, NO_EDITS, openApp, type EditWriters } from "./browser.ts"
import { definePlugin, mountPlugin } from "./runtime.ts"

const edit = { verb: "title" as const, id: "writer-test", title: "new" }
const writer = (said: string) => () => Effect.fail(new NotFoundFailure({ reason: said }))
const sent = <A>(effect: Effect.Effect<A, unknown>) => Effect.runPromise(Effect.result(effect))
const scope = () => Effect.runPromise(Scope.make())
const close = (one: Scope.Scope) => Effect.runPromise(Scope.close(one, Exit.void))
const claim = (
  table: EditWriters,
  verbs: ReadonlyArray<string>,
  write: ReturnType<typeof writer>,
  into: Scope.Scope,
) => Effect.runPromise(Effect.exit(Scope.provide(table.register(verbs, write as never), into)))

/** THE TABLE AS THE APP SUPPLIES IT, through a plugin that names the key —
 *  because "one table per app" is a claim about `openApp` rather than about the
 *  factory behind it, and a bench over the factory alone could not make it. */
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
  // The stale scope closing again cannot remove the fresh owner: the release
  // clears BY IDENTITY.
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
  // `date` rode in the refused claim and is still free, which is the whole of
  // "without a partial registration".
  const other = await scope()
  expect(Exit.isFailure(await claim(table, ["date"], writer("date's"), other))).toBe(false)
  // ...and the verb that was taken still answers through the row that took it.
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
  // ...and the other app's claim on the same verb is free to take.
  expect(Exit.isFailure(await claim(other.table, ["title"], writer("other's"), held))).toBe(false)
  await close(held)
  await one.stop()
  await other.stop()
})

/**
 * TWO CLAIMANTS AT ONCE, which is the finding.
 *
 * The refusal was a `suspend` that READ the table and an `acquireRelease` that
 * WROTE it. Effect may hand the fiber over between any two Effects, so two
 * claimants could both find a verb free and both install it — and the dispatch
 * then answered through whichever wrote last. It is one synchronous body now,
 * and there is no point inside one for the runtime to yield.
 *
 * ## Why a SWEEP and not one number
 *
 * The gap is only reachable when the runtime's op budget runs out BETWEEN the
 * two Effects, which happens at one exact op count — the reviewers found it at
 * 2,036 ordinary Effects, and this file found the window to be 2,029 to 2,036.
 * A case that padded to one of those would be a case that stops testing
 * anything the day Effect changes its budget or this module gains a line.
 *
 * So every pad up to a bracket around that budget is swept, and the sweep
 * carries its OWN proof that it reached a yield boundary: {@link gappy} is the
 * shape the finding was about, written out here, and the sweep must catch it.
 * A sweep too short to reach the boundary fails on the canary rather than
 * passing over the subject.
 */
const PADS = 2200

/** N ordinary synchronous Effects — the cost of getting the fiber's op counter
 *  to a chosen distance from its next yield. */
const pad = (n: number) =>
  Effect.forEach(Array.from({ length: n }, (_, at) => at), () => Effect.sync(() => 0), { discard: true })

/** THE SHAPE THE FINDING WAS ABOUT, kept as the sweep's canary: a check in one
 *  Effect and a write in the next. */
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

/** Two claims made at once, `n` ordinary Effects into each fiber — how many
 *  landed. */
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
  // NOT VACUOUS: the gappy shape must be caught somewhere in the range, or the
  // range does not cross the boundary the real cases are swept against.
  expect(landed.length).toBeGreaterThan(0)
  await close(held)
})

test("two rows claiming one verb at the same time: exactly one lands, at every distance from a yield", async () => {
  const { table, stop } = await appTable()
  const held = await scope()
  const doubled: number[] = []
  for (let n = 0; n <= PADS; n++) {
    // A fresh verb per pad, so one iteration's winner is not the next one's
    // refusal — what is being swept is the claim, not the table's history.
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
    // WHOEVER WON, the shared verb has one owner — and `wide` answers only if
    // the wide claim landed. A half-taken wide claim would leave `wide`
    // answering while its own registration had been refused.
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

/** A face drawn with nothing held refuses in the same words rather than
 *  throwing inside a click handler. */
test("the empty table refuses a write and defects on a registration", async () => {
  const refused = await sent(NO_EDITS.write(edit))
  expect(Result.isFailure(refused) && (refused.failure as NotFoundFailure).message)
    .toBe("the capability for title is not active")
  expect(Exit.isFailure(await Effect.runPromise(Effect.exit(
    Effect.scoped(NO_EDITS.register(["title"], writer("no") as never)),
  )))).toBe(true)
})

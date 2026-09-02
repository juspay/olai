/**
 * THE SERVICES' OWN BENCH — what a registration does to the table it writes
 * into, and what it does when the composition root refuses it.
 *
 * The claims in `@olai/bundle` are about the COMPOSITION and the ones in
 * `@olai/server` are about the WIRING; what is left, and what is here, is the
 * one thing neither can ask: whether a service's table tells the truth after a
 * registration that did not take.
 */

import { expect, test } from "bun:test"
import { Context } from "cordis"

import type { SessionStart } from "./services.ts"
import { Kinds, Surfaces } from "./services.ts"

/** What a probe answers on a machine that simply does not have the tool — the
 *  ordinary arm, and the one these cases need because none of them is about
 *  what a probe FOUND. */
const NOTHING_FOUND = { server: null, missing: null }

/** A sibling with nothing on it — what these cases register, since none of them
 *  is about a surface. */
const NOTHING = { surface: { spec: {} }, faces: {}, deps: {} }

/** A context with `surfaces` on it, whose `changed` refuses one name.
 *
 *  A REFUSAL AND NOT A CRASH is what the composition root actually does: the
 *  rooted bundle's `mount` is transactional, so a sibling with deps that do not
 *  match its surface, or a key already mounted, throws out of the re-compose —
 *  which is the callback below, standing in for it. */
const refusing = async (bad: string) => {
  const seen: Array<number> = []
  const ctx = new Context()
  await ctx.plugin(Surfaces, {
    changed: () => {
      seen.push(ctx.surfaces.composed().length)
      if (ctx.surfaces.composed().some((one) => one.name === bad)) {
        throw new Error(`re-compose refuses ${bad}`)
      }
    },
  })
  return { ctx, seen }
}

/** Settle a fiber without letting its own failure escape — `Fiber.await()`
 *  rethrows the error it landed on, and every case here is about the STATE and
 *  the TABLE rather than about that rethrow. */
const settled = async (fiber: { await: () => Promise<unknown> }): Promise<void> => {
  await fiber.await().catch(() => {})
}

/** One plugin that registers a sibling, mounted under `name`. */
const registering = (name: string) => ({
  name,
  inject: ["surfaces"] as const,
  apply(ctx: Context) {
    ctx.surfaces.register(NOTHING)
  },
})

/**
 * A SIBLING THE ROOT REFUSED IS NOT IN THE TABLE, and the plugin that
 * registered it is the only one that fails.
 *
 * ## The defect this is about
 *
 * `register` set the entry, called `changed()`, and returned the disposer. A
 * `changed()` that threw exited the effect body BEFORE the disposer existed, so
 * Cordis had nothing to unwind and the entry stayed. The fiber landed `FAILED`,
 * which is what the containment claim says — and its sibling was still in
 * `composed()`, so the NEXT plugin to register re-ran the re-compose, which
 * retried the bad mount and threw inside THAT plugin's `apply`. One plugin's
 * mis-shaped surface took down every plugin that arrived after it, each of them
 * failing on somebody else's refusal.
 *
 * The claim the phase makes — "a plugin whose `apply` throws installed nothing,
 * and its siblings stay ACTIVE" — was false on exactly this path, which is why
 * it is a case rather than a paragraph.
 */
test("a sibling the composition root refused leaves the table, and takes only its own fiber down", async () => {
  const { ctx, seen } = await refusing("bad")

  const good = ctx.plugin(registering("good"))
  await settled(good)
  const bad = ctx.plugin(registering("bad"))
  await settled(bad)
  const later = ctx.plugin(registering("later"))
  await settled(later)

  // The refused one is gone from the table, so nothing downstream can be told
  // it is composed — the roster reads this list, and a row saying `running`
  // about a sibling with no tag on the wire is the one thing it may not say.
  expect(ctx.surfaces.composed().map((one) => one.name)).toEqual(["good", "later"])

  // ...and the failure is exactly one fiber's. `2` is ACTIVE and `3` is FAILED
  // (Cordis's `FiberState`), read as numbers because the enum is a value the
  // pin exports and the states are what this case is about.
  expect([good.state, bad.state, later.state]).toEqual([2, 3, 2])

  // The re-compose was told about every registration, including the one it
  // refused — so the case is not passing because nothing was ever composed.
  expect(seen.length).toBeGreaterThanOrEqual(3)
})

/**
 * ...AND THE ORDINARY DISPOSE still takes a sibling out, which is what keeps
 * the case above from passing over a `register` that never wrote anything.
 */
test("an unloaded plugin's sibling leaves the table too", async () => {
  const ctx = new Context()
  await ctx.plugin(Surfaces)
  const fiber = ctx.plugin(registering("kolu"))
  await settled(fiber)
  expect(ctx.surfaces.composed().map((one) => one.name)).toEqual(["kolu"])
  await fiber.dispose()
  expect(ctx.surfaces.composed()).toEqual([])
})

/**
 * THE SAME QUESTION ASKED OF `kinds`, because it is the other service whose
 * `register` can refuse — and the answer is different, which is worth pinning
 * rather than leaving a reader to assume symmetry.
 *
 * `Kinds.register` refuses BEFORE it opens an effect (a second claim on one word
 * is a throw with both plugins named), so there is no half-written entry for a
 * throw to leave behind. What this holds is that the refusing fiber's OWN word
 * is not in the table either, and the first plugin's is.
 */
test("a kind refused for collision leaves the first plugin's word standing and adds none", async () => {
  const ctx = new Context()
  await ctx.plugin(Kinds)
  const kind = { kind: "terminal", takes: "a terminal", admits: () => true }
  const first = ctx.plugin({
    name: "kolu",
    inject: ["kinds"] as const,
    apply(inner: Context) {
      inner.kinds.register(kind)
    },
  })
  await settled(first)
  const second = ctx.plugin({
    name: "kolu",
    inject: ["kinds"] as const,
    apply(inner: Context) {
      inner.kinds.register(kind)
    },
  })
  await settled(second)

  expect([...ctx.kinds.table().keys()]).toEqual(["kolu-terminal"])
  expect([first.state, second.state]).toEqual([2, 3])
})

/**
 * A LISTENER THAT AWAITS BEFORE IT CONTRIBUTES IS STILL COUNTED — the
 * `chat/session-start` contract, held where it can be false.
 *
 * ## The defect this is about
 *
 * The composition root fired the waterfall and returned the payload without
 * awaiting the dispatch. That worked, and would go on working, for exactly as
 * long as every listener was synchronous up to its `next()`: cordis runs the
 * chain inline, so the pushes land before the caller's next statement.
 *
 * A plugin written `async (start, next) => { await something; start.asking.push(…) }`
 * would be silently absent from EVERY session, for ever, with nothing red — on
 * the one path whose whole subject is a tool that is missing. That is a
 * contract nobody told a plugin author about, enforced by a coincidence.
 *
 * So the dispatch is awaited and this is the case that says so. It is a
 * property of the EVENT rather than of the root, which is why it is asked here:
 * the payload is the interface's, the shape is the interface's, and a second
 * composition root would have to get it right too.
 */
test("an async listener's contribution is on the list, not dropped", async () => {
  const ctx = new Context()
  const order: Array<string> = []

  await ctx.plugin({
    name: "prompt",
    apply(inner: Context) {
      inner.on("chat/session-start", (start, next) => {
        order.push("prompt")
        start.asking.push({ name: "prompt", ask: () => Promise.resolve(NOTHING_FOUND) })
        return next()
      })
    },
  })
  await ctx.plugin({
    name: "slow",
    apply(inner: Context) {
      inner.on("chat/session-start", async (start, next) => {
        // A yield of any kind before the push — which is what a listener that
        // read a file, or asked another service, would do.
        await Promise.resolve()
        order.push("slow")
        start.asking.push({ name: "slow", ask: () => Promise.resolve(NOTHING_FOUND) })
        return next()
      })
    },
  })

  const start: SessionStart = { asking: [] }
  await ctx.waterfall("chat/session-start", start, async () => start)

  // BOTH, and in dispatch order — which is registration order, which is the
  // bundle's. A roster that reshuffled itself per conversation would be a panel
  // nobody can read twice.
  expect(start.asking.map((one) => one.name)).toEqual(["prompt", "slow"])
  expect(order).toEqual(["prompt", "slow"])
})

/** ...and a plugin that has unloaded contributes nothing to the next session,
 *  which is the whole reason the list is collected per dispatch rather than
 *  once at boot. */
test("an unloaded plugin is off the next session's list", async () => {
  const ctx = new Context()
  const fiber = ctx.plugin({
    name: "kolu",
    apply(inner: Context) {
      inner.on("chat/session-start", (start, next) => {
        start.asking.push({ name: "kolu", ask: () => Promise.resolve(NOTHING_FOUND) })
        return next()
      })
    },
  })
  await settled(fiber)

  const first: SessionStart = { asking: [] }
  await ctx.waterfall("chat/session-start", first, async () => first)
  expect(first.asking.map((one) => one.name)).toEqual(["kolu"])

  await fiber.dispose()
  const second: SessionStart = { asking: [] }
  await ctx.waterfall("chat/session-start", second, async () => second)
  expect(second.asking).toEqual([])
})

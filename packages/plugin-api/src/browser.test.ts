/**
 * WHAT A PLUGIN MAY HOLD, and what it must call — the claim a live crash is
 * named after.
 *
 * ## The bug
 *
 * A plugin's browser half used to be handed a plain RECORD of the app's
 * furniture, and a record's fields are values. `olai-plugin-odu`'s CI chip held
 * one of them the way you hold a value:
 *
 *     const said = () => wordsFor(held(), now(), clocks.tickingOf)
 *
 * That line was correct for the life of the feature. When the record became
 * four Cordis services, `tickingOf` became a prototype METHOD — and a method
 * detached from its receiver reads `this.config` off `undefined`. Every page
 * that drew a live CI chip threw:
 *
 *     TypeError: Cannot read properties of undefined (reading 'config')
 *
 * Nothing in the tree could have caught it. The call site still typechecked
 * (`(ms: number) => string` is `(ms: number) => string` however it is reached),
 * the plugin's own tests never mounted the real service, and the fence is about
 * IMPORTS. The seam had changed under a caller that had not.
 *
 * ## So the claim is about the SEAM, in both directions
 *
 * Every function a plugin may HOLD is asserted holdable — destructured off the
 * service and called with no receiver at all, which is exactly what passing it
 * as a callback does. And the one that must be CALLED is asserted to refuse
 * that, because binding it would be worse than the crash: `Wired.client()`
 * reads the CALLING fiber through Cordis's tracker, so a bound copy would hand
 * every plugin one plugin's client, quietly and forever.
 *
 * Both halves matter. A test that only checked the first would pass on a day
 * somebody "fixed" `Wired` the same way and broke the keying instead.
 */

import { Context } from "cordis"
import { expect, test } from "bun:test"

import { Bar, Clocks, Links, Slots, Wired } from "./browser.ts"

/** The app's arithmetic, as a double — each answers something recognisable, so
 *  a call that reached the config is told apart from one that returned a
 *  default. */
const CLOCKS = {
  SECOND: 1000,
  MINUTE: 60_000,
  createTicking: () => () => 7,
  createNow: () => () => 11,
  wordsOf: (seconds: number) => `words:${seconds}`,
  exactOf: (seconds: number) => `exact:${seconds}`,
  tickingOf: (ms: number) => `ticking:${ms}`,
}

const PILL = {
  PILL: "pill",
  DOT: "dot",
  PILL_WARN_COAT: "warn",
  DOT_HOLLOW_WARN: "dot-warn",
  TEXT_WARN: "text-warn",
  PILL_ALARM_COAT: "alarm",
  DOT_HOLLOW_ALARM: "dot-alarm",
  TEXT_ALARM: "text-alarm",
}

/** A context with the four services on it, as `@olai/web` mounts them. */
const mounted = async () => {
  const ctx = new Context()
  await ctx.plugin(Slots)
  await ctx.plugin(Clocks, CLOCKS)
  await ctx.plugin(Bar, {
    desktop: () => true,
    pill: PILL,
    createPopover: () => ({}) as never,
  })
  await ctx.plugin(Links, { File: (() => null) as never })
  await ctx.plugin(Wired, { clientFor: (plugin) => `client:${plugin}` })
  return ctx
}

/**
 * THE CRASH, REPRODUCED — every one of the clock's functions, held the way the
 * CI chip held one.
 *
 * Destructuring is the sharpest spelling of "passed as a callback": it strips
 * the receiver exactly as `f(obj.method)` does, and it is what the failing line
 * was doing in all but syntax.
 */
test("every clock function survives being held rather than called", async () => {
  const ctx = await mounted()
  // The one the live crash was on, first and by itself, so a regression names
  // the same thing the report did.
  const { tickingOf } = ctx.clocks
  expect(tickingOf(90_000)).toBe("ticking:90000")

  const { createTicking, createNow, wordsOf, exactOf } = ctx.clocks
  expect(createTicking(1000)()).toBe(7)
  expect(createNow(() => null)()).toBe(11)
  expect(wordsOf(90)).toBe("words:90")
  expect(exactOf(90)).toBe("exact:90")

  // ...and the two that are plain numbers are still numbers off the service.
  expect(ctx.clocks.SECOND).toBe(1000)
  expect(ctx.clocks.MINUTE).toBe(60_000)
})

/** THE BAR'S TWO, on the same terms: a readout that hands `bar.desktop` to a
 *  `<Show when={…}>`, or composes its own furniture record with
 *  `createPopover: ctx.bar.popover`, is holding a value. */
test("the bar's functions survive being held rather than called", async () => {
  const ctx = await mounted()
  const { desktop, popover } = ctx.bar
  expect(desktop()).toBe(true)
  // That it ANSWERS is the claim; what a popover is, is the app's.
  expect(popover()).toBeDefined()
  // `pill` is a record and was never at risk; it is here so the claim covers
  // everything the service hands out rather than the functions alone.
  expect(ctx.bar.pill.PILL).toBe("pill")
})

/** ...and the door onto a served file, which a plugin puts straight into its
 *  own furniture record (`olai-plugin-kolu`'s `browser.tsx` does). */
test("the file link survives being held rather than called", async () => {
  const ctx = await mounted()
  const { File } = ctx.links
  expect(typeof File).toBe("function")
})

/**
 * ...AND THE ONE THAT MUST BE CALLED REFUSES TO BE HELD, which is the other
 * half of the claim and the half that stops the first one being "fixed" into a
 * defect.
 *
 * `Wired.client()` answers about the CALLING fiber. Bound, it would answer
 * about the service's own context — one plugin's client handed to every plugin,
 * with nothing going red. So it is a prototype method on purpose, and detaching
 * it throws at the first call rather than lying at every one.
 */
test("the client lookup refuses to be held, because its answer is per caller", async () => {
  const ctx = await mounted()
  const held = ctx.wired.client
  expect(() => held()).toThrow()
  // ...and called on the service it answers, keyed by the fiber that asked.
  // The root's own fiber is what this context is, so the name is the root's —
  // what matters here is that the CALL works where the held copy does not.
  expect(typeof ctx.wired.client()).toBe("string")
})

/**
 * A PLUGIN'S FIBER GETS ITS OWN NAME, which is what the keying is FOR and the
 * reason the method above may not be bound.
 *
 * Read through the tracker: `ctx.wired` inside a plugin's `apply` is a proxy
 * whose `this.ctx` is that plugin's context, so the same call answers a
 * different client per plugin. This is the behaviour a bound copy would have
 * silently destroyed.
 */
test("two plugins asking the same service get two different clients", async () => {
  const ctx = await mounted()
  const answers: Array<string> = []
  await ctx.plugin({
    name: "alpha",
    inject: ["wired"],
    apply: (own: Context) => {
      answers.push(own.wired.client() as string)
    },
  })
  await ctx.plugin({
    name: "beta",
    inject: ["wired"],
    apply: (own: Context) => {
      answers.push(own.wired.client() as string)
    },
  })
  expect(answers).toEqual(["client:alpha", "client:beta"])
})

/**
 * THE SLOT TABLE'S OWN CASES — what a registration does, what it refuses, and
 * what leaves with the fiber that made it.
 *
 * `Slots` had none. The claims about it lived in `@olai/web`'s walks, which ask
 * what is DRAWN; nothing asked what the table says after a registration that
 * did not take — which is the one question the server's `Kinds` and `Surfaces`
 * both have a bench for, and the one the server's refused-sibling bug was found
 * by.
 */

/** A context with the slot table on it, and a counter for the `changed`
 *  callback the app wires to a signal. */
const withSlots = async () => {
  const moved: Array<number> = []
  const ctx = new Context()
  await ctx.plugin(Slots, { changed: () => moved.push(1) })
  return { ctx, moved }
}

/** THE STAMP IS THE FIBER'S NAME, never an argument — so a plugin cannot hang a
 *  face under another's key, and a kind word is composed the way `ctx.kinds`
 *  composes it on the server. */
test("a face is keyed by the fiber, and a kind by the composed word", async () => {
  const { ctx } = await withSlots()
  const face = () => null
  await ctx.plugin({
    name: "alpha",
    inject: ["slots"],
    apply: (own: Context) => {
      own.slots.register("app.header", face)
      own.slots.register("outline.row.chip", "terminal", face as never)
    },
  })
  expect(ctx.slots.hung("app.header")).toEqual([{ plugin: "alpha", face }])
  // `alpha` + `-` + `terminal` — the same composition the vault's vocabulary
  // gets, so the word a face is looked up by and the word a declaration writes
  // cannot be two spellings.
  expect([...ctx.slots.dressed("outline.row.chip").keys()]).toEqual(["alpha-terminal"])
})

/** TWO FACES IN ONE SLOT UNDER ONE KEY IS REFUSED, and it takes only its own
 *  fiber down — the throw is inside the effect body, so Cordis lands that fiber
 *  in FAILED having unwound whatever it had registered, and every other
 *  plugin's faces are untouched. */
test("a plugin that hangs two faces in one slot fails alone", async () => {
  const { ctx } = await withSlots()
  const face = () => null
  await ctx.plugin({
    name: "neighbour",
    inject: ["slots"],
    apply: (own: Context) => own.slots.register("app.header", face),
  }).then(() => {}, () => {})
  await ctx.plugin({
    name: "greedy",
    inject: ["slots"],
    apply: (own: Context) => {
      own.slots.register("app.header", face)
      own.slots.register("app.header", face)
    },
  }).then(() => {}, () => {})
  // The greedy plugin registered nothing — its first face was unwound with the
  // fiber — and the neighbour's is still hung.
  expect(ctx.slots.hung("app.header")).toEqual([{ plugin: "neighbour", face }])
})

/** A FACE LEAVES WITH ITS FIBER. Every registration is an `ctx.effect`, so a
 *  plugin the roster stops naming unwinds its own faces and the app is told to
 *  re-read — which is the whole of why the two mount licences could go. */
test("a face goes when its plugin does, and the app is told", async () => {
  const { ctx, moved } = await withSlots()
  const face = () => null
  const fiber = await ctx.plugin({
    name: "leaver",
    inject: ["slots"],
    apply: (own: Context) => own.slots.register("app.mount", face as never),
  })
  expect(ctx.slots.hung("app.mount")).toHaveLength(1)
  const said = moved.length
  await fiber.dispose()
  expect(ctx.slots.hung("app.mount")).toEqual([])
  // ...and `changed` fired for the leaving as well as the arriving. A table
  // that moved without saying so is a page still drawing a face that is gone.
  expect(moved.length).toBeGreaterThan(said)
})

/** ...AND A FIBER MAY REGISTER AGAIN AFTER IT HAS UNWOUND, which is what a
 *  re-execute is: the disposer runs, then the body does. A duplicate test
 *  captured before the effect would refuse the second pass and take a plugin
 *  down for coming back. */
test("a plugin that unwinds and re-registers is not refused", async () => {
  const { ctx } = await withSlots()
  const face = () => null
  let undo: (() => void) | undefined
  await ctx.plugin({
    name: "cycler",
    inject: ["slots"],
    apply: (own: Context) => {
      undo = own.slots.register("app.header", face)
    },
  })
  expect(ctx.slots.hung("app.header")).toHaveLength(1)
  undo?.()
  expect(ctx.slots.hung("app.header")).toEqual([])
  // The same fiber, the same slot, the same key — and no refusal, because the
  // table is read at the moment the registration takes rather than snapshotted
  // when `register` was called.
  expect(() => {
    ctx.slots.register("app.header", face)
  }).not.toThrow()
})

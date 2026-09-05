/**
 * WHAT A PLUGIN IS HANDED IN THE TAB — the app's furniture, the client keyed by
 * the plugin that asks, and the slot table's own arithmetic.
 *
 * ## The bug this file is named after, and what became of it
 *
 * A plugin's browser half used to be handed a plain RECORD of the app's
 * furniture, and a record's fields are values. `olai-plugin-odu`'s CI chip held
 * one of them the way you hold a value:
 *
 *     const said = () => wordsFor(held(), now(), clocks.tickingOf)
 *
 * That line was correct for the life of the feature. When the record became four
 * Cordis service CLASSES, `tickingOf` became a prototype METHOD — and a method
 * detached from its receiver reads `this.config` off `undefined`. Every page
 * that drew a live CI chip threw:
 *
 *     TypeError: Cannot read properties of undefined (reading 'config')
 *
 * Nothing in the tree could have caught it. The call site still typechecked, the
 * plugin's own tests never mounted the real service, and the fence is about
 * IMPORTS. The seam had changed under a caller that had not.
 *
 * The classes are gone: a tag's shape IS the record, provided as one. So the
 * hazard is unspellable rather than merely tested for — and the cases below stay
 * anyway, because what they hold is the SEAM's promise and not the mechanism
 * that happened to keep it. A day somebody wraps one of these in a class again
 * is a day this file goes red.
 */

import { expect, test } from "bun:test"
import { Effect, Scope } from "effect"

import {
  Bar,
  Clocks,
  definePlugin,
  Faces,
  Links,
  mountPlugin,
  openApp,
  Slots,
  standing,
  Wired,
} from "./browser.ts"

/** The app's arithmetic, as a double — each answers something recognisable, so a
 *  call that reached the real value is told apart from one that returned a
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

/** A tab's runtime with the furniture on it, as `@olai/web` opens one. The
 *  Effects run at the EDGE: a case is an ordinary `async` test. */
const opened = async (changed?: () => void, reading?: () => void) => {
  const run = standing()
  const app = await run(
    openApp({ changed, reading, clientFor: (plugin) => `client:${plugin}` }),
  )
  await run(app.furnish({
    clocks: CLOCKS,
    bar: { desktop: () => true, pill: PILL, popover: () => ({}) as never },
    links: { File: (() => null) as never },
  }))
  return { app, run }
}

/**
 * THE CRASH, REPRODUCED — every one of the clock's functions, held the way the
 * CI chip held one.
 *
 * Destructuring is the sharpest spelling of "passed as a callback": it strips the
 * receiver exactly as `f(obj.method)` does, and it is what the failing line was
 * doing in all but syntax.
 */
test("every clock function survives being held rather than called", async () => {
  const { app, run } = await opened()
  const said: Array<unknown> = []
  await run(mountPlugin(
    app.host,
    definePlugin({
      name: "alpha",
      needs: [Clocks],
      apply: Effect.gen(function*() {
        const clocks = yield* Clocks
        // The one the live crash was on, first and by itself, so a regression
        // names the same thing the report did.
        const { tickingOf } = clocks
        const { createTicking, createNow, wordsOf, exactOf } = clocks
        said.push([
          tickingOf(90_000),
          createTicking(1000)(),
          createNow(() => null)(),
          wordsOf(90),
          exactOf(90),
          clocks.SECOND,
          clocks.MINUTE,
        ])
      }),
    }),
  ))
  expect(said[0]).toEqual(["ticking:90000", 7, 11, "words:90", "exact:90", 1000, 60_000])
})

/** THE BAR'S TWO AND THE FILE DOOR, on the same terms: a readout that hands
 *  `bar.desktop` to a `<Show when={…}>`, or composes its own furniture record out
 *  of `popover`, is holding a value. */
test("the bar's functions and the file link survive being held", async () => {
  const { app, run } = await opened()
  const said: Array<unknown> = []
  await run(mountPlugin(
    app.host,
    definePlugin({
      name: "alpha",
      needs: [Bar, Links],
      apply: Effect.gen(function*() {
        const { desktop, popover, pill } = yield* Bar
        const { File } = yield* Links
        said.push([desktop(), popover() !== undefined, pill.PILL, typeof File])
      }),
    }),
  ))
  expect(said[0]).toEqual([true, true, "pill", "function"])
})

/**
 * A PLUGIN GETS ITS OWN CLIENT, which is what the keying is FOR.
 *
 * It used to be a prototype method deliberately left UNBOUND, because it read
 * the calling fiber off a tracker proxy and a bound copy would have handed every
 * plugin one plugin's client — quietly, and forever. There is no proxy: the
 * client was resolved from this plugin's own word before the plugin ever ran, so
 * holding it is exactly as correct as calling it in place. Both halves are held
 * here, because the point was never the binding — it was that the answer depends
 * on who is asking.
 */
test("two plugins asking the same service get two different clients, held or called", async () => {
  const { app, run } = await opened()
  const answers: Array<string> = []
  for (const name of ["alpha", "beta"]) {
    await run(mountPlugin(
      app.host,
      definePlugin({
        name,
        needs: [Wired],
        apply: Effect.gen(function*() {
          const wired = yield* Wired
          answers.push(wired.client() as string)
          // ...and held, which is the shape the old service had to refuse.
          const held = wired.client
          answers.push(held() as string)
        }),
      }),
    ))
  }
  expect(answers).toEqual(["client:alpha", "client:alpha", "client:beta", "client:beta"])
})

/**
 * THE SLOT TABLE'S OWN CASES — what a registration does, what it refuses, and
 * what leaves with the plugin that made it.
 *
 * `Slots` had none. The claims about it lived in `@olai/web`'s walks, which ask
 * what is DRAWN; nothing asked what the table says after a registration that did
 * not take — which is the one question the server's `Kinds` and `Surfaces` both
 * have a bench for, and the one the server's refused-sibling bug was found by.
 */

/** THE STAMP IS THE PLUGIN'S NAME, never an argument — so a plugin cannot hang a
 *  face under another's key, and a kind word is composed the way the server's
 *  `Kinds` composes it. */
test("a face is keyed by the plugin, and a kind by the composed word", async () => {
  const { app, run } = await opened()
  const face = { place: "cluster", body: () => null } as const
  await run(mountPlugin(
    app.host,
    definePlugin({
      name: "alpha",
      needs: [Slots],
      apply: Effect.gen(function*() {
        const slots = yield* Slots
        yield* slots.register("app.header", face)
        yield* slots.register("outline.row.chip", "terminal", face as never)
      }),
    }),
  ))
  expect(app.hung("app.header")).toEqual([{ plugin: "alpha", face }])
  // `alpha` + `-` + `terminal` — the same composition the vault's vocabulary
  // gets, so the word a face is looked up by and the word a declaration writes
  // cannot be two spellings.
  expect([...app.dressed("outline.row.chip").keys()]).toEqual(["alpha-terminal"])
})

/** TWO FACES IN ONE SLOT UNDER ONE KEY IS REFUSED, and it takes only its own
 *  plugin down — the refusal dies inside `acquire`, so the runtime lands that
 *  plugin in `failed` having unwound whatever it had registered, and every other
 *  plugin's faces are untouched. */
test("a plugin that hangs two faces in one slot fails alone", async () => {
  const { app, run } = await opened()
  const face = { place: "cluster", body: () => null } as const
  await run(mountPlugin(
    app.host,
    definePlugin({
      name: "neighbour",
      needs: [Slots],
      apply: Effect.gen(function*() {
        yield* (yield* Slots).register("app.header", face)
      }),
    }),
  ))
  const greedy = await run(mountPlugin(
    app.host,
    definePlugin({
      name: "greedy",
      needs: [Slots],
      apply: Effect.gen(function*() {
        const slots = yield* Slots
        yield* slots.register("app.header", face)
        yield* slots.register("app.header", face)
      }),
    }),
  ))
  expect((await run(greedy.report)).state).toBe("failed")
  // The greedy plugin registered nothing — its first face was unwound with it —
  // and the neighbour's is still hung.
  expect(app.hung("app.header")).toEqual([{ plugin: "neighbour", face }])
})

/** A FACE LEAVES WITH ITS PLUGIN. Every registration is a finalizer on that
 *  plugin's scope, so a plugin the roster stops naming unwinds its own faces and
 *  the app is told to re-read — which is the whole of why the two mount licences
 *  could go. */
test("a face goes when its plugin does, and the app is told", async () => {
  const moved: Array<number> = []
  const { app, run } = await opened(() => moved.push(1))
  const face = { place: "cluster", body: () => null } as const
  const leaver = await run(mountPlugin(
    app.host,
    definePlugin({
      name: "leaver",
      needs: [Slots],
      apply: Effect.gen(function*() {
        yield* (yield* Slots).register("app.mount", face as never)
      }),
    }),
  ))
  expect(app.hung("app.mount")).toHaveLength(1)
  const said = moved.length
  await run(leaver.dispose)
  expect(app.hung("app.mount")).toEqual([])
  // ...and `changed` fired for the leaving as well as the arriving. A table that
  // moved without saying so is a page still drawing a face that is gone.
  expect(moved.length).toBeGreaterThan(said)
})

/** ...AND A PLUGIN MAY COME BACK, which is what a re-apply is: the finalizers
 *  run, then the body does. A duplicate test captured where `register` was CALLED
 *  would refuse the second pass and take a plugin down for coming back. */
test("a plugin that unwinds and re-registers is not refused", async () => {
  const { app, run } = await opened()
  const face = { place: "cluster", body: () => null } as const
  const cycler = definePlugin({
    name: "cycler",
    needs: [Slots],
    apply: Effect.gen(function*() {
      yield* (yield* Slots).register("app.header", face)
    }),
  })
  const first = await run(mountPlugin(app.host, cycler))
  expect(app.hung("app.header")).toHaveLength(1)
  await run(first.dispose)
  expect(app.hung("app.header")).toEqual([])
  // The same plugin, the same slot, the same key — and no refusal, because the
  // table is read at the moment the registration takes rather than snapshotted
  // when `register` was called.
  const again = await run(mountPlugin(app.host, cycler))
  expect((await run(again.report)).state).toBe("running")
  expect(app.hung("app.header")).toHaveLength(1)
})

/**
 * A FACE THE APP REFUSED LEAVES THE TABLE, and the plugin that hung it is the
 * only one that fails.
 *
 * ## The defect this is about
 *
 * `register` set the entry and then told the app it had changed, from inside
 * `acquire`. A failure in `acquire` is a resource that was never acquired, so
 * the release never runs — which means an app that REFUSES (a re-read that
 * throws) left the face in the table while the plugin landed `failed`. The next
 * plugin to register would then be drawn over a table still holding a face
 * nothing mounted.
 *
 * The server's sibling table documented that rule at length and this one had the
 * same reachable failure with no comment near it. It is `@olai/effect-cordis`'s
 * `registry` for both now, so the rule is mechanical rather than remembered —
 * and this is the case that says so on the side that was missing it.
 */
test("a face the app refused leaves the table, and takes only its own plugin down", async () => {
  const face = { place: "cluster", body: () => null } as const
  let refusing = false
  const { app, run } = await opened(() => {
    if (refusing) throw new Error("the app refuses this frame")
  })
  await run(mountPlugin(
    app.host,
    definePlugin({
      name: "neighbour",
      needs: [Slots],
      apply: Effect.gen(function*() {
        yield* (yield* Slots).register("app.header", face)
      }),
    }),
  ))
  refusing = true
  const refused = await run(mountPlugin(
    app.host,
    definePlugin({
      name: "refused",
      needs: [Slots],
      apply: Effect.gen(function*() {
        yield* (yield* Slots).register("app.header", face)
      }),
    }),
  ))
  expect((await run(refused.report)).state).toBe("failed")
  // The refused face is gone from the table, so nothing downstream can draw it
  // — and the neighbour's is untouched.
  expect(app.hung("app.header")).toEqual([{ plugin: "neighbour", face }])
})

/**
 * THE OTHER TWO CARDINALITIES — a LIST, where one plugin may hang as many as it
 * has, and a SINGLE, where the whole app has room for one.
 *
 * Neither was expressible while every slot was one face per key: a plugin's
 * second sidebar section landed it in `failed` with the duplicate message, and
 * "one panel across all plugins" had no key that two plugins could both claim.
 * The cases below are the two halves of that — that a list refuses nothing, and
 * that the single slot refuses in words a reader can act on.
 */

/** A LIST TAKES AS MANY AS ARRIVE, from one plugin or from several, in the order
 *  they were hung — the arrival order the table promises, which `@olai/web`
 *  re-sorts by the bundle's rank at the read. */
test("a list slot takes every face a plugin hangs, and each carries its name", async () => {
  const { app, run } = await opened()
  const section = (said: string) => ({ said, body: () => null })
  await run(mountPlugin(
    app.host,
    definePlugin({
      name: "alpha",
      needs: [Slots],
      apply: Effect.gen(function*() {
        const slots = yield* Slots
        yield* slots.register("sidebar.section", section("one"))
        yield* slots.register("sidebar.section", section("other"))
      }),
    }),
  ))
  await run(mountPlugin(
    app.host,
    definePlugin({
      name: "beta",
      needs: [Slots],
      apply: Effect.gen(function*() {
        yield* (yield* Slots).register("sidebar.section", section("beta's"))
      }),
    }),
  ))
  // Both of alpha's, and neither took the other down — which is the whole
  // difference between this and a keyed slot.
  expect(app.hung("sidebar.section").map((one) => [one.plugin, one.face.said])).toEqual([
    ["alpha", "one"],
    ["alpha", "other"],
    ["beta", "beta's"],
  ])
})

/** ...AND A LIST ENTRY LEAVES WITH ITS PLUGIN, and the app is told — which is
 *  the `changed` the roster underneath was written without. A list a page draws
 *  from that moved without saying so is a section on screen after its plugin
 *  unloaded. */
test("a list face goes when its plugin does, and the app is told", async () => {
  const moved: Array<number> = []
  const { app, run } = await opened(() => moved.push(1))
  const leaver = await run(mountPlugin(
    app.host,
    definePlugin({
      name: "leaver",
      needs: [Slots],
      apply: Effect.gen(function*() {
        const slots = yield* Slots
        yield* slots.register("sidebar.section", { said: "one", body: () => null })
        yield* slots.register("sidebar.section", { said: "other", body: () => null })
      }),
    }),
  ))
  expect(app.hung("sidebar.section")).toHaveLength(2)
  // Told on the way IN, once per entry: a page that drew after the first would
  // otherwise never hear about the second.
  expect(moved.length).toBe(2)
  await run(leaver.dispose)
  expect(app.hung("sidebar.section")).toEqual([])
  expect(moved.length).toBe(4)
})

/** THE APP'S ONE PANEL IS ONE, whoever asks — and the refusal names BOTH
 *  plugins, because the key is the slot's own name and carries neither. A
 *  sentence naming only the loser tells a reader nothing about what to take
 *  out. */
test("a second plugin claiming the app's single slot is refused, naming both", async () => {
  const { app, run } = await opened()
  const panel = () => null
  await run(mountPlugin(
    app.host,
    definePlugin({
      name: "alpha",
      needs: [Slots],
      apply: Effect.gen(function*() {
        yield* (yield* Slots).register("app.panel", panel)
      }),
    }),
  ))
  const second = await run(mountPlugin(
    app.host,
    definePlugin({
      name: "beta",
      needs: [Slots],
      apply: Effect.gen(function*() {
        yield* (yield* Slots).register("app.panel", () => null)
      }),
    }),
  ))
  const report = await run(second.report)
  expect(report.state).toBe("failed")
  const fault = report.state === "failed" ? report.fault ?? "" : ""
  expect(fault).toContain("beta")
  expect(fault).toContain("alpha")
  expect(fault).toContain("app.panel")
  // ...and the seat is still alpha's, with the plugin's word on the row: `only`
  // answers one face and not an array, because "there is at most one" is the
  // thing the slot exists to say.
  expect(app.only("app.panel")).toEqual({ plugin: "alpha", face: panel })
})

/** AN UNOCCUPIED SLOT IS A LEGITIMATE STATE — a serve running one plugin has
 *  nobody in most of this table, and every read answers its own empty rather
 *  than failing or handing back `undefined` for a caller to test. */
test("a slot nobody has hung a face in reads empty, whatever its cardinality", async () => {
  const { app } = await opened()
  expect(app.hung("app.header")).toEqual([])
  expect(app.hung("app.keys")).toEqual([])
  expect(app.dressed("outline.row.chip").size).toBe(0)
  expect(app.hung("outline.row.door")).toEqual([])
  expect(app.only("app.panel")).toBe(null)
})

/**
 * A PLUGIN READS A SLOT IT DOES NOT OWN — the door the chat panel becomes the
 * far side of.
 *
 * Six plugins hang a mark and the panel that draws all six is about to be a
 * seventh plugin, which no shape in this file could spell while `Slots` had a
 * `register` and nothing else. What is held here is that the reader sees the
 * REGISTRATIONS and not a privileged view of anything: the same three reads the
 * tab has, off the same tables, with the registering plugin's word beside each
 * face and no way to write one.
 */
test("a plugin reads what other plugins hung, and its read is tracked like the app's", async () => {
  const reads: Array<number> = []
  const { app, run } = await opened(undefined, () => reads.push(1))
  const mark = () => null
  await run(mountPlugin(
    app.host,
    definePlugin({
      name: "alpha",
      needs: [Slots],
      apply: Effect.gen(function*() {
        yield* (yield* Slots).register("delivery.mark", mark)
      }),
    }),
  ))
  const seen: Array<unknown> = []
  await run(mountPlugin(
    app.host,
    definePlugin({
      name: "reader",
      needs: [Faces],
      apply: Effect.gen(function*() {
        const faces = yield* Faces
        seen.push(faces.hung("delivery.mark"))
        // ...and nothing on this door writes: a reader has `hung`, `dressed` and
        // `only`, and `register` is on the other tag, keyed by the fiber that
        // calls it.
        seen.push("register" in faces)
      }),
    }),
  ))
  expect(seen[0]).toEqual([{ plugin: "alpha", face: mark }])
  expect(seen[1]).toBe(false)
  // The app was told the read happened, which is how a plugin's draw re-runs
  // when a sibling arrives or leaves — the signal is `@olai/web`'s and this
  // runtime has still never heard of Solid.
  expect(reads.length).toBeGreaterThan(0)
})

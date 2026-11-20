import { installTestRenderer } from "./browser.testlib.ts"
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

const CLOCKS = {
  today: () => "2026-09-07",
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
}

const opened = async (changed?: () => void, reading?: () => void) => {
  const run = standing()
  const app = await run(
    openApp({ changed, reading, clientFor: (plugin) => `client:${plugin}` }),
  )
  const store = await run(installTestRenderer(app, changed, reading))
  await run(app.supply(Clocks, CLOCKS))
  await run(app.supply(Bar, { desktop: () => true, pill: PILL, popover: () => ({}) as never }))
  await run(app.supply(Links, { File: (() => null) as never }))
  return { app, store, run: async <A>(effect: Effect.Effect<A, never, Scope.Scope>) => {
    const result = await run(effect)
    await run(store.settled)
    return result
  } }
}

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
          const held = wired.client
          answers.push(held() as string)
        }),
      }),
    ))
  }
  expect(answers).toEqual(["client:alpha", "client:alpha", "client:beta", "client:beta"])
})

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
  expect([...app.dressed("outline.row.chip").keys()]).toEqual(["alpha-terminal"])
})

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
  expect(app.hung("app.header")).toEqual([{ plugin: "neighbour", face }])
})

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
  expect(moved.length).toBeGreaterThan(said)
})

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
  const again = await run(mountPlugin(app.host, cycler))
  expect((await run(again.report)).state).toBe("running")
  expect(app.hung("app.header")).toHaveLength(1)
})

test("a refused face leaves the registry and fails only its integration", async () => {
  const face = { place: "cluster", body: () => null } as const
  let refusing = false
  const { app, store, run } = await opened(() => {
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
  expect((await run(refused.report)).state).toBe("running")
  expect(store.inspect().find((entry) => entry.owner === "refused")?.state).toBe("failed")
  expect(app.hung("app.header")).toEqual([{ plugin: "neighbour", face }])
})

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
  expect(app.hung("sidebar.section").map((one) => [one.plugin, one.face.said])).toEqual([
    ["alpha", "one"],
    ["alpha", "other"],
    ["beta", "beta's"],
  ])
})

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
  const arrivals = moved.length
  expect(arrivals).toBeGreaterThanOrEqual(2)
  await run(leaver.dispose)
  expect(app.hung("sidebar.section")).toEqual([])
  expect(moved.length).toBeGreaterThan(arrivals)
})

test("a second plugin claiming the app's single slot is refused, naming both", async () => {
  const { app, run } = await opened()
  const panel = () => null
  await run(mountPlugin(
    app.host,
    definePlugin({
      name: "alpha",
      needs: [Slots],
      apply: Effect.gen(function*() {
        yield* (yield* Slots).register("app.viewer", panel)
      }),
    }),
  ))
  const second = await run(mountPlugin(
    app.host,
    definePlugin({
      name: "beta",
      needs: [Slots],
      apply: Effect.gen(function*() {
        yield* (yield* Slots).register("app.viewer", () => null)
      }),
    }),
  ))
  const report = await run(second.report)
  expect(report.state).toBe("failed")
  const fault = report.state === "failed" ? report.fault ?? "" : ""
  expect(fault).toContain("beta")
  expect(fault).toContain("alpha")
  expect(fault).toContain("app.viewer")
  expect(app.only("app.viewer")).toEqual({ plugin: "alpha", face: panel })
})

test("a slot nobody has hung a face in reads empty, whatever its cardinality", async () => {
  const { app } = await opened()
  expect(app.hung("app.header")).toEqual([])
  expect(app.hung("app.keys")).toEqual([])
  expect(app.dressed("outline.row.chip").size).toBe(0)
  expect(app.only("app.viewer")).toBe(null)
})

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
        seen.push("register" in faces)
      }),
    }),
  ))
  expect(seen[0]).toEqual([{ plugin: "alpha", face: mark }])
  expect(seen[1]).toBe(false)
  expect(reads.length).toBeGreaterThan(0)
})

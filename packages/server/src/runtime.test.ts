import { selectFixtureRows } from "@olai/bundle/testlib"
import { VaultBoot } from "olai-plugin-vault/boot"
import { CONTENT_ROWS } from "./capabilities.testlib.ts"
import { TestClock } from "effect/testing"
import { runtimePaths } from "./runtime-paths.ts"
import { mountBundle, offered as door, provide, settled } from "@olai/bundle/bundle"
import { openPlugins as openHostPlugins, Directory, Ops as OpsDoor } from "@olai/plugin-api/services"
import { openTestPlugins as openPlugins } from "@olai/plugin-api/testlib"
import {
  type Ops,
  type Store as OutlineStore,
} from "@olai/ops"
import type { App, BuiltPlugin, PluginRoster } from "@olai/surface"
import type { DocumentEntry } from "olai-plugin-markdown/wire"
import type { Head, Manifest } from "olai-plugin-vault/wire"
import type { Shelf } from "@olai/format"
import { NO_ROSTER } from "@olai/surface"
import { DEFAULT_BUNDLE_NAMES } from "@olai/bundle"
import type { RowReport } from "@olai/bundle/bundle"
import { BUNDLE_NAMES as PLUGIN_NAMES } from "@olai/bundle"
import type { Leg } from "@kolu/acp/engine"
import type { Plugins } from "@olai/plugin-api/services"
import {
  Agents,
  definePlugin,
  mountPlugin,
  Offers,

  rowReport,
  standing,
  Surfaces,
  Wakes,
} from "@olai/plugin-api/services"
import type { CollectionDeltasMsg } from "@kolu/surface/define"
import { defineSurface } from "@kolu/surface/define"
import { restrictHandlers } from "@kolu/surface/expose"
import { inMemoryStore } from "@kolu/surface/server"
import { NodeServices } from "@effect/platform-node"
import { expect, mock, test } from "bun:test"
import { Effect, Fiber, Queue, Schema, Scope, Stream } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { watchFault } from "./fault.ts"
import { hostname } from "./hostname.ts"
import { type Bound, bind, type PluginRuntime, rosterOf, writerAt } from "./runtime.ts"

const STARTED = "2026-08-29T09:31:00.000Z"

const withRuntime = <A>(
  files: Readonly<Record<string, string>>,
  use: (bound: {
    readonly wired: { readonly bound: Bound; readonly faces: Effect.Success<ReturnType<typeof bind>>["faces"] }
    readonly ops: Ops
    readonly store: OutlineStore
    readonly root: string
    readonly reads: ReadonlyArray<string>
    readonly attached: Effect.Effect<string>
    readonly plugins: Plugins
  }) => Effect.Effect<A, unknown>,
  extra: {
    readonly plugins?: ReadonlyArray<{
      readonly name: string
      readonly plugin: ReturnType<typeof definePlugin>
    }>
  } = {},
): Promise<A> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-runtime-")))
  for (const [file, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), contents)
  }
  const reads: Array<string> = []

  return Effect.gen(function*() {
    const onChange = { run: (): void => {} }
    const mounted = yield* openHostPlugins({ vars: {}, now: () => STARTED, changed: () => onChange.run() })
    yield* mountBundle(mounted.host, selectFixtureRows(["vault", ...CONTENT_ROWS]), "surface")
    yield* provide(mounted.host, VaultBoot, () => ({root, runtime: runtimePaths}))
    yield* settled(mounted.host, ["vault", ...CONTENT_ROWS])
    const directory = door(mounted.host, Directory) as { readonly store: OutlineStore } | undefined
    if (!directory) throw new Error("test-minimal did not open its vault row")
    const opened = directory.store
    const readBody = opened.body
    Object.assign(opened, {body: (path: string) => { reads.push(path); return readBody(path) }})
    const store = opened
    const gate = door(mounted.host, OpsDoor)?.gate as Ops | undefined
    if (!gate) throw new Error("test-minimal did not offer its gate")
    for (const one of extra.plugins ?? []) yield* mountPlugin(mounted.host, one.plugin)
    const attachments = yield* Queue.unbounded<string>()
    const vault = mounted.composed().find(one => one.name === "vault")
    const heads = (vault?.deps as { collections?: { heads?: {
      readAll: () => ReadonlyMap<string, unknown>; readOne?: (key: string) => unknown
    } } })?.collections?.heads
    if (!heads) throw new Error("Vault did not offer its heads")
    heads.readOne = key => {
      Queue.offerUnsafe(attachments, key)
      return heads.readAll().get(key)
    }
    const wired = yield* bind({
      hostname: hostname(),
      startedAt: STARTED,
      plugins: {
        plugins: { ...mounted, changes: Stream.empty },
        onChange,
        built: extra.plugins === undefined ? ["vault", ...CONTENT_ROWS] : extra.plugins.map((one) => one.name),
        report: yield* Effect.map(
          rowReport(mounted.host, extra.plugins === undefined ? ["vault", ...CONTENT_ROWS] : extra.plugins.map((one) => one.name)),
          (read) => () => read,
        ),
        names: () => new Map(),
        configs: () => new Map(),
        set: () => Effect.succeed(false),
        reread: Effect.void,
        switched: () => new Set(),
      },
    })
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))
    yield* Effect.addFinalizer(() => runtime.stopped)
    return yield* use({ wired, ops: gate, store, reads, attached: Queue.take(attachments), root, plugins: mounted })
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.provide(TestClock.layer()),
    Effect.runPromise,
  )
}

const RECORDS_THE_WRITER = [
  "surface/files/ops/run", "surface/markdown/ops/run",
  "surface/outlines/ops/run", "surface/trash/ops/run",
]

const OUTLINE = `{"id":"a","ord":"a0","title":"a"}\n`
const REFUSED = `{"id":"a","parent":"nowhere","ord":"a0","title":"a"}\n`

const watching = <A>(
  stream: Stream.Stream<A>,
): Effect.Effect<{
  readonly take: Effect.Effect<A>
  readonly reader: Fiber.Fiber<void>
}> =>
  Effect.gen(function*() {
    const frames = yield* Queue.unbounded<A>()
    const reader = yield* Effect.forkChild(
      Stream.runForEach(stream, (frame) => Queue.offer(frames, frame)),
      { startImmediately: true },
    )
    return { take: Queue.take(frames), reader }
  })

const opening = (bound: Bound, key: string) => Effect.gen(function*() {
  const heads = bound.handlers["surface/vault/heads/get"]
  const body = bound.handlers["surface/vault/bodies/get"]
  if (!heads || !body) throw new Error("Vault did not offer head and body reads")
  return yield* watching((heads({ key }) as Stream.Stream<Head>).pipe(
    Stream.mapEffect(head => Effect.map(body({ path: key }) as Effect.Effect<{ text: string | null; refused: boolean }>,
      entry => ({ ...entry, rev: head.rev }))),
  ))
})

test("app.get answers the box and the start this runtime was minted with", () =>
  withRuntime({ "a.olai": OUTLINE }, ({ wired }) =>
    Effect.gen(function*() {
      const get = wired.bound.handlers["surface/app/get"]
      if (get === undefined) throw new Error("app.get is missing")
      const said = yield* (get({}) as Effect.Effect<App>)
      expect(said.hostname).toBe(hostname())
      expect(said.startedAt).toBe(STARTED)
    })))

test("a face served under another writer differs by exactly the members that record one", () =>
  withRuntime({ "a.olai": OUTLINE }, ({ wired, ops }) =>
    Effect.gen(function*() {
      const agent = writerAt(wired.bound, ops, { writer: "mcp" })

      expect(Object.keys(agent).sort()).toEqual(Object.keys(wired.bound.handlers).sort())

      const rebound = Object.keys(wired.bound.handlers).filter(
        (tag) => agent[tag] !== wired.bound.handlers[tag],
      )
      expect(rebound.sort()).toEqual(RECORDS_THE_WRITER)
    })))

test("a fetched body is refused by the browser body procedure", () =>
  withRuntime(
    { "a.olai": OUTLINE, "report.html": "<h1>Cabinet quote</h1>\n" },
    ({ wired, store }) =>
      Effect.gen(function*() {
        const get = wired.bound.handlers["surface/vault/bodies/get"]
        if (!get) throw new Error("the vault has no body procedure")
        expect(yield* (get({ path: "report.html" }) as Effect.Effect<unknown>))
          .toEqual({ text: null, refused: true })

        const keys = yield* Stream.runCollect(
          Stream.take(
            wired.bound.handlers["surface/markdown/documents/keys"]?.({}) as Stream.Stream<
              ReadonlyArray<string>
            >,
            1,
          ),
        )
        expect([...keys]).toEqual([[]])
        const set = yield* Effect.map(store.read("cheap"), (aged) => aged.snapshot)
        expect(set?.value.set.documents.map((one) => [String(one.path), one.kind]))
          .toEqual([["a.olai", "outline-olai"], ["report.html", "hypertext"]])
      }),
  ))

test("a reader watching a head is told the file moved, and no body is read", () =>
  withRuntime(
    { "a.olai": OUTLINE, "report.html": "<h1>Before</h1>\n" },
    ({ wired, store, root, reads }) =>
      Effect.gen(function*() {
        const get = wired.bound.handlers["surface/vault/heads/get"]
        if (get === undefined) throw new Error("the heads collection has no `get`")

        const open = yield* watching(get({ key: "report.html" }) as Stream.Stream<Head>)
        const first = yield* open.take

        fs.writeFileSync(path.join(root, "report.html"), "<h1>After</h1>\n")
        yield* store.refresh("cheap")
        const second = yield* open.take

        expect([first, second].map((frame) => Object.keys(frame))).toEqual([
          ["rev", "face", "broken"],
          ["rev", "face", "broken"],
        ])
        expect(first.rev).toBeLessThan(second.rev)

        expect(reads).toEqual([])
      }),
  ))

test("a file a reader is holding is re-read for them when it moves", () =>
  withRuntime(
    { "a.olai": OUTLINE, "report.csv": "<h1>Before</h1>\n" },
    ({ wired, store, root, reads }) =>
      Effect.gen(function*() {
        const open = yield* opening(wired.bound, "report.csv")
        expect(yield* open.take).toEqual({
          rev: 1,
          text: "<h1>Before</h1>\n",
          refused: false,
        })

        fs.writeFileSync(path.join(root, "report.csv"), "<h1>After</h1>\n")
        yield* store.refresh("cheap")

        expect(yield* open.take).toEqual({
          rev: 2,
          text: "<h1>After</h1>\n",
          refused: false,
        })
        expect(reads).toEqual(["report.csv", "report.csv"])
      }),
  ))

test("a file whose reader has gone is not re-read on a later revision", () =>
  withRuntime(
    { "a.olai": OUTLINE, "report.csv": "<h1>Before</h1>\n" },
    ({ wired, store, root, reads }) =>
      Effect.gen(function*() {
        const open = yield* opening(wired.bound, "report.csv")
        expect(yield* open.take).toEqual({
          rev: 1,
          text: "<h1>Before</h1>\n",
          refused: false,
        })

        yield* Fiber.interrupt(open.reader)

        const heads = wired.bound.handlers["surface/vault/heads/get"]
        if (heads === undefined) throw new Error("the heads collection has no `get`")
        const moved = yield* watching(heads({ key: "report.csv" }) as Stream.Stream<Head>)
        yield* moved.take
        fs.writeFileSync(path.join(root, "report.csv"), "<h1>After</h1>\n")
        yield* store.refresh("cheap")
        yield* moved.take

        const again = yield* opening(wired.bound, "report.csv")
        const body = yield* again.take
        expect(body.text).toBe("<h1>After</h1>\n")
        expect(body.refused).toBe(false)
        expect(body.rev).toBeGreaterThanOrEqual(2)
        expect(reads).toEqual(["report.csv", "report.csv"])
      }),
  ))

test("a reader holding a key across a file's birth is handed the body", () =>
  withRuntime({ "a.olai": OUTLINE }, ({ wired, store, root, attached }) =>
    Effect.gen(function*() {
      const open = yield* opening(wired.bound, "report.csv")
      expect(yield* attached).toBe("report.csv")

      fs.writeFileSync(path.join(root, "report.csv"), "<h1>Born</h1>\n")
      yield* store.refresh("cheap")

      const born = yield* open.take
      expect(born.text).toBe("<h1>Born</h1>\n")
      expect(born.refused).toBe(false)
      expect(born.rev).toBeGreaterThanOrEqual(2)
    })))

test("an unreadable `.html` is refused rather than held open", () => {
  if (typeof process.getuid === "function" && process.getuid() === 0) return
  return withRuntime(
    { "a.olai": OUTLINE, "locked.html": "<h1>Shut</h1>\n" },
    ({ wired, root }) =>
      Effect.gen(function*() {
        fs.chmodSync(path.join(root, "locked.html"), 0o000)
        try {
          const open = yield* opening(wired.bound, "locked.html")
          expect(yield* open.take).toEqual({
            rev: 1,
            text: null,
            refused: true,
          })
        } finally {
          fs.chmodSync(path.join(root, "locked.html"), 0o600)
        }
      }),
  )
})

test("a broken outline publishes its head, with its own rows on it", () =>
  withRuntime(
    { "a.olai": REFUSED, "b.olai": `{"id":"b","ord":"a0","title":"b"}\n` },
    ({ wired }) =>
      Effect.gen(function*() {
        const said = wired.bound.handlers["surface/vault/manifest/get"]
        const framed = wired.bound.handlers["surface/vault/heads/deltas"]
        if (said === undefined) throw new Error("the manifest cell has no `get`")
        if (framed === undefined) throw new Error("the heads collection has no `deltas`")

        const heads = yield* watching(
          framed({}) as Stream.Stream<CollectionDeltasMsg<string, Head>>,
        )
        const manifest = yield* watching(said({}) as Stream.Stream<Manifest>)
        const opened = yield* heads.take
        expect(yield* manifest.take).toEqual({})

        if (opened?.kind !== "snapshot") throw new Error("expected the opening snapshot")
        const entries = new Map(opened.entries)
        expect([...entries.keys()]).toEqual(["a.olai", "b.olai"])
        expect(entries.get("a.olai")?.broken?.errors.map((one) => one.code))
          .toEqual(["unknown-parent"])
        expect(entries.get("b.olai")?.broken).toBeNull()
      }),
  ))

test("the shelf is answered per revision, so a rename elsewhere renames the pin", () =>
  withRuntime(
    {
      "a.olai": OUTLINE,
      "_olai/Pins.olai": `{"id":"p","ord":"a0","title":"/#a"}\n`,
    },
    ({ wired, store, root }) =>
      Effect.gen(function*() {
        const get = wired.bound.handlers["surface/pins/pins/get"]
        if (get === undefined) throw new Error("the pins cell has no `get`")

        const open = yield* watching(get({}) as Stream.Stream<Shelf>)
        const first = yield* open.take

        fs.writeFileSync(path.join(root, "a.olai"), `{"id":"a","ord":"a0","title":"b"}\n`)
        yield* store.refresh("cheap")
        const second = yield* open.take

        expect([first, second]).toEqual([
          [{ id: "p", title: "/#a", shows: { id: "a", name: "a" } }],
          [{ id: "p", title: "/#a", shows: { id: "a", name: "b" } }],
        ])
      }),
  ))

test("a revision that changes no pin sends no frame", () =>
  withRuntime(
    {
      "a.olai": OUTLINE,
      "_olai/Pins.olai": `{"id":"p","ord":"a0","title":"/zoom/#a"}\n`,
      "report.csv": "<h1>Before</h1>\n",
    },
    ({ wired, store, root }) =>
      Effect.gen(function*() {
        const get = wired.bound.handlers["surface/pins/pins/get"]
        if (get === undefined) throw new Error("the pins cell has no `get`")
        const open = yield* watching(get({}) as Stream.Stream<Shelf>)
        expect(yield* open.take).toEqual([
          { id: "p", title: "/zoom/#a", shows: { id: "a", name: "a" } },
        ])

        fs.writeFileSync(path.join(root, "report.csv"), "<h1>After</h1>\n")
        yield* store.refresh("cheap")
        fs.writeFileSync(path.join(root, "a.olai"), `{"id":"a","ord":"a0","title":"b"}\n`)
        yield* store.refresh("cheap")

        expect(yield* open.take).toEqual([
          { id: "p", title: "/zoom/#a", shows: { id: "a", name: "b" } },
        ])
      }),
  ))

const EMPTY_PLUGINS: Plugins = await standing()(
  openPlugins({ vars: {}, now: () => STARTED, served: "/tmp" }),
)

const mounted = (names: ReadonlyArray<string>): ReadonlyMap<string, RowReport> =>
  new Map(names.map((name) => [name, { state: "running" as const }]))

const offering = (
  offByDefault: ReadonlyArray<string> = PLUGIN_NAMES,
  report: ReadonlyMap<string, RowReport> = new Map(),
): PluginRuntime => ({
  plugins: EMPTY_PLUGINS,
  onChange: { run: () => {} },
  built: PLUGIN_NAMES,
  offByDefault,
  report: () => report,
  names: () => new Map(),
  configs: () => new Map(),
  set: () => Effect.succeed(false),
  reread: Effect.void,
  switched: () => new Set(),
})


test("each running row carries the serve's mount generation", () => {
  const first = PLUGIN_NAMES[0]
  const second = PLUGIN_NAMES[1]
  if (first === undefined || second === undefined) throw new Error("this build has too few plugins to pin")
  const roster = rosterOf(
    offering([], mounted([first])),
    new Map(),
    new Map(),
    [],
    new Map([[first, 3], [second, 1]]),
  )
  const row = (name: string) => roster.built.find((one) => one.name === name)
  expect(row(first)?.generation).toBe(3)
  expect(row(second)?.generation).toBeUndefined()

  const defined: BuiltPlugin = { name: "defined-in-the-vault", running: true }
  const withDefined = rosterOf(offering([], mounted([first])), new Map(), new Map(), [defined], new Map([[defined.name, 7]]))
  expect(withDefined.built.at(-1)?.generation).toBe(7)
})

test("every plugin the build has is on the roster, running or not", () => {
  const all = rosterOf(offering(PLUGIN_NAMES, mounted(DEFAULT_BUNDLE_NAMES)))
  expect(all.built.map((one) => one.name)).toEqual([...PLUGIN_NAMES])
  expect(all.built.filter((one) => one.running).map((one) => one.name))
    .toEqual([...DEFAULT_BUNDLE_NAMES])
  expect(all.built.length).toBeGreaterThanOrEqual(DEFAULT_BUNDLE_NAMES.length)

  const first = PLUGIN_NAMES[0]
  if (first === undefined) throw new Error("this build has no plugins to pin")
  const one = rosterOf(offering([], mounted([first])))
  expect(one.built.map((row) => row.name)).toEqual([...PLUGIN_NAMES])
  expect(one.built.filter((row) => row.running).map((row) => row.name)).toEqual([first])
})


test("a file-enabled row still reports missing activation as off", () => {
  const first = PLUGIN_NAMES[0]!
  const roster = rosterOf({ ...offering([]), configuration: () => ({ revision: 1, rows: new Map([[first, { on: true, config: {}, values: [] }]]) }) })
  expect(roster.built.map((row) => row.name)).toEqual([...PLUGIN_NAMES])
  expect(roster.built.some((row) => row.running)).toBe(false)
  expect(roster.built.find(row => row.name === first)).toMatchObject({ state: "off", desiredOn: true })
})

test("build-disabled and ordinary absent rows stay distinct without a policy reader", () => {
  const defaults = [PLUGIN_NAMES[0]!]
  const roster = rosterOf({ ...offering(), offByDefault: defaults, configuration: () => undefined })
  expect(roster.built.find(row => row.name === defaults[0])?.state).toBe("optIn")
  expect(roster.built.find(row => row.name === PLUGIN_NAMES[1])?.state).toBe("off")
})

test("a row's config travels on the roster as data, and a row without one sends none", () => {
  const withConfig = rosterOf({
    ...offering(),
    configs: () => new Map([[PLUGIN_NAMES[0]!, { commit: "auto" }]]),
  })
  expect(withConfig.built[0]?.config).toEqual({ commit: "auto" })
  expect(withConfig.built[1]?.config).toBeUndefined()
  expect(rosterOf(offering()).built.every((row) => row.config === undefined)).toBe(true)
})

test("a runtime with no active rows still reports its build catalogue", () => {
  const none = rosterOf(offering([]))
  expect(none.built.some((row) => row.running)).toBe(false)
  expect(none.built.map((row) => row.name)).toEqual([...PLUGIN_NAMES])
})

test("no plugin slot is no roster, rather than every plugin off", () => {
  expect(rosterOf(null)).toEqual(NO_ROSTER)
})


test("loader reports distinguish disabled rows, failures and active providers", () => {
  const first = PLUGIN_NAMES[0]
  const second = PLUGIN_NAMES[1]
  if (first === undefined || second === undefined) {
    throw new Error("this test needs a build with two plugins")
  }

  const optIn = rosterOf(offering(PLUGIN_NAMES, new Map([[first, { state: "off" }]])))
  expect(optIn.built.find((row) => row.name === first)?.state).toBe("optIn")
  expect(optIn.built.find((row) => row.name === first)?.running).toBe(false)

  const off = rosterOf(offering([], new Map([[first, { state: "off" }], [second, { state: "running" }]])))
  expect(off.built.find((row) => row.name === first)?.state).toBe("off")

  const failed = rosterOf(
    offering(PLUGIN_NAMES, new Map([[first, { state: "failed", fault: "no socket at /run/x" }]])),
  )
  const row = failed.built.find((one) => one.name === first)
  expect(row?.state).toBe("failed")
  expect(row?.fault).toBe("no socket at /run/x")
  expect(row?.running).toBe(false)

  const silent = rosterOf(offering(PLUGIN_NAMES, new Map([[first, { state: "failed" }]])))
  expect(silent.built.find((one) => one.name === first)?.state).toBe("failed")
  expect(silent.built.find((one) => one.name === first)?.fault).toBeUndefined()

  const waiting = rosterOf(offering(PLUGIN_NAMES, new Map([[first, { state: "waiting" }]])))
  expect(waiting.built.find((one) => one.name === first)?.state).toBe("waiting")
})


test("a plugin's row is its fiber's state, not what it happened to register", () => {
  const first = PLUGIN_NAMES[0]
  if (first === undefined) throw new Error("this build has no plugins")

  const up = rosterOf(offering(PLUGIN_NAMES, mounted([first])))
  const row = up.built.find((one) => one.name === first)
  expect(row?.running).toBe(true)
  expect(row?.state).toBe("running")
  expect(row?.fault).toBeUndefined()

  const threw = rosterOf(
    offering(PLUGIN_NAMES, new Map([[first, { state: "failed", fault: "it threw once" }]])),
  )
  const bad = threw.built.find((one) => one.name === first)
  expect(bad?.running).toBe(false)
  expect(bad?.state).toBe("failed")
  expect(bad?.fault).toBe("it threw once")
})

test("an empty report leaves the rows saying exactly what the boolean did", () => {
  const roster = rosterOf(offering([]))
  expect(roster.built.every((row) => row.state === "off")).toBe(true)
  expect(roster.built.every((row) => row.fault === undefined)).toBe(true)
})

test("a wake sentence reaches the roster, and never for a plugin this serve left out", () => {
  const [first, second] = PLUGIN_NAMES
  if (first === undefined || second === undefined) {
    throw new Error("this build has fewer than two plugins to tell apart")
  }
  const drawn = {
    subject: "wake on terminal activity",
    waiting: { one: "waiting sentence", many: "waiting sentences" },
  }
  const wake = drawn
  const wakes = new Map([[first, wake]])

  const all = rosterOf(offering(PLUGIN_NAMES, mounted(PLUGIN_NAMES)), wakes)
  expect(all.built.find((row) => row.name === first)?.wake).toEqual(drawn)
  expect(all.built.find((row) => row.name === second)?.wake).toBeUndefined()

  const inactive = rosterOf(offering([], mounted([second])), wakes)
  expect(inactive.built.map((row) => row.name)).toEqual([...PLUGIN_NAMES])
  expect(inactive.built.find((row) => row.name === first)?.running).toBe(false)
  expect(inactive.built.find((row) => row.name === first)?.wake).toBeUndefined()
})

test("no wake declarations is no sentence, and every row is still there", () => {
  const all = rosterOf(offering(PLUGIN_NAMES, mounted(PLUGIN_NAMES)))
  expect(all.built.map((row) => row.name)).toEqual([...PLUGIN_NAMES])
  expect(all.built.every((row) => row.wake === undefined)).toBe(true)
})

test("a running row that offers a door names the rows that would stop with it", () => {
  const [first, second, third] = PLUGIN_NAMES
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error("this claim needs a build with three rows")
  }
  const carrying = (offers: ReadonlyMap<string, string>, names: ReadonlyMap<string, ReadonlyArray<string>>) =>
    rosterOf(
      { ...offering(PLUGIN_NAMES, mounted(PLUGIN_NAMES)), names: () => names },
      new Map(),
      offers,
    )

  const roster = carrying(
    new Map([["aDoor", first]]),
    new Map([[second, ["aDoor"]], [third, ["aDoor"]]]),
  )
  expect(roster.built.find((row) => row.name === first)?.carrying).toEqual([second, third])
  expect(roster.built.filter((row) => row.carrying !== undefined).map((row) => row.name))
    .toEqual([first])

  const shuffled = carrying(
    new Map([["aDoor", first]]),
    new Map([[third, ["aDoor"]], [second, ["aDoor"]]]),
  )
  expect(shuffled.built.find((row) => row.name === first)?.carrying).toEqual([second, third])

  const itself = carrying(
    new Map([["aDoor", first]]),
    new Map([[first, ["aDoor"]], [second, ["aDoor"]]]),
  )
  expect(itself.built.find((row) => row.name === first)?.carrying).toEqual([second])
})


test("a row a person switched off is not the build's default", () => {
  const [first] = PLUGIN_NAMES
  if (first === undefined) throw new Error("this claim needs a build with a row")
  const absent = new Map([[first, { state: "off" as const }]])

  expect(rosterOf(offering(PLUGIN_NAMES, absent)).built.find((row) => row.name === first)?.state)
    .toBe("optIn")

  const pressed = rosterOf({ ...offering(PLUGIN_NAMES, absent), switched: () => new Set([first]) })
  expect(pressed.built.find((row) => row.name === first)?.state).toBe("switched")
  expect(pressed.built.find((row) => row.name === first)?.running).toBe(false)

  const underPolicy = rosterOf({
    ...offering([], absent),
    switched: () => new Set([first]),
  })
  expect(underPolicy.built.find((row) => row.name === first)?.state).toBe("switched")

  const back = rosterOf({
    ...offering(PLUGIN_NAMES, mounted([first])),
    switched: () => new Set([first]),
  })
  expect(back.built.find((row) => row.name === first)?.state).toBe("running")
})

test("a file-enabled build-disabled row reports its real activation", () => {
  const first = PLUGIN_NAMES[0]!
  const roster = rosterOf({
    ...offering([first], mounted([first])),
    configuration: () => ({ revision: 1, rows: new Map([[first, { on: true, config: {}, values: [] }]]) }),
  })
  expect(roster.built.find(row => row.name === first)).toMatchObject({ state: "running", running: true, desiredOn: true })
})

test("a row that is not running carries nobody", () => {
  const [first, second] = PLUGIN_NAMES
  if (first === undefined || second === undefined) {
    throw new Error("this claim needs a build with two rows")
  }
  const roster = rosterOf(
    {
      ...offering([], new Map([[first, { state: "off" }], [second, { state: "running" }]])),
      names: () => new Map([[second, ["aDoor"]]]),
    },
    new Map(),
    new Map([["aDoor", first]]),
  )
  expect(roster.built.find((row) => row.name === first)?.running).toBe(false)
  expect(roster.built.find((row) => row.name === first)?.carrying).toBeUndefined()
})

test("a plugin that contributed an ENGINE and no sibling is running", () =>
  withRuntime(
    { "a.olai": OUTLINE },
    ({ wired }) =>
      Effect.gen(function*() {
        const get = wired.bound.handlers["surface/plugins/get"]
        if (get === undefined) throw new Error("the plugins cell has no `get`")
        const open = yield* watching(get({}) as Stream.Stream<PluginRoster>)
        const built = (yield* open.take).built
        expect(built.map((row) => [row.name, row.state, row.running])).toEqual([
          ["chat", "running", true],
          ["an-engine", "running", true],
          ["a-tenant", "running", true],
        ])
        yield* Fiber.interrupt(open.reader)
      }),
    { plugins: [{ name: "chat", plugin: chatOffering }, engineCalled("an-engine"), doubleCalled("a-tenant")] },
  ))


test("the roster is served on the plugins cell", () =>
  withRuntime({ "a.olai": OUTLINE }, ({ wired }) =>
    Effect.gen(function*() {
      const get = wired.bound.handlers["surface/plugins/get"]
      if (get === undefined) throw new Error("the plugins cell has no `get`")
      const open = yield* watching(get({}) as Stream.Stream<PluginRoster>)
      expect((yield* open.take).built.map((row) => [row.name, row.state])).toEqual(["vault", ...CONTENT_ROWS].map(name => [name, name === "vault" ? "waiting" : "running"]))
      yield* Fiber.interrupt(open.reader)
    })))

test("a sibling the rooted bundle refuses takes only its own fiber down, and the next one still mounts", () =>
  withRuntime(
    { "a.olai": OUTLINE },
    ({ plugins, wired }) =>
      Effect.gen(function*() {
        if (plugins === null) throw new Error("this case needs the plugin runtime")
        const before = Object.keys(wired.bound.handlers).length
        const composedBefore = plugins.composed().map(one => one.name)

        const bad = definePlugin({
          name: "refused",
          needs: [Surfaces],
          apply: Effect.gen(function*() {
            yield* (yield* Surfaces).register({
              surface: defineSurface({ cells: { fleet: { schema: Schema.String, default: "" } } }),
              faces: {},
              deps: {},
            })
          }),
        })
        const refused = yield* mountPlugin(plugins.host, bad)

        expect((yield* refused.report).state).toBe("failed")
        expect(plugins.composed().map((one) => one.name)).toEqual(composedBefore)
        expect(Object.keys(wired.bound.handlers).length).toBe(before)

        const healthy = yield* mountPlugin(
          plugins.host,
          definePlugin({
            name: "healthy",
            needs: [Surfaces],
            apply: Effect.gen(function*() {
              yield* (yield* Surfaces).register({
                surface: defineSurface({}),
                faces: {},
                deps: {},
              })
            }),
          }),
        )
        expect((yield* healthy.report).state).toBe("running")
        expect(plugins.composed().map((one) => one.name)).toEqual([...composedBefore, "healthy"])

        const get = wired.bound.handlers["surface/plugins/get"]
        if (get === undefined) throw new Error("the plugins cell has no `get`")
        const open = yield* watching(get({}) as Stream.Stream<PluginRoster>)
        expect((yield* open.take).built.map((row) => row.name)).toEqual([])
        yield* Fiber.interrupt(open.reader)
      }),
    { plugins: [] },
  ))


test("the browser gate names exactly what the group serves, and is one value per generation", () =>
  withRuntime(
    { "a.olai": OUTLINE },
    ({ plugins, wired }) =>
      Effect.gen(function*() {
        if (plugins === null) throw new Error("this case needs the plugin runtime")

        const gateFits = (): void => {
          restrictHandlers(wired.bound.group, wired.bound.handlers, wired.faces.browser)
        }
        const groupCarries = (key: string): boolean =>
          [...wired.bound.group.requests.keys()].some((tag) => tag.startsWith(`surface/${key}/`))

        const first = wired.faces.browser
        expect(gateFits).not.toThrow()
        expect(groupCarries("gated")).toBe(false)

        expect(wired.faces.browser).toBe(first)

        const gatedDouble = definePlugin({
          name: "gated",
          needs: [Surfaces],
          apply: Effect.gen(function*() {
            yield* (yield* Surfaces).register({
              surface: defineSurface({
                cells: { seen: { schema: Schema.String, default: "", verbs: ["get"] } },
              }),
              faces: { browser: { seen: "resource" } },
              deps: { cells: { seen: { store: inMemoryStore("") } } },
            })
          }),
        })
        const mounted = yield* mountPlugin(plugins.host, gatedDouble)

        expect(wired.faces.browser).not.toBe(first)
        expect(gateFits).not.toThrow()
        expect(groupCarries("gated")).toBe(true)

        const second = wired.faces.browser
        expect(wired.faces.browser).toBe(second)

        yield* mounted.dispose
        expect(gateFits).not.toThrow()
        expect(groupCarries("gated")).toBe(false)

      }),
    { plugins: [] },
  ))

const NOTHING = defineSurface({})

const RINGING = {
  subject: "wake on something",
  from: "the somethings of",
  waiting: { one: "sentence", many: "sentences" },
  walks: "nodes" as const,
  faults: {
    gone: "the file this doorbell watched is not here any more, and nothing is being watched",
    unwatchable:
      "the file this doorbell is pointed at is not one it can read, and nothing is being watched",
  },
}

const doubleCalled = (name: string, wake?: typeof RINGING) => ({
  name,
  plugin: definePlugin({
    name,
    needs: [Surfaces, Wakes],
    apply: Effect.gen(function*() {
      if (wake !== undefined) yield* (yield* Wakes).register(wake)
      yield* (yield* Surfaces).register({ surface: NOTHING, faces: {}, deps: {} })
    }),
  }),
})

const chatOffering = definePlugin({
  name: "chat",
  needs: [Offers],
  apply: Effect.gen(function*() {
    const seen = new Map<string, unknown>()
    yield* (yield* Offers).offer(Agents, (who) => ({
      register: (engine) => Effect.sync(() => void seen.set(who, engine)),
    }))
  }),
})

const engineCalled = (name: string) => ({
  name,
  plugin: definePlugin({
    name,
    needs: [Agents],
    apply: Effect.gen(function*() {
      yield* (yield* Agents).register({
        name: ` (a name)`,
        leg: {} as Leg,
        at: () => ({ name, where: null, why: "fixture executable is absent" }),
        prompt: { kind: "first-turn" },
      })
    }),
  }),
})

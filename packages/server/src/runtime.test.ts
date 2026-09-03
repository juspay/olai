/**
 * One runtime, several faces, several writers — the rebinding, as a fence.
 *
 * `writerAt` is what lets an `olai web` serve its own websocket as `web` and,
 * over the same store and the same cells, an HTTP `/mcp` client as `mcp`. The
 * END of that is proven where it can be seen from outside — a commit's
 * `X-Olai-Writer` trailer, from a face composed under a writer that is not
 * this process's own door.
 *
 * What that cannot see is the MECHANISM, and the mechanism has one way to rot
 * quietly: a member that records who asked, added to the surface and bound in
 * `bind`, and never added to `writing` — so it answers under this process's
 * writer on every face, forever, with nothing anywhere saying so. A bridged
 * agent's work would go into the log under the browser's name.
 *
 * So this asserts the rebinding is EXACT in both directions: the tags it
 * replaces are the ones that record a writer, and every other handler in the
 * record is the same value it was.
 */

import {
  codecFor,
  fixedPolicy,
  make as makeOps,
  type Ops,
  type Store as OutlineStore,
} from "@olai/ops"
import type { App, DocumentEntry, Head, Manifest, PluginRoster, Shelf } from "@olai/surface"
import { CHAT_OFF, NO_ROSTER } from "@olai/surface"
import type { Chat, Faulted, Scoped } from "@olai/chat"
import { DEFAULT_BUNDLE_NAMES } from "@olai/bundle"
import type { RowReport } from "@olai/bundle/bundle"
import { BUNDLE_NAMES as PLUGIN_NAMES } from "@olai/bundle"
import type { Leg } from "@olai/acp/engine"
import type { Deliveries, Plugins } from "@olai/plugin-api/services"
import {
  Agents,
  definePlugin,
  Deliveries as DeliveriesTag,
  mountPlugin,
  openPlugins,
  rowReport,
  standing,
  Surfaces,
  Wakes,
} from "@olai/plugin-api/services"
import type { CollectionDeltasMsg } from "@kolu/surface/define"
import { defineSurface } from "@kolu/surface/define"
import { NO_KINDS } from "@olai/format"
import * as Store from "@olai/store"
import { NodeServices } from "@effect/platform-node"
import { expect, mock, test } from "bun:test"
import { Effect, Fiber, Queue, Schema, Scope, Stream, SubscriptionRef } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import type { NodeAgent } from "@olai/format"

import type { Roster } from "./agents.ts"
import { watchFault } from "./fault.ts"
import { hostname } from "./hostname.ts"
import { type Bound, bind, gitWiring, type PluginRuntime, rosterOf, writerAt } from "./runtime.ts"

/** The codec this suite validates through — the vocabulary of a build that
 *  composed no plugin, which is what these fixtures declare nothing about
 *  (`@olai/ops`' `codecFor`, and `@olai/format`'s `NO_KINDS`). */
const codec = codecFor(NO_KINDS)

/** A known start instant, so `app.get` is asserted against a mint rather
 *  than against whatever clock the suite happened to read. */
const STARTED = "2026-08-29T09:31:00.000Z"

/** One bound runtime over a directory of `files`, torn down with the scope —
 *  the boot every test here needs and neither one is about. `watchFault` is
 *  not ceremony: the runtime's `done` REJECTS when it is closed, so something
 *  has to hold that catch or the teardown is an unhandled rejection the runner
 *  attributes to whichever test happened to be running.
 *
 *  It yields the OPS layer beside the runtime because one test rebinds the
 *  handlers against it; nothing else about the boot differs between them, and
 *  the `reads` list because one of them is about a read that must not happen. */
const withRuntime = <A>(
  files: Readonly<Record<string, string>>,
  use: (bound: {
    readonly wired: { readonly bound: Bound }
    readonly ops: Ops
    readonly store: OutlineStore
    /** The directory this runtime is serving, for the one test that rewrites a
     *  file underneath it. */
    readonly root: string
    /** Every path whose BODY was read off the disk for a reader, in order —
     *  `@olai/store`.s `body`, which is the one door `./bodies.ts` may use.
     *  Recorded rather than mocked: the real read still happens. */
    readonly reads: ReadonlyArray<string>
    /** THE PLUGIN CONTEXT this runtime was handed, or `null` where a case took
     *  no plugin slot — for the one case that mounts a plugin AFTER the bundle
     *  is composed, which is the only way to reach the live re-compose from
     *  here. Every other case gets its plugins mounted before `bind` and has no
     *  use for it. */
    readonly plugins: Plugins | null
  }) => Effect.Effect<A, unknown>,
  /**
   * The two slots the doorbell's gates need and no other test here does —
   * OPTIONAL, so the ten cases above say nothing about either and get exactly
   * the boot they always got.
   *
   * `chat` is the panel this runtime answers for, absent by default because a
   * directory is readable whether or not an agent is installed and every
   * reading test here is that machine. `plugins` is WHICH DOUBLES to mount:
   * `undefined` is no plugin runtime at all ({@link rosterOf}'s `NO_ROSTER`),
   * `[]` is a mounted runtime with nothing in it, and a list is the doubles a
   * case built. What is behind a name is a plugin with no
   * appliance under it ({@link doubleCalled}) — this harness mounts what the
   * runtime is handed and never looks inside it.
   */
  extra: {
    readonly chat?: Chat
    readonly plugins?: ReadonlyArray<{
      readonly name: string
      readonly plugin: ReturnType<typeof definePlugin>
    }>
    /** The vault's half of the node-agent roster ({@link ./agents.ts}) —
     *  absent for every case that is not about a binding, which is what a
     *  serve with no ACP agent is handed too. */
    readonly agents?: Roster
  } = {},
): Promise<A> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-runtime-")))
  for (const [file, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, file), contents)
  }
  const reads: Array<string> = []

  return Effect.gen(function*() {
    const opened: OutlineStore = yield* Store.make({
      root,
      codec,
      watch: false,
      settle: "10 millis",
    })
    const store: OutlineStore = {
      ...opened,
      body: (path) => {
        reads.push(path)
        return opened.body(path)
      },
    }
    const ops = makeOps({ store, root, policy: fixedPolicy({ commit: "off", push: null }) })
    /** The re-compose holder `bind` fills in — one per boot, as `./serve.ts`
     *  makes one per serve. */
    const onChange = { run: (): void => {} }
    /** The plugin context this boot was handed, held so the body can reach it —
     *  see the `plugins` field the harness yields. */
    const mounted = extra.plugins === undefined
      ? null
      : yield* mounting(extra.plugins ?? [], () => extra.chat ?? null, onChange)
    const wired = yield* bind({
      store,
      chat: extra.chat ?? null,
      // WHY there is none, where a case gave none — the arm a serve with no
      // engine plugin mounted sends. Cases that hand a chat over are not in
      // that state and the field rides `null` beside it.
      noAgent: extra.chat === undefined ? { kind: "no-engine" } : null,
      ...(extra.agents === undefined ? {} : { agents: extra.agents }),
      ops,
      writer: "web",
      hostname: hostname(),
      startedAt: STARTED,
      // NO PLUGINS, unless a case asked for doubles. Every runtime in this file
      // but the doorbell's is a reader — a bound face, an MCP route — and none
      // of them is about a terminal door or a CI chip; dialing whatever daemons
      // happen to be on the machine running the suite would make these tests
      // depend on them. `null` is the OFF setting, and what it produces is a
      // rooted bundle with no sibling mounted on it: no tag, no handler and no
      // expose row, so olai's own group is byte for byte what it always was.
      //
      // The doorbell's cases DO take the slot, and they still dial nothing:
      // what stands behind their names is a double with no appliance under it
      // ({@link doubleCalled}).
      plugins: mounted === null ? null : {
        plugins: mounted,
        onChange,
        built: (extra.plugins ?? []).map((one) => one.name),
        pinned: null,
        // THE DOUBLES' OWN FIBERS, asked the way a serve asks the bundle's.
        // These runtimes mount doubles directly rather than through the loader,
        // so `reportBundle` (which walks `BUNDLE_NAMES`) has nothing to say
        // about them — but the reading underneath it takes the ids it is given,
        // and asking it here is what makes these cases exercise the same
        // derivation a real boot does rather than a hand-made map.
        report: yield* rowReport(mounted.host, (extra.plugins ?? []).map((one) => one.name)),
      },
      git: gitWiring(
        ops,
        fixedPolicy({ commit: "off", push: null }),
        yield* SubscriptionRef.make(0),
      ),
    })
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))
    yield* Effect.addFinalizer(() => runtime.stopped)
    return yield* use({ wired, ops, store, reads, root, plugins: mounted })
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer), Effect.runPromise)
}

/** Every member whose answer records WHO asked, as the wire spells them. A
 *  LITERAL rather than a derivation, deliberately: the thing under test is that
 *  a list somebody maintains by hand still says what they think it says, and a
 *  second derivation of it would agree with the first by construction. */
const RECORDS_THE_WRITER = ["surface/git/commit", "surface/ops/run"]

const OUTLINE = `{"id":"a","ord":"a0","title":"a"}\n`
/** A row whose parent nothing declares — a MEANING error rather than a syntax
 *  one. It used to be the way to leave the store with no snapshot at all; since
 *  the per-file ruling it is not, and that is the point of keeping it: the set
 *  publishes with `a.olai` withheld, its head carries its rows, and every other
 *  file of the directory is served. */
const REFUSED = `{"id":"a","parent":"nowhere","ord":"a0","title":"a"}\n`

/**
 * Drain a stream onto a queue, and do not return until the subscription is
 * attached.
 *
 * `forkChild` without `startImmediately` only SCHEDULES the consumer, so a
 * publish on this fiber can land on zero subscribers: the stream's snapshot is
 * then already the post-publish value, and a wait for two frames hangs on a
 * second one that will never come. Starting the child on this stack runs it
 * until it parks on the next frame — subscribe, then the snapshot — which is
 * the same barrier taking a frame is, and the only one a not-yet-born key has
 * (there is no snapshot to take).
 */
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

/** `watching` of a documents `get` — the lookup is this helper's, the attach
 *  is `watching`'s. Same shape, so a holder and a head-watcher are one kind of
 *  thing to take from and interrupt. */
const opening = (
  bound: Bound,
  key: string,
): Effect.Effect<{
  readonly take: Effect.Effect<DocumentEntry>
  readonly reader: Fiber.Fiber<void>
}> =>
  Effect.gen(function*() {
    const get = bound.handlers["surface/documents/get"]
    if (get === undefined) throw new Error("the documents collection has no `get`")
    return yield* watching(get({ key }) as Stream.Stream<DocumentEntry>)
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
      const agent = writerAt(wired.bound, ops, { writer: "mcp", fence: null })

      // The RECORD is the group's, exactly — which is also what `restrictHandlers`
      // asserts before any face binds, so a mis-derived tag is a boot crash rather
      // than a hole. Said here too because this is where the tags are derived.
      expect(Object.keys(agent).sort()).toEqual(Object.keys(wired.bound.handlers).sort())

      const rebound = Object.keys(wired.bound.handlers).filter(
        (tag) => agent[tag] !== wired.bound.handlers[tag],
      )
      expect(rebound.sort()).toEqual(RECORDS_THE_WRITER)
    })))

/**
 * A body the set does not keep, from the outside: the same `get` a browser
 * opens, driven through the bound handler.
 *
 * ONE frame is the whole contract, and which one it is matters. The projection
 * holds a `null` for this file — the server has its path and not its bytes —
 * and that is NOT what a reader is handed: the subscription is held open, the
 * file is read BECAUSE this subscription asked, and the first thing to arrive
 * is the body. A reader gets what it always got (a one-shot reader included,
 * which takes the first frame and leaves), and the process does not go on
 * holding it.
 */
test("opening a `.html` reads its body onto that key, and nothing holds it", () =>
  withRuntime(
    { "a.olai": OUTLINE, "report.html": "<h1>Cabinet quote</h1>\n" },
    ({ wired, store }) =>
      Effect.gen(function*() {
        const get = wired.bound.handlers["surface/documents/get"]
        if (get === undefined) throw new Error("the documents collection has no `get`")

        const frames = yield* Stream.runCollect(
          Stream.take(get({ key: "report.html" }) as Stream.Stream<DocumentEntry>, 1),
        )
        expect([...frames]).toEqual([
          { rev: 1, text: "<h1>Cabinet quote</h1>\n", refused: false },
        ])

        // …and the projection is where it was: a path, and no bytes. This is the
        // assertion the whole change is for.
        const keys = yield* Stream.runCollect(
          Stream.take(
            wired.bound.handlers["surface/documents/keys"]?.({}) as Stream.Stream<
              ReadonlyArray<string>
            >,
            1,
          ),
        )
        expect([...keys]).toEqual([["report.html"]])
        const set = yield* Effect.map(store.read("cheap"), (aged) => aged.snapshot)
        expect(set?.value.set.documents.map((one) => [String(one.path), one.kind]))
          .toEqual([["a.olai", "outline"], ["report.html", "hypertext"]])
      }),
  ))

/**
 * The other way to watch one file, and the reason it exists: a reader learns
 * the file MOVED and the file is never opened.
 *
 * This is the browser's shape for a `.html` since the preview stopped reading a
 * body it does not draw. The frame fetches the file over HTTP from `/media/`,
 * so what the socket owes this reader is a number — and the assertion that
 * matters is the negative one: the store's `body` is not called at all, which
 * is what says the bytes were neither read from the disk nor sent.
 */
test("a reader watching a head is told the file moved, and no body is read", () =>
  withRuntime(
    { "a.olai": OUTLINE, "report.html": "<h1>Before</h1>\n" },
    ({ wired, store, root, reads }) =>
      Effect.gen(function*() {
        const get = wired.bound.handlers["surface/heads/get"]
        if (get === undefined) throw new Error("the heads collection has no `get`")

        const open = yield* watching(get({ key: "report.html" }) as Stream.Stream<Head>)
        const first = yield* open.take

        fs.writeFileSync(path.join(root, "report.html"), "<h1>After</h1>\n")
        yield* store.refresh("cheap")
        const second = yield* open.take

        // A revision, a face and whether the file parsed — and NO BODY, no
        // `text` key at all, not even a `null`. That is the whole of what this
        // member is for: what the file IS and when it moved, without the
        // megabytes of a saved page.
        expect([first, second].map((frame) => Object.keys(frame))).toEqual([
          ["rev", "face", "broken"],
          ["rev", "face", "broken"],
        ])
        expect(first.rev).toBeLessThan(second.rev)

        // THE POINT. The file changed under a reader who is watching it, and
        // nothing opened it: no body was read, so none was sent, and nobody
        // holds the path at all (`./bodies.ts`).
        expect(reads).toEqual([])
      }),
  ))

/**
 * The live half of a held body: the file is rewritten under a reader who has it
 * open, and that reader is handed the new bytes.
 *
 * This is what the refcount buys over the bound it replaced. There is no
 * capacity here to age the path out of and no number that decides whether this
 * reader is still one — the subscription is open, so the body is re-read, and
 * that is true of the seventeenth open page exactly as of the first.
 */
test("a file a reader is holding is re-read for them when it moves", () =>
  withRuntime(
    { "a.olai": OUTLINE, "report.html": "<h1>Before</h1>\n" },
    ({ wired, store, root, reads }) =>
      Effect.gen(function*() {
        const open = yield* opening(wired.bound, "report.html")
        expect(yield* open.take).toEqual({
          rev: 1,
          text: "<h1>Before</h1>\n",
          refused: false,
        })

        fs.writeFileSync(path.join(root, "report.html"), "<h1>After</h1>\n")
        yield* store.refresh("cheap")

        expect(yield* open.take).toEqual({
          rev: 2,
          text: "<h1>After</h1>\n",
          refused: false,
        })
        expect(reads).toEqual(["report.html", "report.html"])
      }),
  ))

/**
 * And the half that could not be said before: the reader LEFT, so the file
 * stops being read.
 *
 * The negative is proven the way `./bodies.test.ts` proves its own — the body
 * reader is serial, so a read the revision should not have made would land
 * BEFORE the barrier read this test waits for. The head subscription is the
 * other half of the barrier: its second frame says the revision has been
 * published, which is the same statement that hands the moved paths to the body
 * reader.
 */
test("a file whose reader has gone is not re-read on a later revision", () =>
  withRuntime(
    { "a.olai": OUTLINE, "report.html": "<h1>Before</h1>\n" },
    ({ wired, store, root, reads }) =>
      Effect.gen(function*() {
        const open = yield* opening(wired.bound, "report.html")
        expect(yield* open.take).toEqual({
          rev: 1,
          text: "<h1>Before</h1>\n",
          refused: false,
        })

        // The reader goes away — a closed tab, a dropped socket, an agent that
        // took its frame and exited.
        yield* Fiber.interrupt(open.reader)

        const heads = wired.bound.handlers["surface/heads/get"]
        if (heads === undefined) throw new Error("the heads collection has no `get`")
        const moved = yield* watching(heads({ key: "report.html" }) as Stream.Stream<Head>)
        yield* moved.take
        fs.writeFileSync(path.join(root, "report.html"), "<h1>After</h1>\n")
        yield* store.refresh("cheap")
        yield* moved.take

        // The barrier: a body asked for by a reader who IS here, which the
        // serial reader cannot answer before anything the revision asked for.
        const again = yield* opening(wired.bound, "report.html")
        expect(yield* again.take).toEqual({
          rev: 2,
          text: "<h1>After</h1>\n",
          refused: false,
        })
        expect(reads).toEqual(["report.html", "report.html"])
      }),
  ))

/**
 * The birth-announce edge, closed by the same change (`./published.ts`).
 *
 * A reader may hold a `get` open on a key the directory does not hold yet — the
 * framework allows it, and a file appearing is what used to leave such a reader
 * with the announce frame's `null` and no body until it asked again. The hold is
 * taken by the SUBSCRIPTION rather than by a successful read, so the newborn
 * path has a holder the moment the revision names it, and the body follows the
 * announcement on the same key.
 */
test("a reader holding a key across a file's birth is handed the body", () =>
  withRuntime({ "a.olai": OUTLINE }, ({ wired, store, root }) =>
    Effect.gen(function*() {
      const open = yield* opening(wired.bound, "report.html")

      fs.writeFileSync(path.join(root, "report.html"), "<h1>Born</h1>\n")
      yield* store.refresh("cheap")

      // TWO frames, in this order: the upsert that says the collection has a new
      // key (which cannot carry a body — nothing has read one), and the body
      // read for the reader holding it. That order is `published.ts`'s
      // holder-across-birth contract, and this connector's apply-then-unread.
      expect(yield* open.take).toEqual({ rev: 2, text: null, refused: false })
      expect(yield* open.take).toEqual({
        rev: 2,
        text: "<h1>Born</h1>\n",
        refused: false,
      })
    })))

/**
 * A `.html` that is THERE and will not open. The subscription used to be held
 * open on the absent path until a body that would never come — a one-shot
 * `resources/read` hung. The refusal is a FRAME, so the reader is handed
 * the third state and leaves.
 *
 * Root can read a 0000 file, so the assertion is skipped there rather than
 * inverted (`@olai/chat`'s `memory.test.ts` makes the same call).
 */
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

/**
 * THE INVARIANT THE BROWSER'S SKEW RULE RESTS ON — pinned here, where it is
 * true, and not only in the client that depends on it.
 *
 * `@olai/web`'s `directory.ts` answers a `null` manifest beside a fold holding
 * files with "a directory": a tab holding files is holding a directory, because
 * a head only ever reaches the wire out of a published revision
 * (`manifest-fold-skew`). That is a fact about THIS file — `apply(collections?.heads,
 * revision.heads)` lives inside the manifest connector's `snapshot !== null`
 * arm — and a head published from any other path would turn the browser's rule
 * into a lie it has no way to catch.
 *
 * THE OTHER HALF OF THIS TEST IS GONE, and the per-file ruling of 2026-08-29 is
 * why. It used to start from a directory holding one outline the validator
 * refused, watch the manifest settle at `null` with not one head published, and
 * then fix the file. There is no such directory any more: a file the validator
 * finds something in is published with that file WITHHELD, so a served
 * directory always has a revision — and the one state that has none, a root
 * nothing can list, fails `Store.make` and takes the whole serve down with it
 * rather than reaching a browser. The `null` manifest remains a state of the
 * WIRE, which is why the client still resolves it, and the skew rule itself is
 * asserted where frames can be driven by hand (`@olai/web`'s
 * `directory.browsertest.ts`).
 *
 * So what is left here is the positive half, said over the directory that used
 * to produce the negative one: the broken outline's head ARRIVES, in the
 * opening snapshot, carrying its own rows — and its healthy neighbour arrives
 * beside it as though nothing were wrong, which it is not.
 */
test("a broken outline publishes its head, with its own rows on it", () =>
  withRuntime(
    { "a.olai": REFUSED, "b.olai": `{"id":"b","ord":"a0","title":"b"}\n` },
    ({ wired }) =>
      Effect.gen(function*() {
        const said = wired.bound.handlers["surface/manifest/get"]
        const framed = wired.bound.handlers["surface/heads/deltas"]
        if (said === undefined) throw new Error("the manifest cell has no `get`")
        if (framed === undefined) throw new Error("the heads collection has no `deltas`")

        const heads = yield* watching(
          framed({}) as Stream.Stream<CollectionDeltasMsg<string, Head>>,
        )
        const manifest = yield* watching(said({}) as Stream.Stream<Manifest>)
        const opened = yield* heads.take
        // A SET, from the first frame — never the `null` a refused directory
        // used to settle at.
        expect(yield* manifest.take).toEqual({})

        if (opened?.kind !== "snapshot") throw new Error("expected the opening snapshot")
        const entries = new Map(opened.entries)
        expect([...entries.keys()]).toEqual(["a.olai", "b.olai"])
        expect(entries.get("a.olai")?.broken?.errors.map((one) => one.code))
          .toEqual(["unknown-parent"])
        // …and the healthy neighbour is exactly what it would be in a directory
        // with nothing wrong with it at all.
        expect(entries.get("b.olai")?.broken).toBeNull()
      }),
  ))

/**
 * THE PINNED SHELF, published: the resolution happens here, and it happens
 * again when the directory moves.
 *
 * The claim is `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`'s mechanism sentence
 * made concrete for the one member that carries a reading rather than a file: a
 * pin stores an ADDRESS and no name, so what the shelf says a node is called is
 * true of the revision it was answered at — and a rename in some OTHER file
 * has to reach the sidebar with no reload and nothing asked.
 *
 * Proven from OUTSIDE the reading (`@olai/format`'s `shelf.test.ts` has that
 * function's own suite) and without a browser, which is what makes it a unit
 * test: what is under test is the wiring — that the cell is recomputed per
 * published revision, over the set that revision holds.
 */
test("the shelf is answered per revision, so a rename elsewhere renames the pin", () =>
  withRuntime(
    {
      "a.olai": OUTLINE,
      "Pins.olai": `{"id":"p","ord":"a0","title":"/#a"}\n`,
    },
    ({ wired, store, root }) =>
      Effect.gen(function*() {
        const get = wired.bound.handlers["surface/pins/get"]
        if (get === undefined) throw new Error("the pins cell has no `get`")

        const open = yield* watching(get({}) as Stream.Stream<Shelf>)
        const first = yield* open.take

        // The pinned node is retitled in the file it lives in — which is not
        // the shelf's file, and is the whole point: nothing about `Pins.olai`
        // changed.
        fs.writeFileSync(path.join(root, "a.olai"), `{"id":"a","ord":"a0","title":"b"}\n`)
        yield* store.refresh("cheap")
        const second = yield* open.take

        expect([first, second]).toEqual([
          [{ id: "p", title: "/#a", shows: { id: "a", name: "a" } }],
          [{ id: "p", title: "/#a", shows: { id: "a", name: "b" } }],
        ])
      }),
  ))

/**
 * …and a revision that moved no pin sends NOTHING, which is what the cell's
 * `equals` is for (`@olai/surface`'s spec).
 *
 * The shelf is recomputed on every revision — that is what the test above buys
 * — and the reading mints a fresh array each time, so without the guard every
 * open tab would get a frame for every keystroke anybody makes anywhere in the
 * vault, saying exactly what it already knew.
 *
 * PROVEN BY ORDER rather than by waiting, because there is nothing to wait for:
 * a frame that is never sent has no arrival to miss, and the shelf's own
 * connector is not the fiber any other barrier here synchronises with. So two
 * revisions are published — one that cannot change the shelf, then one that
 * must — and the NEXT frame is read: if the neutral revision had sent one, this
 * take would hand back the shelf as it already was.
 */
test("a revision that changes no pin sends no frame", () =>
  withRuntime(
    {
      "a.olai": OUTLINE,
      "Pins.olai": `{"id":"p","ord":"a0","title":"/#a"}\n`,
      "report.html": "<h1>Before</h1>\n",
    },
    ({ wired, store, root }) =>
      Effect.gen(function*() {
        const get = wired.bound.handlers["surface/pins/get"]
        if (get === undefined) throw new Error("the pins cell has no `get`")
        const open = yield* watching(get({}) as Stream.Stream<Shelf>)
        expect(yield* open.take).toEqual([
          { id: "p", title: "/#a", shows: { id: "a", name: "a" } },
        ])

        // A revision the shelf has nothing to say about: another file's bytes.
        fs.writeFileSync(path.join(root, "report.html"), "<h1>After</h1>\n")
        yield* store.refresh("cheap")
        // …and one it does: the pinned node, retitled where it lives.
        fs.writeFileSync(path.join(root, "a.olai"), `{"id":"a","ord":"a0","title":"b"}\n`)
        yield* store.refresh("cheap")

        expect(yield* open.take).toEqual([
          { id: "p", title: "/#a", shows: { id: "a", name: "b" } },
        ])
      }),
  ))

// ── which plugins this build has, and which this serve runs ────────────

/**
 * WHAT A COMPOSITION ROOT HANDS THE ROSTER — the two facts a browser is told,
 * with an inert runtime behind them.
 *
 * `plugins` is a runtime with nothing mounted on it, because these cases are
 * about the ROSTER's arithmetic and never about a plugin: what is running is the
 * second argument, handed in, so a case can say "the flag left it on and nothing
 * mounted" — which is a real state and the one the old derivation could not
 * express.
 *
 * ONE for the file rather than one per case, on a `standing` scope: nothing is
 * mounted on it, so there is nothing for a case to leave behind.
 */
const EMPTY_PLUGINS: Plugins = await standing()(
  openPlugins({ vars: {}, now: () => STARTED, served: "/tmp" }),
)

/** A REPORT SAYING THESE FIBERS ARE UP, which is what `running` is read off.
 *
 *  The roster asks the FIBER (through `@olai/bundle`'s `reportBundle`) rather
 *  than guessing from what a plugin happened to register. It guessed twice
 *  before — from the flag, then from the sibling and engine tables — and each
 *  guess was wrong for the first plugin that did not fit it. */
const mounted = (names: ReadonlyArray<string>): ReadonlyMap<string, RowReport> =>
  new Map(names.map((name) => [name, { state: "running" as const }]))

const offering = (
  pinned: ReadonlyArray<string> | null = null,
  report: ReadonlyMap<string, RowReport> = new Map(),
): PluginRuntime => ({
  plugins: EMPTY_PLUGINS,
  onChange: { run: () => {} },
  built: PLUGIN_NAMES,
  pinned,
  report,
})

/**
 * THE ROSTER CARRIES A ROW PER BUILT PLUGIN, and says of each whether it is
 * COMPOSED — which is the difference the preferences panel exists to draw. A
 * plugin left out of `--plugins` is absent from every structure the runtime
 * holds, so a roster derived only from what is composed could draw no row for
 * it at all.
 *
 * The `built` names are the BUNDLE'S, handed in rather than spelled, which is
 * the same discipline the flag's own `--help` sentence keeps: a third plugin
 * reaches this test, the flag and the panel with no line of any of them moving,
 * and this file — a general one — names none.
 */
test("every plugin the build has is on the roster, running or not", () => {
  // NOBODY SAID, so what mounted is the built-in default — not necessarily
  // every plugin this binary was built with, since a row may carry its own
  // `disabled` and be opt-in. The roster carries a row for every one of them
  // either way, which is the whole reason the two lists are separate arguments.
  const all = rosterOf(offering(null, mounted(DEFAULT_BUNDLE_NAMES)))
  expect(all.built.map((one) => one.name)).toEqual([...PLUGIN_NAMES])
  expect(all.built.filter((one) => one.running).map((one) => one.name))
    .toEqual([...DEFAULT_BUNDLE_NAMES])
  // ...and an opt-in row is a row that is THERE and off, which is the state a
  // panel has to be able to draw and a filter over the running set could not.
  expect(all.built.length).toBeGreaterThanOrEqual(DEFAULT_BUNDLE_NAMES.length)
  // `pinned` stays `null` rather than expanding into that list, because the row
  // under it has to say whether a person typed this policy or got the default.
  expect(all.pinned).toBeNull()

  // ...and one name out of the list leaves every other row present and off,
  // which is the row that could not exist if this were a filter. `running` is
  // WHAT MOUNTED and not what the flag said, which is the change this phase
  // makes to the word: the flag is the reason only one is up, and the roster
  // reports the runtime rather than re-reading the reason.
  const first = PLUGIN_NAMES[0]
  if (first === undefined) throw new Error("this build has no plugins to pin")
  const one = rosterOf(offering([first], mounted([first])))
  expect(one.built.map((row) => row.name)).toEqual([...PLUGIN_NAMES])
  expect(one.built.filter((row) => row.running).map((row) => row.name)).toEqual([first])
  expect(one.pinned).toEqual([first])
})

/**
 * A PLUGIN THE FLAG LEFT ON AND THE RUNTIME DID NOT MOUNT — the row the old
 * derivation could not draw at all.
 *
 * `running` used to be `isEnabled(pin, name)`, a second reading of the flag,
 * which was exact only because the filter ran once and nothing could move
 * afterwards. A plugin is a fiber now: it can sit `PENDING` on a service that
 * never arrived, or land in `FAILED` because its `apply` threw, and in both the
 * flag still says yes while the wire carries no `surface/<name>/` at all. The
 * roster says what is composed, so a browser drawing that row is told the truth
 * about it.
 */
test("a plugin the flag left on but nothing mounted draws as off", () => {
  const roster = rosterOf(offering())
  expect(roster.built.map((row) => row.name)).toEqual([...PLUGIN_NAMES])
  expect(roster.built.some((row) => row.running)).toBe(false)
  // ...and the flag is still reported as nobody having said, because nobody
  // did: the two facts are independent and the panel draws both.
  expect(roster.pinned).toBeNull()
})

/**
 * `--plugins=` IS A POLICY and saying nothing is the default, so the empty list
 * survives the crossing as itself. Collapsing it to `null` here would make the
 * two indistinguishable in the browser, where the only thing that tells them
 * apart is the line under the row.
 */
test("an empty flag crosses as an empty list, not as nobody having said", () => {
  const none = rosterOf(offering([]))
  expect(none.pinned).toEqual([])
  expect(none.built.some((row) => row.running)).toBe(false)
  expect(none.built.map((row) => row.name)).toEqual([...PLUGIN_NAMES])
})

/**
 * A RUNTIME WITH NO PLUGIN SLOT HAS NO ROSTER — which is what every runtime in
 * this file is, and what `olai surface` and the headless faces are. It composes
 * no sibling surface at all, so there is nothing for a row to be about; listing
 * the build's plugins as not running would be the server inventing a policy
 * nobody set, and it is the one arm here that a browser could be lied to by.
 */
test("no plugin slot is no roster, rather than every plugin off", () => {
  expect(rosterOf(null)).toEqual(NO_ROSTER)
})

/**
 * THE WORD, BESIDE THE BOOLEAN — five states where `running: false` was one,
 * and each of them is a different sentence under the row.
 *
 * `running` covered four different mornings with one `false`: the flag left it
 * out, the BUILD leaves it out until somebody asks, its `apply` threw, or it is
 * still waiting on something. A person who went looking for a chip that is not
 * there can act on exactly one of those, and the boolean threw away which.
 *
 * The word is composed from the LIVE reading and the boot snapshot together,
 * and the live one wins — which is what stops the roster telling two stories
 * about one plugin. Every case below asserts the boolean beside the word for
 * that reason.
 */
test("a row that is not running says which of the four absences it is", () => {
  const first = PLUGIN_NAMES[0]
  const second = PLUGIN_NAMES[1]
  if (first === undefined || second === undefined) {
    throw new Error("this test needs a build with two plugins")
  }

  // NOBODY SAID, and the loader declined to load it: that can only be the row's
  // own `disabled`, which is this build leaving it off until somebody asks.
  const optIn = rosterOf(offering(null, new Map([[first, { state: "off" }]])))
  expect(optIn.built.find((row) => row.name === first)?.state).toBe("optIn")
  expect(optIn.built.find((row) => row.name === first)?.running).toBe(false)

  // ...and the SAME snapshot under a flag is `off`, because somebody asked and
  // did not ask for this. One field, two layers, and `pinned` is the only thing
  // that can say which of them wrote it.
  const off = rosterOf(offering([second], new Map([[first, { state: "off" }], [second, { state: "running" }]])))
  expect(off.built.find((row) => row.name === first)?.state).toBe("off")

  // A START THAT THREW carries the plugin's own words, verbatim.
  const failed = rosterOf(
    offering(null, new Map([[first, { state: "failed", fault: "no socket at /run/x" }]])),
  )
  const row = failed.built.find((one) => one.name === first)
  expect(row?.state).toBe("failed")
  expect(row?.fault).toBe("no socket at /run/x")
  expect(row?.running).toBe(false)

  // ...and a throw with no message says a start threw and quotes nobody, rather
  // than putting core's paraphrase on screen as if the plugin had said it.
  const silent = rosterOf(offering(null, new Map([[first, { state: "failed" }]])))
  expect(silent.built.find((one) => one.name === first)?.state).toBe("failed")
  expect(silent.built.find((one) => one.name === first)?.fault).toBeUndefined()

  // STILL WAITING is not the same as off: it was asked for, it did load, and it
  // is short of something it injects.
  const waiting = rosterOf(offering(null, new Map([[first, { state: "waiting" }]])))
  expect(waiting.built.find((one) => one.name === first)?.state).toBe("waiting")
})

/**
 * THE BOOLEAN AND THE WORD COME OFF ONE READING, which is what makes them
 * unable to disagree.
 *
 * They used to come off two: `running` was the LIVE registry — what a plugin had
 * contributed — and `state` was the report. Keeping them coherent then took an
 * arm (a row the report called `running` and the live table did not know was
 * reported `off`), and the pair could still be read in an order that made them
 * contradict. Both are the FIBER now.
 *
 * IT IS ALSO WHY THE WORD IS NOT A GUESS. What a plugin registered is a proxy
 * for whether its fiber is up, and every proxy was wrong for the first plugin
 * that did not fit it: the flag said yes about a fiber `PENDING` on a service;
 * the sibling table said no about an ACP engine, which composes no surface, and
 * would say no about a browser-only plugin, whose server half registers nothing
 * at all. A row this reading calls `off` is a chunk the tab never fetches, so
 * that plugin is invisible with nothing failing anywhere.
 */
test("a plugin's row is its fiber's state, not what it happened to register", () => {
  const first = PLUGIN_NAMES[0]
  if (first === undefined) throw new Error("this build has no plugins")

  // A fiber that is UP is running, whether or not it put anything in a table
  // this file could have looked in.
  const up = rosterOf(offering(null, mounted([first])))
  const row = up.built.find((one) => one.name === first)
  expect(row?.running).toBe(true)
  expect(row?.state).toBe("running")
  expect(row?.fault).toBeUndefined()

  // ...and a fiber that FAILED is not running, whatever it managed to register
  // before it threw — the case the old two-clock reading could get backwards.
  const threw = rosterOf(
    offering(null, new Map([[first, { state: "failed", fault: "it threw once" }]])),
  )
  const bad = threw.built.find((one) => one.name === first)
  expect(bad?.running).toBe(false)
  expect(bad?.state).toBe("failed")
  expect(bad?.fault).toBe("it threw once")
})

/**
 * A ROW THE SNAPSHOT HAS NOTHING TO SAY ABOUT falls back to what `running:
 * false` has always meant on its own — which is what every runtime in this file
 * but this section's is, and what a serve that mounted doubles directly is.
 */
test("an empty report leaves the rows saying exactly what the boolean did", () => {
  const roster = rosterOf(offering([]))
  expect(roster.built.every((row) => row.state === "off")).toBe(true)
  expect(roster.built.every((row) => row.fault === undefined)).toBe(true)
})

/**
 * THE DOORBELL'S SENTENCE RIDES THE ROSTER, and only on a row that is RUNNING.
 *
 * The strip draws a scope control out of this cell, so the words it draws have
 * to be here — they are compiled in and move at most once per serve, which is
 * why they are on this roster rather than republished per conversation.
 *
 * The gate is the half worth a test. This roster carries a row per BUILT plugin
 * whether or not this serve composed it — that is the feature the rows above are
 * about — so a picker offered for a plugin that is OFF would store a pick
 * nothing will ever read. The halves are a parameter rather than a registry read
 * for the reason the names are: a general file names no plugin.
 */
test("a wake sentence reaches the roster, and never for a plugin this serve left out", () => {
  const [first, second] = PLUGIN_NAMES
  if (first === undefined || second === undefined) {
    throw new Error("this build has fewer than two plugins to tell apart")
  }
  const drawn = {
    subject: "wake on terminal activity",
    from: "terminals from",
    waiting: { one: "waiting sentence", many: "waiting sentences" },
    // WHICH FILES THE PICKER MAY OFFER, which is drawn in the sense that
    // matters: it is what the list is made of, and core cannot work it out.
    kinds: ["outline"] as const,
  }
  /** ... and the member that is NOT: a whole sentence per way this doorbell can
   *  stop watching. They are delivered into the transcript, and a browser has no
   *  occasion to write any of them. */
  const wake = {
    ...drawn,
    faults: {
      gone: "the file you woke on is not here any more",
      unwatchable: "the file you woke on is not one this can read",
    },
  }
  const wakes = new Map([[first, wake]])

  const all = rosterOf(offering(null, mounted(PLUGIN_NAMES)), wakes)
  // WHAT THE PICKER IS MADE OF, and not the sentences. A roster that carried a
  // delivered sentence would be putting a message on the wire for a reader that
  // never sends one — and the wire's own schema has no key for either.
  expect(all.built.find((row) => row.name === first)?.wake).toEqual(drawn)
  // A plugin that wakes nobody declares none, which is a whole plugin and the
  // ordinary case — absent rather than an empty sentence.
  expect(all.built.find((row) => row.name === second)?.wake).toBeUndefined()

  // ... and the row is still THERE when the flag leaves it out, saying it does
  // not run — with no picker on it.
  const pinned = rosterOf(offering([second], mounted([second])), wakes)
  expect(pinned.built.map((row) => row.name)).toEqual([...PLUGIN_NAMES])
  expect(pinned.built.find((row) => row.name === first)?.running).toBe(false)
  expect(pinned.built.find((row) => row.name === first)?.wake).toBeUndefined()
})

/** ... and a caller that only wants to know which plugins the build HAS says so
 *  by naming no wakes. The four cases above are that caller, and this is the
 *  claim they make read out loud. */
test("no wake declarations is no sentence, and every row is still there", () => {
  const all = rosterOf(offering(null, mounted(PLUGIN_NAMES)))
  expect(all.built.map((row) => row.name)).toEqual([...PLUGIN_NAMES])
  expect(all.built.every((row) => row.wake === undefined)).toBe(true)
})

/**
 * A PLUGIN THAT COMPOSES NO SIBLING IS STILL `running` — which is what an
 * ENGINE is, and what the word had stopped covering.
 *
 * `running` used to be read off the SIBLING TABLE, which was exact while every
 * plugin composed a surface. An engine composes none: what it contributes to a
 * tab already travels on the chat cell, which is core's, and a second surface
 * under `surface/claude/` would be one fact on the wire twice. So every engine
 * row said `off` while its fiber ran — and that is not merely a wrong word on a
 * preferences row: the TAB fetches a plugin's chunk only when the roster names
 * it, so the panel drew the generic mark for an agent whose own shape was
 * sitting in a chunk nobody had asked for. The e2e suite caught it; this is
 * where it is held.
 *
 * IT IS THE FIBER NOW rather than a wider guess at what counts as contributing,
 * which is why this case is stated over the two kinds rather than over the two
 * registries: a tenant that registers a sibling and an engine that registers
 * only an engine are both up, and a browser-only plugin — one whose server half
 * registers nothing at all — would be too, without this file learning a third
 * thing to look for.
 */
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
          ["an-engine", "running", true],
          ["a-tenant", "running", true],
        ])
        yield* Fiber.interrupt(open.reader)
      }),
    { plugins: [engineCalled("an-engine"), doubleCalled("a-tenant")] },
  ))

/** ...and the cell a browser actually reads carries it. The one member on this
 *  surface with no connector: the flag is read once, before the runtime exists,
 *  so there is nothing for a subscription to hear. */
test("the roster is served on the plugins cell", () =>
  withRuntime({ "a.olai": OUTLINE }, ({ wired }) =>
    Effect.gen(function*() {
      const get = wired.bound.handlers["surface/plugins/get"]
      if (get === undefined) throw new Error("the plugins cell has no `get`")
      const open = yield* watching(get({}) as Stream.Stream<PluginRoster>)
      expect(yield* open.take).toEqual(NO_ROSTER)
      yield* Fiber.interrupt(open.reader)
    })))

// ── a sibling that arrives after the bundle is composed ────────────────

/**
 * THE LIVE RE-COMPOSE, and the containment claim held on the one path where it
 * can actually be false.
 *
 * Every other case in this file mounts its doubles BEFORE `bind`, which is what
 * a real serve does: the bundle's rows are fibers before the store opens,
 * because a plugin teaches the vault its vocabulary. A sibling that arrives
 * AFTER that goes through `surfaces.register` → the root's `recompose` →
 * `runtime.mount`, and `mount` is TRANSACTIONAL: a surface whose deps do not
 * match it throws, with the roster and the running sources untouched.
 *
 * ## What that throw used to leave behind
 *
 * `Surfaces.register` set its table entry, called the root's re-compose, and
 * returned the disposer. A re-compose that threw exited the effect body BEFORE
 * the disposer existed, so the runtime had nothing to unwind: the refusing
 * fiber landed `FAILED` — which is what the claim says — and its sibling stayed
 * in `composed()`. The next plugin to register re-ran the re-compose, which
 * retried the same refused mount and threw inside THAT plugin's `apply`. One
 * mis-shaped surface took down every plugin that arrived after it, each failing
 * on somebody else's refusal, and the roster went on drawing the refused one as
 * running.
 *
 * ## Why the case is here rather than beside the service
 *
 * `@olai/plugin-api`'s own bench holds the same claim against a `changed` that
 * refuses, which is the unit. This is the INTEGRATION: the refusal is a real
 * `implementRootedSurfaces` mount refusing a real mis-shaped sibling, through
 * the real `recompose`, so the case cannot pass on a stand-in that throws where
 * the framework would not.
 */
test("a sibling the rooted bundle refuses takes only its own fiber down, and the next one still mounts", () =>
  withRuntime(
    { "a.olai": OUTLINE },
    ({ plugins, wired }) =>
      Effect.gen(function*() {
        if (plugins === null) throw new Error("this case needs the plugin runtime")
        const before = Object.keys(wired.bound.handlers).length

        // A surface with a cell and DEPS THAT DO NOT MENTION IT — the shape a
        // plugin's own `satisfies` makes unspellable in its own package, which
        // is why reaching it here takes a double rather than a tenant.
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

        // FAILED, and nothing of it on the wire. The WORD rather than a fiber
        // state: this file holds what a composition root can see, and what a
        // composition root can see is the four words the bridge answers with.
        expect((yield* refused.report).state).toBe("failed")
        expect(plugins.composed().map((one) => one.name)).toEqual([])
        expect(Object.keys(wired.bound.handlers).length).toBe(before)

        // ...and the next plugin in is untouched by it, which is the half that
        // was false: it composes, its tag is served, and the roster says so.
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
        expect(plugins.composed().map((one) => one.name)).toEqual(["healthy"])

        // The roster a browser reads carries the truth about both: the build has
        // no rows here (these doubles are not the bundle's), so what it says is
        // that nothing composed is missing and nothing refused is present.
        const get = wired.bound.handlers["surface/plugins/get"]
        if (get === undefined) throw new Error("the plugins cell has no `get`")
        const open = yield* watching(get({}) as Stream.Stream<PluginRoster>)
        expect((yield* open.take).built.map((row) => row.name)).toEqual([])
        yield* Fiber.interrupt(open.reader)
      }),
    { plugins: [] },
  ))

// ── the doorbell's two gates ───────────────────────────────────────────

/**
 * THE TWO CLAIMS THAT PUT A WAKE DECLARATION ON A REGISTRY AND A DELIVERY DOOR
 * ON A SERVICE — asserted where they are made, rather than left as paragraphs.
 *
 * ## The two things under test
 *
 * `wakes.register(…)` is a REGISTRATION rather than a field, and it has a
 * server reader that is the only one there is: the member that writes a scope
 * refuses a plugin this serve did not compose, and refuses one that declared no
 * wake (`./runtime.ts`'s `composedWake`). Either pick would store a row nothing
 * will ever read. So the three cases below are the three answers that gate can
 * give — and the first of them is now free rather than checked, because a
 * plugin that is not mounted has no registration in the table at all.
 *
 * The `Deliveries` door is keyed by the CALLING FIBER, and the key is a fence rather
 * than a filing convention: an unkeyed door would hand one plugin the
 * conversations a person scoped to ANOTHER, and would let one plugin sign
 * another's name onto a row that reaches an agent. The composition root used to
 * build one door per plugin and close over the name; the service reads
 * `this.ctx.fiber.name` instead, which is the word the registry bound the fiber
 * under and not something a caller can spell. So the last case takes two
 * plugins' doors and asks each of them both questions.
 *
 * WHAT A DELIVERY DOES ONCE IT IS THROUGH THE DOOR — the three arms, the held
 * bodies, the coalescing — is `@olai/chat`'s bench and deliberately not this
 * one. What this file owns is the COMPOSITION: who is offered a door, whose
 * rows are on it, and whose name is stamped on what goes out of it.
 *
 * ## The plugins are DOUBLES, and there is no registry to put back
 *
 * A composition root used to read its halves off a compiled-in array, so a case
 * that wanted a plugin declaring a wake beside one that declares none had to
 * `mock.module` the registry for the length of one boot and restore it in a
 * `finally` — a rewrite of a live ESM binding for the whole process, with every
 * later file in this package reading whatever was left installed.
 *
 * None of that is needed now. A plugin is a FIBER, so a double is a plugin
 * object mounted on a context this case owns, and the context goes away with
 * the case. Composing the BUILD's real plugins is still what the harness says
 * no to, and it is worse here than anywhere: a real half dials the daemon it is
 * a client of, so these cases would pass or fail on whether the machine running
 * the suite happens to be running somebody's appliance.
 *
 * A double carries nothing but what a composition root reads — an empty
 * surface, no faces, and an `apply` that records the door its fiber was handed.
 * This file still names no plugin, and what is under test is `./runtime.ts`'s
 * wiring rather than any tenant's.
 */

/** A whole surface with nothing on it. What a double contributes to the rooted
 *  bundle, and it is a real state rather than a convenience: an empty sibling
 *  composes to no tag, no handler and no expose row (`@olai/bundle`'s
 *  `composition.test.ts` holds it), so a runtime composed with these is byte
 *  for byte the runtime every other case in this file boots. */
const NOTHING = defineSurface({})

/** THE SENTENCE A DOUBLE DECLARES. Nothing under test here reads a word of it —
 *  the strip draws it and {@link rosterOf}'s cases carry it — and what matters
 *  is that it is PRESENT, because being declared at all is the question the
 *  gate asks. */
const RINGING = {
  subject: "wake on something",
  from: "the somethings of",
  waiting: { one: "sentence", many: "sentences" },
  /** WHICH FILES it can be pointed at — read by the fault cases below, which
   *  are what decides whether a stored pick is watchable at all. */
  kinds: ["outline"] as const,
  /** ... and the sentences, which the fault cases DO read a word of, because
   *  what they are about is that core INDEXES this table by the cause and
   *  carries the answer verbatim: that string, and nothing joined to it, is what
   *  reaches the conversation. The two differ so that a case asserting one is
   *  asserting the lookup and not merely the delivery. */
  faults: {
    gone: "the file this doorbell watched is not here any more, and nothing is being watched",
    unwatchable:
      "the file this doorbell is pointed at is not one it can read, and nothing is being watched",
  },
}

/**
 * ONE DOUBLE: a name, whether it rings, and a place to keep the door its fiber
 * was handed.
 *
 * `apply` is the whole of what the runtime calls, and the door it records is the
 * only way one is observable from outside at all — the service mints it per
 * call, off the calling fiber, and hands it back nowhere.
 *
 * THE TWO REVISION LISTENERS ARE NO-OPS AND MUST STILL BE HERE, for the reason
 * the two hooks they replace had to be: every published revision emits, so a
 * double that listened to neither would leave the events with no subscriber and
 * this file with no evidence they are driven at all. What a plugin MAKES of a
 * revision is its own bench; what this file owns is that core drives it.
 */
const doubleCalled = (name: string, wake?: typeof RINGING) => {
  let door: { scopes: Deliveries["scopes"]; deliver: (...args: Parameters<Deliveries["deliver"]>) => void } | undefined
  return {
    name,
    plugin: definePlugin({
      name,
      needs: [DeliveriesTag, Surfaces, Wakes],
      apply: Effect.gen(function*() {
        // The door is the SERVICE, as this plugin's own `needs` handed it over —
        // so what is recorded is exactly what this plugin can do, minted from the
        // name the registry bound it under and from nothing this file passed in.
        const deliveries = yield* DeliveriesTag
        door = {
          scopes: () => deliveries.scopes(),
          // RUN, because a case reads this door from outside an Effect: the
          // service's `deliver` is one, and the harness is the boundary.
          deliver: (...args) => void Effect.runFork(deliveries.deliver(...args)),
        }
        if (wake !== undefined) yield* (yield* Wakes).register(wake)
        yield* (yield* Surfaces).register({ surface: NOTHING, faces: {}, deps: {} })
        // NO VAULT DOORS HERE, and no `Vault` in the list above. Nothing in this
        // file asserts on them; what they are FOR — containment, and leaving with
        // the plugin — is `@olai/plugin-api`'s `services.test.ts`, against the
        // real ones.
      }),
    }),
    /** The door this double's fiber was handed. THROWS rather than answering an
     *  empty one, because a case that reaches for it before anything mounted
     *  this plugin is asking a question with no answer, and should say so where
     *  it asked rather than assert against a stand-in. */
    door: () => {
      if (door === undefined) throw new Error(`nothing mounted \`${name}\``)
      return door
    },
  }
}

/**
 * ONE DOUBLE THAT COMPOSES NO SIBLING — an ENGINE, which is the other kind of
 * plugin and the one that made `running` stop meaning "registered a surface".
 *
 * What it registers is the whole of what an engine registers and nothing else:
 * a name a person reads, a leg (opaque here — this file asserts on the ROSTER
 * and never reads a wire), a probe that answers "not on this host", no install
 * sentence, and the channel every engine olai ships rides. It is `at: () =>
 * null` deliberately: a plugin that CONTRIBUTED is `running` whether or not the
 * machine turned out to have the agent, which is the distinction the panel's
 * row and the chat's roster keep apart.
 */
const engineCalled = (name: string) => ({
  name,
  plugin: definePlugin({
    name,
    needs: [Agents],
    apply: Effect.gen(function*() {
      yield* (yield* Agents).register({
        name: ` (a name)`,
        leg: {} as Leg,
        at: () => null,
        prompt: { kind: "first-turn" },
      })
    }),
  }),
})

/**
 * A PLUGIN RUNTIME WITH `doubles` MOUNTED — what a composition root is handed,
 * built for one case.
 *
 * The whole runtime is opened, exactly as `./serve.ts` opens one: the doubles
 * name what they name and see what they named, which is the harness saying that
 * out loud rather than assembling a subset by hand. `doorFor` is the chat the
 * case built — asked per call, the way `./serve.ts` asks it, so a door minted
 * before the chat existed is not a door frozen empty.
 *
 * SCOPED to the case: the scope is never closed, because a runtime.test's
 * runtimes live as long as the case does and there is nothing here to hold open
 * against a second one.
 */
const mounting = (
  doubles: ReadonlyArray<{ readonly plugin: ReturnType<typeof definePlugin> }>,
  chat: () => Chat | null,
  onChange: { run: () => void },
): Effect.Effect<Plugins, never, Scope.Scope> =>
  Effect.gen(function*() {
    const plugins = yield* openPlugins({
      vars: {},
      now: () => STARTED,
      // The double's own directory, which none of these cases reads.
      served: "/tmp",
      doorFor: (who) => chat()?.doorFor(who) ?? null,
      changed: () => onChange.run(),
    })
    for (const one of doubles) yield* mountPlugin(plugins.host, one.plugin)
    return plugins
  })

/** The one conversation every case below is about — a PAIR, because a session
 *  id means nothing to the wrong agent (`@olai/chat`'s `scopes.ts`). */
const TALKING = { agent: "claude", session: "s-1" }

/** One kept pick, as the record hands it back. `at` is there for the cap's
 *  eviction order and nothing here reads it. */
const scoped = (plugin: string, file: string): Scoped => ({ ...TALKING, plugin, file })

/** What a pick and a ring look like once they have crossed. */
interface Picked {
  readonly to: { readonly agent: string; readonly session: string }
  readonly plugin: string
  readonly file: string | null
}
interface Rung {
  readonly to: { readonly agent: string; readonly session: string }
  readonly body: string
  readonly from: string
}

/**
 * A CHAT THAT IS NOTHING BUT ITS DOORBELL — the three members these gates
 * reach, and a death for every other one.
 *
 * `./runtime.ts` reads a chat for exactly two things while it binds (the state
 * cell's seed and the transcript's `readAll`) and answers every verb by handing
 * the call straight over, so a stub that answered `send` or `sessions` would be
 * a second account of a package that has its own bench. What the three members
 * here do is RECORD: a pick is a call that must have landed with the triple it
 * was made with, and a ring is a call that must carry the right name.
 *
 * `rang` IS A QUEUE, and that is a barrier rather than a shape. `deliver`
 * answers `void` and forks its Effect (`./runtime.ts`'s `ring`, which is why
 * that emitter exists), so a case reading an array would be asserting against
 * whatever had happened to arrive by the time it looked. A take waits for the
 * delivery to actually be made.
 *
 * Minted with `runSync` because the stub has to exist BEFORE the runtime that
 * will be handed it, and an unbounded queue holds nothing a scope would have to
 * close.
 */
const chatKeeping = (kept: ReadonlyArray<Scoped>): {
  readonly chat: Chat
  /** Every triple the gate let through, in order. */
  readonly picked: ReadonlyArray<Picked>
  /** ...and the next body that reached the chat, with the name CORE stamped on
   *  it rather than any the caller offered. */
  readonly rang: Effect.Effect<Rung>
  /** How many are waiting RIGHT NOW, for the cases whose claim is that
   *  something was NOT said. Only ever asked after a take that acts as the
   *  barrier: a delivery is forked, so an empty queue on its own says "not
   *  yet" as readily as it says "never". */
  readonly waiting: Effect.Effect<number>
} => {
  const picked: Array<Picked> = []
  /** THE TABLE MOVES, because `faults` is a WRITE and the cases about it are
   *  about what it wrote: the mark, the once-ness, and the row leaving the
   *  plugin's door. The rule in miniature — `@olai/chat`'s bench drives the
   *  real record, and what this file owns is who asks and whose words go in. */
  let rows: ReadonlyArray<Scoped> = kept
  const rang = Effect.runSync(Queue.unbounded<Rung>())
  /** Every member no gate here reaches. A DEATH rather than a refusal: a case
   *  that called one would be asking about something this file does not own,
   *  and a refusal it could catch would let it. */
  const elsewhere = Effect.die(new Error("this stub chat answers its doorbell and nothing else"))
  const chat: Chat = {
    entries: () => new Map(),
    state: () => CHAT_OFF,
    live: () => new Map(),
    // Olai has overheard nothing in a case about doorbells, and an empty table
    // is the honest answer rather than a death: the roster cell asks this on
    // every revision these cases publish, and a stub that died on it would fail
    // the wiring rather than the rule under test.
    overheard: () => [],
    // The two marks the migration gestures leave, and neither is a doorbell:
    // the real record is `@olai/chat`'s bench, and a case here that reached
    // one would be asking about something this file does not own. They answer
    // rather than die because they never refuse in the real chat either.
    assigned: () => Effect.void,
    assignedTo: () => Effect.void,
    replaced: () => Effect.void,
    reread: () => {},
    send: () => elsewhere,
    attach: () => elsewhere,
    resend: () => elsewhere,
    cancel: elsewhere,
    newSession: () => elsewhere,
    startAgentSession: () => elsewhere,
    chooseAgent: () => elsewhere,
    loadSession: () => elsewhere,
    reopen: elsewhere,
    sessions: elsewhere,
    answer: () => elsewhere,
    recordRefusal: () => Effect.void,
    start: Effect.void,
    stop: Effect.void,
    // ONE DOOR PER PLUGIN, the way the real chat hands them out: the filter and
    // the stamp are both inside the closure, so what this stub proves is that
    // `runtime.ts` asks for a door by name and bridges it — never that it does
    // the keying itself, which is the thing that moved out of that file.
    doorFor: (plugin: string) => ({
      // ... AND A FAULTED ROW IS NOT ON IT, which is the real chat's own filter
      // and is load-bearing for the fault cases: it is what the thunk below
      // reads to decide whether the sentence is still owed.
      scopes: () =>
        rows
          .filter((row) => row.plugin === plugin && row.fault === undefined)
          .map(({ agent, file, session }) => ({ agent, file, session })),
      ringing: (file) =>
        rows
          .filter((row) => row.plugin === plugin && row.fault === undefined && row.file === file)
          .map(({ agent, file, session }) => ({ agent, file, session })),
      deliver: (to: { readonly agent: string; readonly session: string }, say: () => string | null) =>
        Effect.suspend(() => {
          // THE THUNK IS ASKED HERE, at the moment the words would enter the
          // conversation — `null` is a body that has lost its subject and is
          // simply not said, which is the arm the fault's own thunk takes when
          // the file has come back in the meantime.
          const body = say()
          return body === null ? Effect.void : Queue.offer(rang, { to, body, from: plugin })
        }),
    }),
    scope: (to, plugin, file) =>
      Effect.sync(() => {
        picked.push({ to, plugin, file })
      }),
    faults: (judge) =>
      Effect.sync(() => {
        const fell: Array<Faulted> = []
        rows = rows.map((row) => {
          const wrong = judge(row.plugin, row.file)
          if (wrong === (row.fault ?? null)) return row
          if (wrong === null) {
            return { agent: row.agent, session: row.session, plugin: row.plugin, file: row.file }
          }
          const broken: Faulted = { ...row, fault: wrong }
          if (row.fault === undefined) fell.push(broken)
          return broken
        })
        return fell
      }),
  }
  return { chat, picked, rang: Queue.take(rang), waiting: Queue.size(rang) }
}

/** The scope verb off a bound runtime — the browser's own door onto the gate,
 *  driven the way `app.get` and `documents.get` are driven above. It is the
 *  BROWSER's alone, which `./faces.test.ts` holds as an exact set; what is
 *  asserted here is what happens once a tab has reached it. */
const scoping = (bound: Bound) => {
  const scope = bound.handlers["surface/chat/scope"]
  if (scope === undefined) throw new Error("the chat group has no `scope`")
  return (pick: Picked): Effect.Effect<void, { readonly reason: string }> =>
    scope({ ...pick.to, plugin: pick.plugin, file: pick.file }) as Effect.Effect<
      void,
      { readonly reason: string }
    >
}

/**
 * THE GATE'S FIRST ANSWER: a plugin this serve composed, whose half declares a
 * wake, gets the pick — whole, and with nothing about it re-decided here.
 *
 * The triple travels EXACTLY as it arrived, which is the half a reader should
 * check for a substitution rather than for an error: what this end must not do
 * is store "whichever conversation is open", because a picker somebody left
 * open can outlive the session under it and the chat is where that race is
 * answered.
 */
test("a scope naming a composed plugin that rings is written through, whole", () => {
  const ringer = doubleCalled("ringer", RINGING)
  const it = chatKeeping([])
  return withRuntime(
      { "a.olai": OUTLINE },
      ({ wired }) =>
        Effect.gen(function*() {
          yield* scoping(wired.bound)({ to: TALKING, plugin: ringer.name, file: "notes.olai" })
          expect(it.picked).toEqual([{ to: TALKING, plugin: ringer.name, file: "notes.olai" }])
        }),
      { chat: it.chat, plugins: [ringer] },
  )
})

/**
 * ...AND THE FIRST REFUSAL, which is the whole argument for the field being on
 * the SERVER door: the plugin declares a wake and this serve does not run it.
 *
 * A BUILT plugin left out of `--plugins` is exactly this state — the roster
 * still carries its row so preferences can say it is off ({@link rosterOf}),
 * and a picker drawn from a stale tab could still name it. So the refusal is
 * about THIS SERVE rather than about the build, and it is said in words the way
 * `chooseAgent` answers an agent id this machine does not have: a stale tab is
 * not a fault.
 *
 * The negative beside it is the one that matters — nothing was written. A gate
 * that refused and stored anyway would be a row nothing will ever read, kept
 * against the cap of a record that has one.
 */
test("a scope naming a plugin this serve did not compose is refused, in words", () => {
  const ringer = doubleCalled("ringer", RINGING)
  const quiet = doubleCalled("quiet")
  const it = chatKeeping([])
  return withRuntime(
      { "a.olai": OUTLINE },
      ({ wired }) =>
        Effect.gen(function*() {
          const said = yield* Effect.flip(
            scoping(wired.bound)({ to: TALKING, plugin: ringer.name, file: "notes.olai" }),
          )
          expect(said.reason).toContain(ringer.name)
          expect(it.picked).toEqual([])
        }),
      // The flag ran the OTHER one, which is what makes this about the serve:
      // the build has both halves and this process composed one of them.
      { chat: it.chat, plugins: [quiet] },
  )
})

/**
 * ...AND THE SECOND, on a plugin that IS composed: it declares no wake, so it
 * has no doorbell to point at anything.
 *
 * A plugin that wakes nobody is a whole plugin — no strip row, no picker, no
 * sentence — and this is what happens when a pick names one anyway. The two
 * refusals are separated deliberately: one arm is about what this serve RUNS
 * and the other about what the half DECLARES, and a case that composed nobody
 * would have proved only the first.
 */
test("a scope naming a composed plugin that declares no wake is refused, in words", () => {
  const ringer = doubleCalled("ringer", RINGING)
  const quiet = doubleCalled("quiet")
  const it = chatKeeping([])
  return withRuntime(
      { "a.olai": OUTLINE },
      ({ wired }) =>
        Effect.gen(function*() {
          const said = yield* Effect.flip(
            scoping(wired.bound)({ to: TALKING, plugin: quiet.name, file: "notes.olai" }),
          )
          expect(said.reason).toContain(quiet.name)
          expect(it.picked).toEqual([])
          // ...and the one that DOES ring, on the same runtime and the same
          // conversation, is written through — so what was refused was the
          // declaration and not the boot.
          yield* scoping(wired.bound)({ to: TALKING, plugin: ringer.name, file: "notes.olai" })
          expect(it.picked).toEqual([{ to: TALKING, plugin: ringer.name, file: "notes.olai" }])
        }),
      { chat: it.chat, plugins: [ringer, quiet] },
  )
})

/**
 * THE FENCE BETWEEN TWO PLUGINS' SCOPED CONVERSATIONS — one table, two doors,
 * and neither door can see or ring through the other.
 *
 * Both plugins are scoped IN THE SAME CONVERSATION, which is the case an
 * unkeyed door would get wrong invisibly: the pair is identical on both rows
 * and only the ownership triple's middle column tells them apart. So each door
 * answers with its own row and its own file, and the row a person wrote for the
 * other plugin is not on it.
 *
 * The stamp is the other half and it is the sharper one. `deliver` takes no
 * name — core closes over the plugin's own, exactly where it already closes
 * over `dial` — so what reaches the chat as the row's `rang` is data that
 * walked out of the registry rather than a word one plugin could sign another's
 * row with. Both doors ring, in order, and each body arrives under its own
 * plugin's name.
 */
test("each plugin's door carries only its own conversations, and rings under only its own name", () => {
  const ringer = doubleCalled("ringer", RINGING)
  const other = doubleCalled("other", RINGING)
  const it = chatKeeping([
    scoped(ringer.name, "ringer.olai"),
    scoped(other.name, "other.olai"),
  ])
  return withRuntime(
      // BOTH PICKED FILES ARE REALLY SERVED, which this case needs to say
      // nothing about and would otherwise be quietly about: a scope whose file
      // this directory does not hold is marked broken on the first revision and
      // leaves its plugin's door, which is a different case entirely (below).
      // What is under test here is the KEYING, so the files are ordinary ones.
      {
        "ringer.olai": `{"id":"r","ord":"a0","title":"r"}\n`,
        "other.olai": `{"id":"o","ord":"a0","title":"o"}\n`,
      },
      () =>
        Effect.gen(function*() {
          // ONE ROW EACH, and it is the row that names this plugin. The `plugin`
          // column itself is gone on the way out — a door that repeated it back
          // would be telling each plugin the one thing it already knows.
          expect(ringer.door().scopes()).toEqual([{ ...TALKING, file: "ringer.olai" }])
          expect(other.door().scopes()).toEqual([{ ...TALKING, file: "other.olai" }])

          ringer.door().deliver(TALKING, () => "the ringer's sentence")
          other.door().deliver(TALKING, () => "the other's sentence")

          expect(yield* it.rang).toEqual({
            to: TALKING,
            body: "the ringer's sentence",
            from: ringer.name,
          })
          expect(yield* it.rang).toEqual({
            to: TALKING,
            body: "the other's sentence",
            from: other.name,
          })
        }),
      { chat: it.chat, plugins: [ringer, other] },
  )
})

/**
 * ...AND THE DOOR A MACHINE WITH NO AGENT GETS, which is the same fence with
 * nothing behind it: a serve with no chat has no scope store either, so every
 * door answers the empty list and a delivery touches nothing.
 *
 * Worth a case of its own because of what it forecloses: a boot with the agent
 * merely off PATH must not be able to evict a person's picks, and this is the
 * arm where there is no table to evict from at all.
 */
test("a plugin composed into a chatless serve is handed a door onto nothing", () => {
  const ringer = doubleCalled("ringer", RINGING)
  return withRuntime({ "a.olai": OUTLINE }, () =>
      Effect.gen(function*() {
        expect(ringer.door().scopes()).toEqual([])
        // ...and the write end answers `void` rather than refusing, because a
        // watcher's sink has nowhere to put a refusal. Nothing to assert but
        // that it is callable and returns.
        expect(ringer.door().deliver(TALKING, () => "into the void")).toBeUndefined()
      }), { plugins: [ringer] })
})

/**
 * ...AND THE SCOPE WHOSE FILE STOPPED BEING SERVED — who notices, and whose
 * words the conversation gets.
 *
 * ## The defect these two cases are the absence of
 *
 * A person scopes a conversation to `lanes.olai`; somebody renames the file.
 * The plugin derives per revision over a file that is not there, so it derives
 * nothing — forever — while the strip goes on drawing the control as ON. The
 * conversation is silent in exactly the way a conversation with nothing to
 * report is silent, and this PR retires the hand-run fleet watch that was the
 * second opinion. QUIET-AND-FINE AND QUIET-BECAUSE-BROKEN MUST NOT LOOK ALIKE.
 *
 * ## What is under test HERE, and what is not
 *
 * The COMPOSITION, which is this file's whole subject: that core is what asks
 * the question (it holds the revision and the picks; the doorbell holds neither
 * once its file is gone), and that what reaches the conversation is the string
 * the PLUGIN DECLARED, byte for byte, with nothing joined to it. The once-ness,
 * the persistence and the healing are `@olai/chat`'s bench, over the real
 * record.
 *
 * ## THE SERVED SET, AND NOT THE DERIVATION'S `byFile`
 *
 * `documentAt` over the snapshot's SET is what answers "is this path still
 * served", and the second case is why. `byFile` groups PARSED RECORDS, so a
 * file that is present and empty — or present and torn — has no entry in it: a
 * scope pointed at one would read as gone, and a person who emptied their lane
 * file for a minute would be told their doorbell had broken, once, and never
 * told otherwise. That is the same disagreement `conventionServed` and
 * `conventionRecorded` are two doors for, decided the same way and for the same
 * reason.
 */

test("a scope whose file is not served is told, in the plugin's own words and nobody else's", () => {
  const ringer = doubleCalled("ringer", RINGING)
  const other = doubleCalled("other", RINGING)
  // Two picks in one conversation: one on a file this directory serves, one on
  // a file it does not. Only the second is a fault — and the rows are in this
  // order, so a delivery for the healthy one would arrive FIRST. That is what
  // makes the silence readable off the queue rather than off a timer.
  const it = chatKeeping([scoped(ringer.name, "a.olai"), scoped(other.name, "lanes.olai")])
  return withRuntime(
      { "a.olai": OUTLINE },
      () =>
        Effect.gen(function*() {

          // WHAT THE CONVERSATION GOT: the declared sentence, whole. Core knows
          // the path and does not put it in — a sentence with core's hole
          // punched in it is the shape the whole `wake` split refuses.
          expect(yield* it.rang).toEqual({
            to: TALKING,
            body: RINGING.faults.gone,
            from: other.name,
          })
          // ... and the healthy pick was not mentioned, which is the half that
          // says this is a fault and not a heartbeat.
          expect(yield* it.waiting).toBe(0)
          // THE BROKEN ROW IS OFF ITS PLUGIN'S DOOR, and the healthy one is
          // still on its own. There is nothing to watch, so the doorbell does
          // not ring for it — and neither does anything else a plugin does per
          // scope, which is how "alive and quiet" is kept apart from "watching
          // nothing" by construction.
          expect(other.door().scopes()).toEqual([])
          expect(ringer.door().scopes()).toEqual([{ ...TALKING, file: "a.olai" }])
        }),
      { chat: it.chat, plugins: [ringer, other] },
  )
})

test("a file that is served and EMPTY is not a file that is gone", () => {
  // The honest source of truth is the SET, which holds a place for every served
  // file including the ones that hold no records. A reading off the derivation's
  // `byFile` would call this one missing — and the person who emptied it for a
  // minute would be told, once and never corrected, that their doorbell had
  // broken.
  //
  // THE SECOND PICK IS THE BARRIER. A delivery is forked, so an empty queue
  // proves nothing on its own; a pick on a file that really is missing gives
  // this case something to WAIT for, and the empty file's row sits ahead of it,
  // so a delivery for it would have to arrive first.
  const ringer = doubleCalled("ringer", RINGING)
  const other = doubleCalled("other", RINGING)
  const it = chatKeeping([scoped(ringer.name, "empty.olai"), scoped(other.name, "lanes.olai")])
  return withRuntime(
      { "a.olai": OUTLINE, "empty.olai": "" },
      () =>
        Effect.gen(function*() {
          expect((yield* it.rang).from).toBe(other.name)
          expect(yield* it.waiting).toBe(0)
          // ... and the empty file's scope is still on the door, where the
          // plugin can go on watching a file somebody is in the middle of
          // rewriting.
          expect(ringer.door().scopes()).toEqual([{ ...TALKING, file: "empty.olai" }])
        }),
      { chat: it.chat, plugins: [ringer, other] },
  )
})

/**
 * ...AND A SCOPE ON A FILE THAT IS SERVED AND CANNOT BE READ — the second cause,
 * and the one a picker-only fix would have left silent.
 *
 * The picker offered every file the directory serves, documents included (the
 * human's screenshot, 2026-09-01). A document has no NODES, so a wake that
 * derives its set from a file's records watches the empty set for ever — no
 * wake, no digest, and a heartbeat still reporting a live watcher. Filtering
 * the picker stops NEW picks; it does nothing about the ones already on the
 * disk, so those are judged per revision here exactly as a rename is.
 *
 * WHAT IS UNDER TEST IS THE COMPOSITION: that core compares the plugin's
 * declared `kinds` against the registry's answer for the path, and that the
 * sentence which reaches the conversation is the OTHER declared string —
 * `unwatchable`, not `gone`. Getting that wrong would tell somebody their file
 * had been renamed while it sat in front of them.
 */
test("a scope on a served file its doorbell cannot read is told, in the OTHER declared sentence", () => {
  const ringer = doubleCalled("ringer", RINGING)
  const other = doubleCalled("other", RINGING)
  // Both files are served. Only the second is a kind this doorbell declared,
  // and the healthy row is first, so a delivery for it would arrive first.
  const it = chatKeeping([scoped(ringer.name, "a.olai"), scoped(other.name, "notes.md")])
  return withRuntime(
      { "a.olai": OUTLINE, "notes.md": "# notes\n" },
      () =>
        Effect.gen(function*() {
          expect(yield* it.rang).toEqual({
            to: TALKING,
            body: RINGING.faults.unwatchable,
            from: other.name,
          })
          expect(yield* it.waiting).toBe(0)
          // ... and the row is off the door for the same reason a renamed one
          // is: nothing is being watched, so nothing this plugin does per scope
          // may go on happening — a heartbeat over it most of all.
          expect(other.door().scopes()).toEqual([])
          expect(ringer.door().scopes()).toEqual([{ ...TALKING, file: "a.olai" }])
        }),
      { chat: it.chat, plugins: [ringer, other] },
  )
})

// ── the two gestures that move a node agent's binding ──────────────────
//
// Both are COMPOSED at this root rather than passed through, and both are two
// acts that only make sense together: a property through the ops layer, and a
// mark in the record of what olai has overheard (`@olai/chat`'s `sessions.ts`).
// What the cases below hold is the seam between those halves — the order, the
// refusal, and the one fact each gesture leaves behind for the next session to
// be taught by.

/** A stub roster carrier: which nodes are node agents, and which of them are
 *  already talking through a conversation. The other two readings are nobody's
 *  business here — the cell is not published in these cases and the teaching
 *  is the chat's. */
const rosterOfNodes = (rows: ReadonlyArray<NodeAgent>): Roster => ({
  seen: () => {},
  agentAt: () => null,
  nodeAt: (node) => rows.find((row) => row.id === node) ?? null,
  nodes: () => rows,
  nearestAt: (node, candidates) => candidates.has(node) ? node : null,
  above: () => null,
  rowsWith: () => [],
})

/** One node agent as the vault's own reading answers it. */
const nodeAgent = (over: Partial<NodeAgent> = {}): NodeAgent => ({
  id: "a",
  file: "a.olai",
  title: "a",
  engine: "claude",
  session: null,
  memory: 0,
  ...over,
})

/**
 * A stub chat that can OPEN a conversation and writes down what it is told.
 *
 * `chatKeeping` above answers a doorbell and dies on everything else, which is
 * right for its cases and wrong for these: what these are about is the two
 * members that were added for the migration, plus the one verb the fresh
 * session runs first. Every other member still dies.
 */
const chatOpening = (opens: ReadonlyArray<string>): {
  readonly chat: Chat
  /** The conversations marked as having ARRIVED by assignment, in order. */
  readonly assigned: ReadonlyArray<{
    readonly node: string | null
    readonly agent: string
    readonly session: string
  }>
  /** ... and the ones olai replaced, with what replaced them. */
  readonly replaced: ReadonlyArray<
    { readonly agent: string; readonly session: string; readonly by: string }
  >
} => {
  const assigned: Array<{
    readonly node: string | null
    readonly agent: string
    readonly session: string
  }> = []
  const replaced: Array<
    { readonly agent: string; readonly session: string; readonly by: string }
  > = []
  const elsewhere = Effect.die(new Error("this stub chat opens conversations and nothing else"))
  /** Which conversation the panel is in — moved by `newSession`, exactly as the
   *  real one is: the verb answers with nothing and the state is where every
   *  reader learns which conversation appeared. */
  let at = -1
  const chat: Chat = {
    entries: () => new Map(),
    state: () => ({
      ...CHAT_OFF,
      session: at < 0 || opens[at] === undefined
        ? null
        : { id: opens[at] as string, title: null, updatedAt: null },
    }),
    live: () => new Map(),
    overheard: () => [],
    assigned: (to) => Effect.sync(() => void assigned.push({ node: null, ...to })),
    assignedTo: (node, to) => Effect.sync(() => void assigned.push({ node, ...to })),
    replaced: (to, by) => Effect.sync(() => void replaced.push({ ...to, by })),
    reread: () => {},
    send: () => elsewhere,
    attach: () => elsewhere,
    resend: () => elsewhere,
    cancel: elsewhere,
    newSession: () => Effect.sync(() => void (at += 1)),
    startAgentSession: () => Effect.sync(() => void (at += 1)),
    chooseAgent: () => elsewhere,
    loadSession: () => elsewhere,
    reopen: elsewhere,
    sessions: elsewhere,
    answer: () => elsewhere,
    recordRefusal: () => Effect.void,
    scope: () => elsewhere,
    start: Effect.void,
    stop: Effect.void,
    doorFor: () => ({ scopes: () => [], ringing: () => [], deliver: () => elsewhere }),
    faults: () => elsewhere,
  }
  return { chat, assigned, replaced }
}

/** The two procedures, by the tags they are bound under. */
const assigning = (bound: Bound) => {
  const assign = bound.handlers["surface/chat/assignSession"]
  if (assign === undefined) throw new Error("the chat group has no `assignSession`")
  return (input: { readonly node: string; readonly agent: string; readonly session: string }) =>
    assign(input) as Effect.Effect<void, { readonly reason: string }>
}

const starting = (bound: Bound) => {
  const start = bound.handlers["surface/chat/startAgentSession"]
  if (start === undefined) throw new Error("the chat group has no `startAgentSession`")
  return (input: { readonly node: string; readonly agent: string }) =>
    start(input) as Effect.Effect<void, { readonly reason: string }>
}

/** What the file says now — the durable half, read where it actually landed
 *  rather than off a snapshot this harness took before the write. */
const propertyIn = (root: string, file: string, id: string): string | undefined => {
  for (const line of fs.readFileSync(path.join(root, file), "utf8").split("\n")) {
    if (line.trim() === "") continue
    const row = JSON.parse(line) as {
      readonly id: string
      readonly custom?: Record<string, unknown>
    }
    if (row.id === id) return row.custom?.["agent-session"] as string | undefined
  }
  return undefined
}

/**
 * ASSIGNING A CHAT is one property and one mark, in that order.
 *
 * The order is the guarantee: the property IS the assignment, so a mark written
 * before a write that then failed would be a session believing it had been
 * assigned to a node that never claimed it. And the mark is what the session is
 * taught by on its next message — the distillation order rather than the
 * standing law — which is the whole reason this is a procedure at all rather
 * than an `edit.apply` from a browser.
 */
test("a chat assigned to a bare node lands as one property, and is marked as having arrived that way", () => {
  const it = chatOpening([])
  return withRuntime(
    { "a.olai": OUTLINE },
    ({ wired, root }) =>
      Effect.gen(function*() {
        yield* assigning(wired.bound)({
          node: "a",
          agent: "claude",
          session: "fake-stored-new",
        })
        // THE ENGINE AND THE SESSION AS ONE VALUE, off the chat: a property
        // naming one engine and another engine's conversation would be a node
        // agent nobody could open.
        expect(propertyIn(root, "a.olai", "a")).toBe("claude:fake-stored-new")
        expect(it.assigned).toEqual([{
          node: "a",
          agent: "claude",
          session: "fake-stored-new",
        }])
      }),
    // NO ROSTER AT ALL is a serve whose vault reading has not arrived, and a
    // node it says nothing about is a node nothing is talking through — which
    // is the ordinary case for a bare row.
    { chat: it.chat },
  )
})

/**
 * ... AND A NODE ALREADY TALKING THROUGH ONE REFUSES, in a plain sentence.
 *
 * One agent, one current session. The browser dims such a node where somebody
 * can see it before pressing, which is a courtesy; THIS is the check, because a
 * tab decides against the frame it was drawn on and two tabs can be looking at
 * one node.
 *
 * The negative beside it is the half that matters: nothing was written, and
 * nothing was marked. A refusal that had already rewritten the property would
 * be the one outcome a person cannot undo by pressing anything.
 */
test("a node already talking through a conversation refuses, and nothing is written", () => {
  const it = chatOpening([])
  return withRuntime(
    { "a.olai": OUTLINE },
    ({ wired, root }) =>
      Effect.gen(function*() {
        const said = yield* Effect.flip(assigning(wired.bound)({
          node: "a",
          agent: "claude",
          session: "fake-stored-new",
        }))
        expect(said.reason).toContain("already talking through a conversation")
        expect(said.reason).toContain("one agent, one current session")
        expect(propertyIn(root, "a.olai", "a")).toBeUndefined()
        expect(it.assigned).toEqual([])
      }),
    {
      chat: it.chat,
      agents: rosterOfNodes([nodeAgent({ session: "fake-session-1" })]),
    },
  )
})

/**
 * A FRESH SESSION records what it replaced, so the conversation it replaced is
 * not orphaned.
 *
 * Nothing else records it: no `/clear` happened, so no adapter has anything to
 * say about this supersession (`@olai/chat`'s `succession.ts`). Without the
 * mark the node agent's own previous conversation comes back under Unassigned,
 * inviting somebody to assign it to the node it already belonged to — which is
 * the one node that would refuse it.
 */
test("a fresh session on a bound node re-points the property and records what it replaced", () => {
  const it = chatOpening(["fake-session-2"])
  return withRuntime(
    { "a.olai": OUTLINE },
    ({ wired, root }) =>
      Effect.gen(function*() {
        yield* starting(wired.bound)({ node: "a", agent: "claude" })
        expect(propertyIn(root, "a.olai", "a")).toBe("claude:fake-session-2")
        expect(it.replaced).toEqual([
          { agent: "claude", session: "fake-session-1", by: "fake-session-2" },
        ])
      }),
    {
      chat: it.chat,
      agents: rosterOfNodes([nodeAgent({ session: "fake-session-1" })]),
    },
  )
})

/** ... and a node that had no session replaced nothing, which is every press of
 *  the `•••` verb this procedure was written for. */
test("starting a session on an unbound node records no supersession", () => {
  const it = chatOpening(["fake-session-1"])
  return withRuntime(
    { "a.olai": OUTLINE },
    ({ wired, root }) =>
      Effect.gen(function*() {
        yield* starting(wired.bound)({ node: "a", agent: "claude" })
        expect(propertyIn(root, "a.olai", "a")).toBe("claude:fake-session-1")
        expect(it.replaced).toEqual([])
      }),
    { chat: it.chat, agents: rosterOfNodes([nodeAgent()]) },
  )
})

/** ... and neither does an agent that answers with the conversation the node
 *  was already in, which is what the scripted agent does on every open: a
 *  session must not be recorded as having superseded itself. */
test("a fresh session that comes back as the same conversation supersedes nothing", () => {
  const it = chatOpening(["fake-session-1"])
  return withRuntime(
    { "a.olai": OUTLINE },
    ({ wired }) =>
      Effect.gen(function*() {
        yield* starting(wired.bound)({ node: "a", agent: "claude" })
        expect(it.replaced).toEqual([])
      }),
    {
      chat: it.chat,
      agents: rosterOfNodes([nodeAgent({ session: "fake-session-1" })]),
    },
  )
})

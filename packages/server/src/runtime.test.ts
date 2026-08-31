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
import type { Chat, Scoped } from "@olai/chat"
import { PLUGIN_NAMES } from "@olai/plugins/wire"
import * as pluginsDoor from "@olai/plugins/server"
import type { PluginServices } from "@olai/plugins/server"
import type { CollectionDeltasMsg } from "@kolu/surface/define"
import { defineSurface } from "@kolu/surface/define"
import { NO_KINDS } from "@olai/format"
import * as Store from "@olai/store"
import { NodeServices } from "@effect/platform-node"
import { expect, mock, test } from "bun:test"
import { Effect, Fiber, Queue, Stream, SubscriptionRef } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { watchFault } from "./fault.ts"
import { hostname } from "./hostname.ts"
import { type Bound, bind, gitWiring, rosterOf, writerAt } from "./runtime.ts"

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
     *  `@olai/store`'s `body`, which is the one door `./bodies.ts` may use.
     *  Recorded rather than mocked: the real read still happens. */
    readonly reads: ReadonlyArray<string>
  }) => Effect.Effect<A, unknown>,
  /**
   * The two slots the doorbell's gates need and no other test here does —
   * OPTIONAL, so the ten cases above say nothing about either and get exactly
   * the boot they always got.
   *
   * `chat` is the panel this runtime answers for, absent by default because a
   * directory is readable whether or not an agent is installed and every
   * reading test here is that machine. `plugins` is WHICH NAMES this serve
   * runs: `undefined` is no plugin slot at all ({@link rosterOf}'s
   * `NO_ROSTER`), `[]` is the slot with nobody in it, and a list is the flag
   * somebody typed. What is BEHIND those names is whatever
   * {@link withDoubles} has put in the registry for the duration — this
   * harness composes what the runtime is handed and never looks inside it.
   */
  extra: {
    readonly chat?: Chat
    readonly plugins?: ReadonlyArray<string>
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
    const wired = yield* bind({
      store,
      chat: extra.chat ?? null,
      ops,
      writer: "web",
      hostname: hostname(),
      startedAt: STARTED,
      // NO PLUGINS, unless a case asked for names. Every runtime in this file
      // but the doorbell's is a reader — a bound face, an MCP route — and none
      // of them is about a terminal door or a CI chip; dialing whatever daemons
      // happen to be on the machine running the suite would make these tests
      // depend on them. `null` is the OFF setting, and what it produces is a
      // surface with no `surface/<name>/` on it at all: an empty sibling record
      // composes to no tag, no handler and no expose row, so olai's own group
      // is byte for byte what it always was.
      //
      // The doorbell's cases DO take the slot, and they still dial nothing:
      // what stands behind their names is a double with no appliance under it
      // ({@link withDoubles}).
      plugins: extra.plugins === undefined ? null : {
        env: {},
        now: () => STARTED,
        served: root,
        names: extra.plugins,
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
    return yield* use({ wired, ops, store, reads, root })
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
      const agent = writerAt(wired.bound, ops, "mcp")

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
 * THE ROSTER IS READ OFF THE REGISTRY, not off what was composed, and that is
 * the difference the preferences panel exists to draw: a composed list is the
 * plugins that are ON, and the panel draws a row per plugin the BUILD has and
 * says of each whether it runs. A plugin left out of `--plugins` is absent from
 * every structure the runtime holds, so a roster derived from what was composed
 * could only ever draw rows that all say yes.
 *
 * The names are the REGISTRY'S, read here rather than spelled, which is the
 * same discipline the flag's own `--help` sentence keeps: a third plugin
 * reaches this test, the flag and the panel with no line of any of them moving,
 * and this file — a general one — names none.
 */
test("every plugin the build has is on the roster, running or not", () => {
  const all = rosterOf({ env: {}, now: () => STARTED, served: "/tmp" })
  expect(all.built.map((one) => one.name)).toEqual([...PLUGIN_NAMES])
  // Nobody said, so all of them run — and `pinned` stays `null` rather than
  // expanding into that list, because the row under it has to say whether a
  // person typed this policy or got the built-in default.
  expect(all.built.every((one) => one.running)).toBe(true)
  expect(all.pinned).toBeNull()

  // ...and one name out of the list leaves every other row present and off,
  // which is the row that could not exist if this were a filter.
  const first = PLUGIN_NAMES[0]
  if (first === undefined) throw new Error("this build has no plugins to pin")
  const one = rosterOf({ env: {}, now: () => STARTED, served: "/tmp", names: [first] })
  expect(one.built.map((row) => row.name)).toEqual([...PLUGIN_NAMES])
  expect(one.built.filter((row) => row.running).map((row) => row.name)).toEqual([first])
  expect(one.pinned).toEqual([first])
})

/**
 * `--plugins=` IS A POLICY and saying nothing is the default, so the empty list
 * survives the crossing as itself. Collapsing it to `null` here would make the
 * two indistinguishable in the browser, where the only thing that tells them
 * apart is the line under the row.
 */
test("an empty flag crosses as an empty list, not as nobody having said", () => {
  const none = rosterOf({ env: {}, now: () => STARTED, served: "/tmp", names: [] })
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
  const wake = {
    subject: "wake on terminal activity",
    from: "terminals from",
    waiting: { one: "waiting sentence", many: "waiting sentences" },
  }
  const halves = [{ name: first, wake }, { name: second }]

  const all = rosterOf({ env: {}, now: () => STARTED, served: "/tmp" }, halves)
  expect(all.built.find((row) => row.name === first)?.wake).toEqual(wake)
  // A plugin that wakes nobody declares none, which is a whole plugin and the
  // ordinary case — absent rather than an empty sentence.
  expect(all.built.find((row) => row.name === second)?.wake).toBeUndefined()

  // ... and the row is still THERE when the flag leaves it out, saying it does
  // not run — with no picker on it.
  const pinned = rosterOf({ env: {}, now: () => STARTED, served: "/tmp", names: [second] }, halves)
  expect(pinned.built.map((row) => row.name)).toEqual([...PLUGIN_NAMES])
  expect(pinned.built.find((row) => row.name === first)?.running).toBe(false)
  expect(pinned.built.find((row) => row.name === first)?.wake).toBeUndefined()
})

/** ... and a caller that only wants to know which plugins the build HAS says so
 *  by naming no halves. The four cases above are that caller, and this is the
 *  claim they make read out loud. */
test("no halves is no sentence, and every row is still there", () => {
  const all = rosterOf({ env: {}, now: () => STARTED, served: "/tmp" })
  expect(all.built.map((row) => row.name)).toEqual([...PLUGIN_NAMES])
  expect(all.built.every((row) => row.wake === undefined)).toBe(true)
})

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

// ── the doorbell's two gates ───────────────────────────────────────────

/**
 * THE TWO CLAIMS THAT PUT `wake` ON THE PLUGIN SERVER DOOR AND A DELIVERY DOOR
 * ON THE SERVICES BLOB — asserted where they are made, rather than left as
 * paragraphs.
 *
 * ## The two things under test
 *
 * `PluginServerHalf.wake` sits on the SERVER half rather than on the manifest
 * because it has a SERVER READER, and that reader is the only one there is: the
 * member that writes a scope refuses a plugin this serve did not compose, and
 * refuses one whose half declares no wake (`./runtime.ts`'s `composedWake`).
 * Either pick would store a row nothing will ever read. So the three cases
 * below are the three answers that gate can give.
 *
 * `PluginServices.deliveries` is built PER PLUGIN, and the key is a fence
 * rather than a filing convention: an unkeyed door would hand one plugin the
 * conversations a person scoped to ANOTHER, and would let one plugin sign
 * another's name onto a row that reaches an agent. So the last case takes the
 * doors two plugins were handed and asks each of them both questions.
 *
 * WHAT A DELIVERY DOES ONCE IT IS THROUGH THE DOOR — the three arms, the held
 * bodies, the coalescing — is `@olai/chat`'s bench and deliberately not this
 * one. What this file owns is the COMPOSITION: who is offered a door, whose
 * rows are on it, and whose name is stamped on what goes out of it.
 *
 * ## The halves are DOUBLES, and the registry is put back
 *
 * A composition root reads its halves off `@olai/plugins`' compiled-in
 * registry, so a case that wants a plugin declaring a wake beside one that
 * declares none has to say what the registry holds for the length of one boot.
 * Composing the BUILD's real halves is what the harness above already says no
 * to, and it is worse here than there: a real half dials the daemon it is a
 * client of, so these cases would pass or fail on whether the machine running
 * the suite happens to be running somebody's appliance.
 *
 * A double carries nothing but what a composition root reads — a name, an empty
 * surface, no faces, and a `serve` that records the door it was handed. That is
 * the same restraint {@link rosterOf}'s own cases keep one section up, where
 * the halves are two literals: this file still names no plugin, and what is
 * under test is `./runtime.ts`'s wiring rather than any tenant's.
 */

/** The real door, COPIED OUT before any double is installed — an ESM import is
 *  a live binding and `mock.module` rewrites it in place, so a restore that
 *  read the imported namespace back would be handing the mock to itself
 *  (`@olai/format`'s `set.walks.test.ts` spells out the same dance). */
const REGISTRY = { ...pluginsDoor }

/** A whole surface with nothing on it. What a double contributes to the fused
 *  group, and it is a real state rather than a convenience: an empty sibling
 *  composes to no tag, no handler and no expose row (`@olai/plugins`'
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
}

/**
 * ONE DOUBLE: a name, whether it rings, and a place to keep the door it was
 * handed.
 *
 * `serve` is the whole of what a composition root calls, and what it records is
 * the only way a door is observable from outside at all — core builds one per
 * plugin, hands it over, and reads it back nowhere.
 */
const halfCalled = (name: string, wake?: typeof RINGING) => {
  let door: PluginServices["deliveries"] | undefined
  return {
    name,
    surface: NOTHING,
    faces: {},
    ...(wake === undefined ? {} : { wake }),
    serve: (services: PluginServices) => {
      door = services.deliveries
      return { deps: {} }
    },
    /** The door this half was handed. THROWS rather than answering an empty
     *  one, because a case that reaches for it before anything composed this
     *  half is asking a question with no answer, and should say so where it
     *  asked rather than assert against a stand-in. */
    door: (): PluginServices["deliveries"] => {
      if (door === undefined) throw new Error(`nothing composed \`${name}\``)
      return door
    },
  }
}

/**
 * Run `body` against a registry holding `halves`, and put the real one back
 * whatever happens.
 *
 * THE RESTORE IS NOT TIDINESS. `mock.module` rewrites a live binding for the
 * whole process and `bun test` loads one file after another into it, so a
 * double left installed would be the registry every LATER file in this package
 * reads — and the failure it caused would be attributed to whichever of them
 * happened to compose a plugin.
 *
 * NOT a `beforeEach`/`afterEach` pair, and the window is the reason: the halves
 * differ per case, and a runtime reads the registry at the moment it composes.
 * So the double stands around ONE boot rather than for the length of the file,
 * which is also what keeps every other case here reading the registry it always
 * read.
 */
const withDoubles = async <A>(
  halves: ReadonlyArray<ReturnType<typeof halfCalled>>,
  body: () => Promise<A>,
): Promise<A> => {
  mock.module("@olai/plugins/server", () => ({ ...REGISTRY, SERVERS: halves }))
  try {
    return await body()
  } finally {
    mock.module("@olai/plugins/server", () => REGISTRY)
  }
}

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
const chatKeeping = (rows: ReadonlyArray<Scoped>): {
  readonly chat: Chat
  /** Every triple the gate let through, in order. */
  readonly picked: ReadonlyArray<Picked>
  /** ...and the next body that reached the chat, with the name CORE stamped on
   *  it rather than any the caller offered. */
  readonly rang: Effect.Effect<Rung>
} => {
  const picked: Array<Picked> = []
  const rang = Effect.runSync(Queue.unbounded<Rung>())
  /** Every member no gate here reaches. A DEATH rather than a refusal: a case
   *  that called one would be asking about something this file does not own,
   *  and a refusal it could catch would let it. */
  const elsewhere = Effect.die(new Error("this stub chat answers its doorbell and nothing else"))
  const chat: Chat = {
    entries: () => new Map(),
    state: () => CHAT_OFF,
    send: () => elsewhere,
    attach: () => elsewhere,
    resend: () => elsewhere,
    cancel: elsewhere,
    newSession: () => elsewhere,
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
      scopes: () =>
        rows
          .filter((row) => row.plugin === plugin)
          .map(({ agent, file, session }) => ({ agent, file, session })),
      deliver: (to: { readonly agent: string; readonly session: string }, say: () => string | null) =>
        Queue.offer(rang, { to, body: say() ?? "", from: plugin }),
    }),
    scope: (to, plugin, file) =>
      Effect.sync(() => {
        picked.push({ to, plugin, file })
      }),
  }
  return { chat, picked, rang: Queue.take(rang) }
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
  const ringer = halfCalled("ringer", RINGING)
  const it = chatKeeping([])
  return withDoubles([ringer], () =>
    withRuntime(
      { "a.olai": OUTLINE },
      ({ wired }) =>
        Effect.gen(function*() {
          yield* scoping(wired.bound)({ to: TALKING, plugin: ringer.name, file: "notes.olai" })
          expect(it.picked).toEqual([{ to: TALKING, plugin: ringer.name, file: "notes.olai" }])
        }),
      { chat: it.chat, plugins: [ringer.name] },
    ))
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
  const ringer = halfCalled("ringer", RINGING)
  const quiet = halfCalled("quiet")
  const it = chatKeeping([])
  return withDoubles([ringer, quiet], () =>
    withRuntime(
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
      { chat: it.chat, plugins: [quiet.name] },
    ))
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
  const ringer = halfCalled("ringer", RINGING)
  const quiet = halfCalled("quiet")
  const it = chatKeeping([])
  return withDoubles([ringer, quiet], () =>
    withRuntime(
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
      { chat: it.chat, plugins: [ringer.name, quiet.name] },
    ))
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
  const ringer = halfCalled("ringer", RINGING)
  const other = halfCalled("other", RINGING)
  const it = chatKeeping([
    scoped(ringer.name, "ringer.olai"),
    scoped(other.name, "other.olai"),
  ])
  return withDoubles([ringer, other], () =>
    withRuntime(
      { "a.olai": OUTLINE },
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
      { chat: it.chat, plugins: [ringer.name, other.name] },
    ))
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
  const ringer = halfCalled("ringer", RINGING)
  return withDoubles([ringer], () =>
    withRuntime({ "a.olai": OUTLINE }, () =>
      Effect.gen(function*() {
        expect(ringer.door().scopes()).toEqual([])
        // ...and the write end answers `void` rather than refusing, because a
        // watcher's sink has nowhere to put a refusal. Nothing to assert but
        // that it is callable and returns.
        expect(ringer.door().deliver(TALKING, () => "into the void")).toBeUndefined()
      }), { plugins: [ringer.name] }))
})

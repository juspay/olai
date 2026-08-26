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
  codec,
  fixedPolicy,
  make as makeOps,
  type Ops,
  type Store as OutlineStore,
} from "@olai/ops"
import type { DocumentEntry, Head, Manifest, Shelf } from "@olai/surface"
import type { CollectionDeltasMsg } from "@kolu/surface/define"
import * as Store from "@olai/store"
import { NodeServices } from "@effect/platform-node"
import { expect, test } from "bun:test"
import { Effect, Fiber, Queue, Stream, SubscriptionRef } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { watchFault } from "./fault.ts"
import { frozenPolicy } from "./serve.testlib.ts"
import { type Bound, bind, gitWiring, writerAt } from "./runtime.ts"

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
      chat: null,
      ops,
      writer: "web",
      git: gitWiring(
        ops,
        frozenPolicy({ commit: "off", push: null }),
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
/** A set the codec refuses: a row whose parent nothing declares. It has to be
 *  a MEANING error and not a syntax one — a file that will not parse keeps its
 *  key and carries its errors (the hybrid scope, `Head.broken`), so the set
 *  still validates and heads still travel. This one leaves the store with no
 *  snapshot at all, which is the state the manifest's `null` is for. */
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
 * (`manifest-fold-skew`). That is a fact about THIS file and about nowhere
 * else — `apply(collections?.heads, revision.heads)` lives inside the manifest
 * connector's `snapshot !== null` arm — and a head published from any other
 * path would turn the browser's rule into a lie it has no way to catch: a
 * directory that never loaded, drawn as one.
 *
 * So the two are asked TOGETHER, over one directory that starts refused and
 * then validates. Before: `null`, and not one head. After: a set, and the head
 * that arrives is the revision's.
 */
test("a directory that never loaded publishes no head, and the first head is the revision's", () =>
  withRuntime({ "a.olai": REFUSED }, ({ wired, store, root }) =>
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
      const never = yield* manifest.take

      fs.writeFileSync(path.join(root, "a.olai"), OUTLINE)
      yield* store.refresh("cheap")
      const arrived = yield* heads.take
      const loaded = yield* manifest.take

      // A SET THAT NEVER VALIDATED: the settled `null`, and a snapshot with
      // nothing in it. Not one head — which is the whole claim.
      expect(never).toBeNull()
      expect(opened).toEqual({ kind: "snapshot", entries: [] })

      // …and the head that finally arrives arrives WITH the revision that
      // published it, on the same statement as the cell's `{}`.
      expect(loaded).toEqual({})
      expect(arrived?.kind).toBe("delta")
      expect(
        arrived?.kind === "delta" ? arrived.upserts.map(([file]) => file) : [],
      ).toEqual(["a.olai"])
    })))

/**
 * THE PINNED SHELF, published: the resolution happens here, and it happens
 * again when the directory moves.
 *
 * The claim is `docs/brainstorming/vault-in-browser.md`'s mechanism sentence
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

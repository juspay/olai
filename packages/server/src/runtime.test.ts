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

import { codec, make as makeOps, type Ops, type Store as OutlineStore } from "@olai/ops"
import type { DocumentEntry, Head } from "@olai/surface"
import * as Store from "@olai/store"
import { NodeServices } from "@effect/platform-node"
import { expect, test } from "bun:test"
import { Effect, Fiber, Stream, SubscriptionRef } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { watchFault } from "./fault.ts"
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
    const ops = makeOps({ store, root, commits: "off" })
    const wired = yield* bind({
      store,
      chat: null,
      ops,
      writer: "web",
      git: gitWiring(ops, yield* SubscriptionRef.make(0)),
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
        expect([...frames]).toEqual([{ rev: 1, text: "<h1>Cabinet quote</h1>\n" }])

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
        const set = yield* SubscriptionRef.get(store.snapshot)
        expect(set?.value.set.documents).toEqual([{ file: "report.html", text: null }])
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

        // TWO frames: the one this subscription opens with, and the one the
        // rewrite below produces. Collected on a fiber of its own, because the
        // second one cannot arrive until the probe has run.
        const watching = yield* Effect.forkChild(
          Stream.runCollect(
            Stream.take(get({ key: "report.html" }) as Stream.Stream<Head>, 2),
          ),
        )

        fs.writeFileSync(path.join(root, "report.html"), "<h1>After</h1>\n")
        yield* store.refresh

        const frames = [...yield* Fiber.join(watching)]
        // A head and nothing else — no `text` key at all, not even a `null`.
        expect(frames.map((frame) => Object.keys(frame))).toEqual([["rev"], ["rev"]])
        expect(frames[0]?.rev).toBeLessThan(frames[1]?.rev ?? 0)

        // THE POINT. The file changed under a reader who is watching it, and
        // nothing opened it: no body was read, so none was sent, and the path
        // never entered the watch set (`./bodies.ts`).
        expect(reads).toEqual([])
      }),
  ))

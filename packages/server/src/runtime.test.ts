/**
 * One runtime, several faces, several writers — the rebinding, as a fence.
 *
 * `writerAt` is what lets an `olai web` serve its own websocket as `web` and,
 * over the same store and the same cells, an attached `olai mcp` as `mcp`. The
 * END of that is proven where it can be seen from outside — `mcp/serve.test.ts`
 * reads `X-Olai-Writer: mcp` out of a repository an attached session committed
 * into, from a process whose own door is `web`.
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

import { codec, make as makeOps } from "@olai/ops"
import type { OutlineError, OutlineSet } from "@olai/format"
import * as Store from "@olai/store"
import { NodeServices } from "@effect/platform-node"
import { expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { watchFault } from "./fault.ts"
import { bind, gitWiring, writerAt } from "./runtime.ts"

/** Every member whose answer records WHO asked, as the wire spells them. A
 *  LITERAL rather than a derivation, deliberately: the thing under test is that
 *  a list somebody maintains by hand still says what they think it says, and a
 *  second derivation of it would agree with the first by construction. */
const RECORDS_THE_WRITER = ["surface/git/commit", "surface/ops/run"]

test("a face served under another writer differs by exactly the members that record one", async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-runtime-")))
  fs.writeFileSync(path.join(root, "a.jsonl"), `{"id":"a","ord":"a0","title":"a"}\n`)

  await Effect.gen(function*() {
    const store: Store.Store<OutlineSet, ReadonlyArray<OutlineError>> = yield* Store.make({
      root,
      codec,
      watch: false,
      settle: "10 millis",
    })
    const ops = makeOps({ store, root, commits: "off" })
    const wired = yield* bind({
      store,
      chat: null,
      ops,
      writer: "web",
      git: gitWiring(ops, "web", yield* SubscriptionRef.make(0)),
    })
    // The runtime's `done` REJECTS when it is closed, so something has to hold
    // that catch or the teardown here is an unhandled rejection the runner
    // attributes to whichever test happened to be running — `fault.ts`'s job,
    // and the same pair every other test that binds a runtime keeps.
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))
    yield* Effect.addFinalizer(() => runtime.stopped)

    const agent = writerAt(wired.bound, ops, "mcp")

    // The RECORD is the group's, exactly — which is also what `restrictHandlers`
    // asserts before any face binds, so a mis-derived tag is a boot crash rather
    // than a hole. Said here too because this is where the tags are derived.
    expect(Object.keys(agent).sort()).toEqual(Object.keys(wired.bound.handlers).sort())

    const rebound = Object.keys(wired.bound.handlers).filter(
      (tag) => agent[tag] !== wired.bound.handlers[tag],
    )
    expect(rebound.sort()).toEqual(RECORDS_THE_WRITER)
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer), Effect.runPromise)
})

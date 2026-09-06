/**
 * THE RECORDS, SERVED — this row's half of a revision, and the four readings a
 * page is drawn out of.
 *
 * WHAT THIS ROW OWNS is `outlines` (every `.olai` file, keyed by path, with its
 * records), the `page`, `narrowing`, `tagCompletions` and `moving` streams, the
 * `vocabulary` and `nodes` lookups, its three `ops` reads and its share of the
 * two write envelopes. The vault remains the write authority: nothing here
 * writes a file, and every change on the disk arrives back through
 * `Vault.revision` like any other. Everything is acquired on THIS provider's
 * scope, so withdrawing the row drops the projection and the collection's
 * entries together — which is what makes outlines genuinely absent rather than
 * quiet (`packages/tests/features/content_capabilities.feature`).
 *
 * `root: true`, AND SO IS `olai-plugin-markdown`, which looks like two rows
 * claiming one tag and is the arrangement the phase is built on. A root mount
 * keeps its bare `surface/edit/apply` and `surface/ops/run` beside its scoped
 * `surface/outlines/...` alias, so the wire a browser speaks does not change
 * shape when a row goes away. Two roots may claim one tag only because their
 * `dispatch` CASES are disjoint: `./surface.ts` declares this row's twenty-odd
 * edit verbs, markdown declares `doc`/`docNew`, pins declares `pin`, and
 * `@olai/server`'s `composition.ts` refuses the mount outright if two owners
 * overlap a case, disagree on the dispatch field, disagree on write authority,
 * disagree on exposure, or carry different payload/success/error ASTs for the
 * shared envelope. That is why {@link surface}'s envelopes come from
 * `@olai/surface/dispatch` rather than being spelled here: one spelling is a
 * requirement of the mount, not a convenience.
 *
 * `writes: ["surface/ops/run"]` is the same claim on the OTHER axis — which of
 * this row's tags the write reservation covers — and `scopedFaces` names the
 * browser map a second time on purpose: `faces` is what the ROOT alias grants
 * and `scopedFaces` is what the namespaced tag grants, and the agent face is
 * deliberately in only the first. Copying the agent map into `scopedFaces`
 * would advertise a second, namespaced set of the same tools.
 */
import { definePlugin, Directory, Ops, Surfaces, Vault } from "@olai/plugin-api/services"
import type { Ops as Gate } from "@olai/ops"
import { Effect } from "effect"
import { inMemoryChannel, type ImplementSurfaceDeps, type SurfaceRuntime } from "@kolu/surface/server"
import type { Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { applyEdit, runWrite } from "@olai/edit-intents/apply"
import { surface, faces, dispatch } from "./surface.ts"
import { name } from "./name.ts"
export { name } from "./name.ts"
import type { Projection } from "@olai/surface/projection"
import { outlineProjection, type OutlineEntry } from "./wire.ts"
import { samePageReading, sameNarrowing, sameMoving } from "@olai/format"
import type { FiledPageReading } from "@olai/format"

export default definePlugin({
  /** `Directory` IS NEEDED AND NOT READ, which is a claim about ORDER rather
   *  than an oversight. This half touches no store — the records it publishes
   *  come from `Vault.revision` and the writes go through `Ops` — but it must
   *  not compose before there is a served directory to compose against, and
   *  `needs` is the only place that can be said. It was read here once, for a
   *  `store` binding nothing used. */
  name, needs: [Directory, Ops, Vault, Surfaces],
  apply: Effect.gen(function*() {
    const gate = (yield* Ops).gate as Gate
    const vault = yield* Vault
    let ctx: SurfaceRuntime<typeof surface.spec>["ctx"] | undefined
    let held: Projection<OutlineEntry> | undefined
    /** WHAT `readAll` ANSWERS BEFORE THE FIRST REVISION, and after the vault
     *  unloads — one shared value rather than a fresh `new Map()` per call,
     *  because `readAll` is asked once per subscriber and an empty map minted
     *  per ask is a new identity per ask. There is exactly one thing it can
     *  say, so there is no reason for two of it. */
    const empty = new Map<string, OutlineEntry>()
    /**
     * ONE PULSE FOR EVERY OPEN STREAM, carrying nothing.
     *
     * A stream's `install` is what wakes a subscription, and what wakes all
     * four of this row's is a published revision — the same one for every
     * reader, whatever they are subscribed to. So the channel carries `void`:
     * it says "the directory moved", the framework re-runs each subscriber's
     * `read` with its own input, and `isEqual` below decides whether the
     * answer is worth a frame. A channel per stream, or a payload naming what
     * changed, would be this row deciding which readers care — which is the
     * decision `isEqual` already makes from the ANSWER rather than from a
     * guess about it, and the only one that cannot be wrong. It is `pins`'
     * `equals` argument (`olai-plugin-pins`'s `surface.ts`) one member shape
     * over, and it is why a filtered page settles on a keystroke without the
     * page beside it re-sending a row.
     */
    const revisions = inMemoryChannel<void>()
    yield* vault.revision<Snapshot<Reading>>(snapshot => Effect.sync(() => {
      const next = outlineProjection(snapshot, held)
      held = next
      for (const [key, value] of next.change.upserts) ctx?.collections.outlines.upsert(key, value)
      for (const key of next.change.removes) ctx?.collections.outlines.remove(key)
      revisions.publish(undefined)
    }))
    yield* vault.unloaded(Effect.sync(() => {
      for (const key of held?.change.entries.keys() ?? []) ctx?.collections.outlines.remove(key)
      held = undefined
      revisions.publish(undefined)
    }))
    const deps: ImplementSurfaceDeps<typeof surface.spec> = {
      onStreamReadError: (error, { stream }) => {
        Effect.runFork(Effect.logWarning(`outlines ${stream} read failed: ${String(error)}`))
      },
      collections: {
        /**
         * `upsert` and `remove` ARE NO-OPS, and that is not a stub.
         *
         * These are the deps a WRITER would use, and this collection has no
         * writer: an outline is a file on the disk, and the only way to change
         * one is the ops layer, whose writes come back through the probe like
         * every change anyone else makes. What actually pushes deltas is the
         * `Vault.revision` callback above, through `ctx.collections.outlines`
         * — the runtime handle the `published` callback hands back — so the
         * frames a subscriber gets are minted from a published revision and
         * from nothing else. Answering them here as well would be a second
         * writer for one collection, free to disagree with the projection
         * about what the directory says.
         *
         * `readAll` hands back the projection's own map BY REFERENCE, which is
         * safe for the reason `@olai/surface`'s `projection.ts` argues at
         * length: the entries and the deltas are written in one statement, so
         * there is no moment at which this map holds something the wire was
         * not told.
         */
        outlines: { readAll: () => held?.change.entries ?? empty, upsert: () => {}, remove: () => {},  }
      },
      /** Every `read` here crosses out of this plugin's scope with
       *  `Effect.runPromise`, because the framework's `read` is a promise and
       *  the ops gate is an Effect. That is also why a failure lands on
       *  `onStreamReadError` above rather than tearing the fiber down: one
       *  reader's bad address must not withdraw the row from everyone.
       *
       *  `tagCompletions` is the one `isEqual` that is not a named
       *  equivalence from `@olai/format`, and the reason is that its answer is
       *  a short capped list of words with no identity to compare — the popup
       *  asks for as many rows as it draws. A structural walk would be a second
       *  spelling of "these are the same words"; `JSON.stringify` over a list
       *  that size is the cheaper honest one. */
      streams: {
        page: { read: input => Effect.runPromise(Effect.map(gate.page(input), value => value as FiledPageReading)), install: (_input, onEvent) => revisions.consume({onEvent, onError: () => {}}), isEqual: samePageReading },
        narrowing: { read: input => Effect.runPromise(gate.narrowing(input)), install: (_input, onEvent) => revisions.consume({onEvent, onError: () => {}}), isEqual: sameNarrowing },
        tagCompletions: { read: input => Effect.runPromise(gate.tags(input)), install: (_input, onEvent) => revisions.consume({onEvent, onError: () => {}}), isEqual: (a,b) => JSON.stringify(a) === JSON.stringify(b) },
        moving: { read: input => Effect.runPromise(gate.moving(input)), install: (_input, onEvent) => revisions.consume({onEvent, onError: () => {}}), isEqual: sameMoving }
      },
      procedures: {
        edit: { apply: ({ input }) => applyEdit(gate, input) },
        vocabulary: { tags: ({ input }) => gate.tags(input) },
        nodes: { named: ({ input }) => gate.named(input), homes: ({ input }) => gate.homes(input) },
        ops: { outlines: () => gate.outlines, node: ({ input }) => gate.node(input), subtree: ({ input }) => gate.subtree(input), run: ({ input }) => runWrite(gate, input) },
      },
    }
    yield* (yield* Surfaces).register({ surface, faces, dispatch, writes: ["surface/ops/run"], root: true, scopedFaces: { browser: faces.browser }, deps, published: value => { ctx = value as typeof ctx } })
  }),
})

export { dispatch } from "./surface.ts"

export { slotContracts as slots } from "./slots.ts"

/** Static sibling metadata matches the browser-owned client. Agent grants
 * belong to the standalone aliases registered by this activation, so copying
 * them here would advertise a second set of namespaced agent tools. */
import { faces as standaloneFaces } from "./surface.ts"
const siblingFaces = { browser: standaloneFaces.browser }
export { siblingFaces as faces }
export { surface } from "./surface.ts"

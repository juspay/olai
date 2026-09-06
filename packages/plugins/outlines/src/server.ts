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
 * THIS ROW REGISTERED `root: true` UNTIL #546, and so did markdown, pins,
 * files, trash, capture, search, vault and vault-plugins. A root mount kept
 * every member answering under a BARE tag as well as its own —
 * `surface/edit/apply` beside `surface/outlines/edit/apply` — because those
 * were the tags of the monolith these rows were cut out of. Six rows sharing
 * `surface/edit/apply` then needed `dispatch` to say whose verbs were whose,
 * and `@olai/server`'s `composition.ts` needed five refusals to make the
 * sharing safe: overlapping cases, disagreeing fields, disagreeing write
 * authority, disagreeing exposure, or different payload/success/error ASTs.
 *
 * Every one of those is gone. This row answers `surface/outlines/edit/apply`
 * and `surface/outlines/ops/run`, markdown answers its own, and there is
 * nothing at composition left to prove. What survives is the SPELLING:
 * {@link surface}'s envelopes still come from `@olai/surface/dispatch`, now
 * because one `Edit` schema across the rows is what lets `@olai/edit-history`
 * route a keystroke by verb without knowing which row will take it, and
 * `./surface.ts`'s `dispatch` const is what tells it.
 *
 * `writes: ["surface/ops/run"]` is the same claim on the OTHER axis — which of
 * this row's tags the write reservation covers. It names the tag as THIS
 * surface spells it; the composition root is what puts it under
 * `surface/outlines/`. Four rows carrying the identical string is four rows
 * each naming their own member.
 *
 * `faces` IS THE WHOLE GRANT. It stood beside a `scopedFaces` that held the
 * same map, because while the bare tags existed `faces` granted those and
 * `scopedFaces` granted the qualified ones — and the agent map was on the bare
 * set alone, since putting it on both would have advertised one tool under two
 * names. With one name per member there is one map, and an agent that may
 * reach `ops.run` at all reaches it here.
 */
import { definePlugin, Directory, Ops, Surfaces, Vault } from "@olai/plugin-api/services"
import type { Ops as Gate } from "@olai/ops"
import { Effect } from "effect"
import { inMemoryChannel, type ImplementSurfaceDeps, type SurfaceRuntime } from "@kolu/surface/server"
import type { Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { applyEdit, runWrite } from "@olai/edit-intents/apply"
import { surface, faces, resources } from "./surface.ts"
/** THIS ROW'S AGENT VERBS ({@link ./tools.ts}), handed to the host beside its
 *  faces. They were entries in `@olai/ops`' one closed table until #546, which
 *  meant a general package named this row's vocabulary and a serve without this
 *  row still advertised them; declaring them here is what makes switching the
 *  row off take its tools along. */
import { tools } from "./tools.ts"
import { name } from "./name.ts"
export { name } from "./name.ts"
import type { Projection } from "@olai/surface/projection"
import { outlineProjection } from "./projection.ts"
import type { OutlineEntry } from "./wire.ts"
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
    yield* (yield* Surfaces).register({ surface, faces, resources, tools, writes: ["surface/ops/run"], deps, published: value => { ctx = value as typeof ctx } })
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

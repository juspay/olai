/**
 * THE BODIES, SERVED — this row's half of a revision, and the one collection in
 * olai whose values do not all travel.
 *
 * WHAT THIS ROW OWNS is `documents` (every bodied file, keyed by path),
 * `documentPage` (one bodied file's metadata reading), its two `ops` reads and
 * its share of the two write envelopes. The vault remains the write authority:
 * nothing here writes a file, and every change on the disk arrives back through
 * `Vault.revision` like any other. Everything is acquired on THIS provider's
 * scope, so withdrawing the row drops the projection, the body reader and the
 * collection's entries together — which is what makes markdown genuinely
 * absent rather than quiet (`packages/tests/features/content_capabilities.feature`).
 *
 * THIS ROW REGISTERED `root: true` UNTIL #546, and so did outlines and seven
 * others. A root mount kept every member answering under a BARE tag as well as
 * its own — `surface/edit/apply` beside `surface/markdown/edit/apply` —
 * because those were the tags of the monolith these rows were cut out of. This
 * row and outlines SHARING one bare tag was the arrangement the phase was
 * built on, and it cost `dispatch` to say whose verbs were whose plus five
 * refusals in `@olai/server`'s `composition.ts` to make the sharing safe:
 * overlapping cases, disagreeing fields, disagreeing write authority,
 * disagreeing exposure, or different payload/success/error ASTs.
 *
 * Every one of those is gone. This row answers `surface/markdown/edit/apply`
 * and `surface/markdown/ops/run`, outlines answers its own, and there is
 * nothing at composition left to prove. What survives is the SPELLING:
 * {@link surface}'s envelopes still come from `@olai/surface/dispatch`, now
 * because one `Edit` schema across the rows is what lets `@olai/edit-history`
 * route a keystroke by verb without knowing which row will take it, and
 * `./surface.ts`'s `dispatch` const is what tells it.
 *
 * `writes: ["surface/ops/run"]` is the same claim on the OTHER axis — which of
 * this row's tags the write reservation covers. It names the tag as THIS
 * surface spells it; the composition root is what puts it under
 * `surface/markdown/`.
 *
 * `faces` IS THE WHOLE GRANT. It stood beside a `scopedFaces` that held the
 * same map, because while the bare tags existed `faces` granted those and
 * `scopedFaces` granted the qualified ones — and the agent map was on the bare
 * set alone, since putting it on both would have advertised one tool under two
 * names. With one name per member there is one map.
 *
 * `resources` is the THIRD projection beside them: which of this row's members
 * an MCP adapter gives a `surface://` address to (`documents`), which needs the
 * member's KIND and so cannot be read off a tag set.
 */
import { definePlugin, Directory, Ops, Surfaces, Vault } from "@olai/plugin-api/services"
import type { Ops as Gate, Store } from "@olai/ops"
import { Effect } from "effect"
import { inMemoryChannel, type ImplementSurfaceDeps, type SurfaceRuntime } from "@kolu/surface/server"
import { type Reading, samePageReading } from "@olai/format"
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
import { documentProjection } from "./projection.ts"
import type { DocumentEntry } from "./wire.ts"
import type { FiledPageReading } from "@olai/format"
import * as Bodies from "./server/bodies.ts"

export default definePlugin({
  name, needs: [Directory, Ops, Vault, Surfaces],
  apply: Effect.gen(function*() {
    const store = (yield* Directory).store as Store
    const gate = (yield* Ops).gate as Gate
    const vault = yield* Vault
    let ctx: SurfaceRuntime<typeof surface.spec>["ctx"] | undefined
    let held: Projection<DocumentEntry> | undefined
    /** WHAT `readAll` ANSWERS BEFORE THE FIRST REVISION, and after the vault
     *  unloads — one shared value rather than a fresh `new Map()` per call,
     *  because `readAll` is asked once per subscriber and an empty map minted
     *  per ask is a new identity per ask. The framework folds a collection's
     *  snapshot by value, so a fresh empty map is harmless; what it is not is
     *  free, and there is exactly one thing it can say. */
    const empty = new Map<string, DocumentEntry>()
    /**
     * ONE PULSE FOR EVERY OPEN STREAM, carrying nothing.
     *
     * A stream's `install` is what wakes a subscription, and what wakes THIS
     * row's is a published revision — the same one for every reader, whatever
     * they are subscribed to. So the channel carries `void`: it says "the
     * directory moved", the framework re-runs each subscriber's `read` with
     * its own input, and `isEqual` below decides whether the answer is worth a
     * frame. A channel per stream, or a payload naming what changed, would be
     * this row deciding which readers care — which is the decision `isEqual`
     * already makes from the ANSWER rather than from a guess about it, and the
     * only one that cannot be wrong. It is `pins`' `equals` argument
     * (`olai-plugin-pins`'s `surface.ts`) one member shape over.
     */
    const revisions = inMemoryChannel<void>()
    const bodies = yield* Bodies.make({
      read: path => store.body(path),
      publish: (path, body) => {
        const entry = held?.change.entries.get(path)
        if (entry) ctx?.collections.documents.upsert(path, "refused" in body
          ? { rev: entry.rev, text: null, refused: true }
          : { rev: entry.rev, text: body.text, refused: false })
      },
    })
    yield* vault.revision<Snapshot<Reading>>(snapshot => Effect.sync(() => {
      const next = documentProjection(snapshot, held)
      held = next
      for (const [key, value] of next.change.upserts) ctx?.collections.documents.upsert(key, value)
      for (const key of next.change.removes) ctx?.collections.documents.remove(key)
      bodies.unread(next.unread)
      revisions.publish(undefined)
    }))
    yield* vault.unloaded(Effect.sync(() => {
      for (const key of held?.change.entries.keys() ?? []) ctx?.collections.documents.remove(key)
      held = undefined
      revisions.publish(undefined)
    }))
    const deps: ImplementSurfaceDeps<typeof surface.spec> = {
      onStreamReadError: (error, {stream}) => { Effect.runFork(Effect.logWarning(`markdown ${stream} read failed: ${String(error)}`)) },
      /** `Effect.runPromise` because the framework's `read` is a promise and
       *  the ops gate is an Effect: the boundary is crossed here, at the one
       *  place a subscriber's re-read enters this row. The effect is run
       *  OUTSIDE this plugin's scope, which is why a failure lands on
       *  `onStreamReadError` above rather than tearing the fiber down — one
       *  reader's bad address must not withdraw the row from everyone. */
      streams: { documentPage: {
        read: input => Effect.runPromise(Effect.map(gate.page(input), value => value as FiledPageReading)),
        install: (_input, onEvent) => revisions.consume({onEvent, onError: () => {}}),
        isEqual: samePageReading,
      } },
      collections: {
        /**
         * `upsert` and `remove` ARE NO-OPS, and that is not a stub.
         *
         * These are the deps a WRITER would use, and this collection has no
         * writer: a document is a file on the disk, and the only way to change
         * one is the ops layer, whose writes come back through the probe like
         * every change anyone else makes. What actually pushes deltas is the
         * `Vault.revision` callback above, through `ctx.collections.documents`
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
        documents: { readAll: () => held?.change.entries ?? empty, upsert: () => {}, remove: () => {},
        /**
         * A KEY WHOSE BODY IS NOT HERE ANSWERS NOTHING, AND ASKS FOR IT.
         *
         * `undefined` is the framework's held-open-on-absent path: the reader
         * waits rather than being handed a blank page, and `bodies.unread`
         * queues the read that will `upsert` the same key a moment later — see
         * `./wire.ts`'s three-states paragraph for why a missing body and a
         * refused read are different answers, and `./server/bodies.ts` for the
         * reader itself.
         *
         * `holders: bodies.held` is the other half: a hold is taken by the
         * SUBSCRIPTION rather than by a successful read, so a reader that
         * opened a key before the file had bytes is still owed them. Without
         * it, the announcement of a newborn key was all such a reader ever
         * saw.
         */
        readOne: (key) => {
          const entry = held?.change.entries.get(key)
          if (!entry || entry.text !== null) return entry
          bodies.unread([key])
          return undefined
        },
        holders: bodies.held, }
      },
      procedures: {
        edit: { apply: ({ input }) => applyEdit(gate, input) },
        ops: { documents: () => gate.documents, document: ({ input }) => gate.document(input), run: ({ input }) => runWrite(gate, input) },
      },
    }
    yield* (yield* Surfaces).register({ surface, faces, resources, tools, writes: ["surface/ops/run"], deps, published: value => { ctx = value as typeof ctx } })
  }),
})

export { dispatch } from "./surface.ts"

/** Static sibling metadata matches the browser-owned client. Agent grants
 * belong to the standalone aliases registered by this activation, so copying
 * them here would advertise a second set of namespaced agent tools. */
import { faces as standaloneFaces } from "./surface.ts"
const siblingFaces = { browser: standaloneFaces.browser }
export { siblingFaces as faces }
export { surface } from "./surface.ts"

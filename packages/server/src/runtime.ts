/**
 * The surface, bound to the store and to the conversation.
 *
 * Two subjects, and the bindings say which is which:
 *
 *   - the DIRECTORY is the store's. One fiber follows `SubscriptionRef.changes`
 *     of the snapshot — current value first, then every later one — and each
 *     revision it sees becomes the writes of that revision: for each of the two
 *     collections the entries whose file moved and the keys whose file is gone,
 *     then the manifest. It is an OWNED source (the `manifest` cell's
 *     `connect`), like the error cell's, so it lives on the runtime's own scope
 *     and a failure in it settles `done`.
 *
 *     What makes that ONE fiber rather than three is that the collections and
 *     the cell are halves of one revision: publishing them from separate
 *     subscriptions to the same ref would let a reader see a manifest naming a
 *     revision whose entries had not been written yet, from a server that knew
 *     both.
 *   - the CONVERSATION is the chat's: a cell for where it stands, a collection
 *     for the rows, and the procedures. The collection is deliberately
 *     server-authored — `readAll` is the transcript itself and the writes come
 *     from `ctx`, never from the wire — because a transcript is something that
 *     HAPPENED and the only way to add to it is to prompt.
 *
 * Nothing here interprets an outline or an agent. It moves what the store and
 * the chat decided onto the wire, and that is all.
 */

import type { OutlineError, OutlineSet } from "@olai/format"
import type { Store } from "@olai/store"
import {
  CHAT_OFF,
  type ChatState,
  type Manifest,
  type OpFailure,
  surface,
} from "@olai/surface"
import { UsageFailure } from "@olai/format"
import {
  type ImplementSurfaceDeps,
  implementSurface,
  inMemoryStore,
  type SurfaceRuntime,
} from "@kolu/surface/server"
import { Effect, Stream, SubscriptionRef } from "effect"

import type { Change, Chat } from "@olai/chat"
import { type Published, publishedOf } from "./published.ts"

/** What a transport needs, and nothing else. `ctx` is the write face, which
 *  belongs to the bindings below rather than to whoever serves them. */
export type Bound = Omit<SurfaceRuntime<typeof surface.spec>, "ctx">

export interface Wiring {
  readonly store: Store<OutlineSet, ReadonlyArray<OutlineError>>
  /** Absent when no ACP agent is configured: the cell stays `off` and the
   *  procedures answer that they are. A directory is readable whether or not
   *  an agent is installed. */
  readonly chat: Chat | null
}

/** The chat, plus the two publishers the surface hands back once it exists.
 *  {@link bind} fills them in — the chat is built before the surface, because
 *  the surface's collection is seeded from the transcript, and the surface is
 *  what the chat publishes through. */
export interface Publishers {
  readonly state: (state: ChatState) => void
  readonly transcript: (change: Change) => void
}

export const bind = (
  wiring: Wiring,
): Effect.Effect<{ readonly bound: Bound; readonly publish: Publishers }> =>
  Effect.sync(() => {
    // Seeded empty and filled by `connect`: `SubscriptionRef.changes` delivers
    // the current value before any update, so peeking at the ref here as well
    // would be the same read twice with a window between them.
    const errors = inMemoryStore<ReadonlyArray<OutlineError>>([])
    const chat = wiring.chat

    /** The revision the wire is holding — `null` until the store has published
     *  one. Each collection's entries are that revision's own map, replaced
     *  whole by the connector below and never mutated after, which is what lets
     *  `readAll` hand one over as it is: a fresh subscription's snapshot and the
     *  deltas an open one is watching are two readings of one map rather than
     *  two copies to keep in step. Kept WHOLE rather than as its pieces, so the
     *  next revision is derived from one thing (see {@link publishedOf}). */
    let held: Published | null = null
    /** What a collection reads before the store has published anything. One
     *  value rather than a fresh map per call: `readAll` is asked on every
     *  subscribe, and nothing may write to what it hands back. */
    const NOTHING_YET = new Map<string, never>()
    /** The surface's own write face, once there is one to publish through —
     *  filled the moment `implementSurface` returns. The connector installs
     *  synchronously, so the FIRST revision is written before this exists; that
     *  is exactly the moment there is nobody subscribed to hear it, and `held`
     *  above has it. */
    let published: SurfaceRuntime<typeof surface.spec>["ctx"] | null = null

    /** A chat verb, when there may be no chat. The cell already reads `off`, so
     *  a browser has been told; a stray call is answered as a REFUSAL rather
     *  than as a runtime defect, because "chat is off" is a thing a caller can
     *  be told and the vocabulary already covers it. */
    const withChat = <A>(
      use: (chat: Chat) => Effect.Effect<A, OpFailure>,
    ): Effect.Effect<A, OpFailure> =>
      chat === null
        ? Effect.fail(
          new UsageFailure({
            reason: "chat is off: no ACP agent is configured for this directory",
          }),
        )
        : use(chat)

    const deps: ImplementSurfaceDeps<typeof surface.spec> = {
      cells: {
        errors: {
          store: errors,
          connect: (cell) =>
            Stream.runForEach(
              SubscriptionRef.changes(wiring.store.errors),
              (next) => Effect.sync(() => cell.set(next ?? [])),
            ),
        },
        chat: {
          store: inMemoryStore<ChatState>(chat === null ? CHAT_OFF : chat.state()),
        },
        /** The whole directory binding, because one revision is one write of
         *  everything it moved: for each collection the entries that changed
         *  and the keys that went, and then the facts that belong to no file.
         *  `null` reaches the wire verbatim — a store with no snapshot has
         *  never loaded, and empty collections on their own cannot say that. */
        manifest: {
          store: inMemoryStore<Manifest>(null),
          connect: (cell) =>
            Stream.runForEach(
              SubscriptionRef.changes(wiring.store.snapshot),
              (snapshot) =>
                Effect.sync(() => {
                  if (snapshot === null) return cell.set(null)
                  const revision = publishedOf(snapshot, held)
                  held = revision
                  const collections = published?.collections
                  for (const [key, entry] of revision.outlines.upserts) {
                    collections?.outlines.upsert(key, entry)
                  }
                  for (const key of revision.outlines.removes) {
                    collections?.outlines.remove(key)
                  }
                  // A document's upsert reaches only the sockets that asked for
                  // THAT key (there is no `deltas` verb here) — which is a
                  // reader with the document open, and nobody else.
                  for (const [key, entry] of revision.documents.upserts) {
                    collections?.documents.upsert(key, entry)
                  }
                  for (const key of revision.documents.removes) {
                    collections?.documents.remove(key)
                  }
                  // Written last, which is NOT the order they arrive in: a cell
                  // publishes on this stack while the collection's frame is
                  // coalesced into one delta on a microtask, so the manifest
                  // reaches a socket first. Nothing here may promise otherwise
                  // — a reader tolerates the skew either way, and that is the
                  // cross-file consistency paragraph in the design doc.
                  cell.set(revision.manifest)
                }),
            ),
        },
      },
      collections: {
        // Server-authored and read-only on the wire: a change to an outline is
        // a change to a FILE, and the only way to make one is the ops layer.
        // `readAll` is the projection above rather than a copy of it, so the
        // snapshot a late subscriber gets is the one the deltas have been
        // moving. The write seams are the surface's own requirement — a `ctx`
        // write needs somewhere to persist — and by the time one runs, the
        // projection it would persist has already been replaced whole.
        outlines: {
          readAll: () => held?.outlines.entries ?? NOTHING_YET,
          upsert: () => {},
          remove: () => {},
        },
        // The same arrangement, one collection over: server-authored, read-only
        // on the wire, and `readAll` is the projection rather than a copy — so
        // the body a fresh per-key subscription is snapshotted from is the one
        // the upserts above have been moving.
        documents: {
          readAll: () => held?.documents.entries ?? NOTHING_YET,
          upsert: () => {},
          remove: () => {},
        },
        // Server-authored, one writer: `readAll` reads the transcript itself,
        // so a fresh subscription is seeded from the same object every later
        // upsert moves. There is no second copy to keep in step.
        transcript: {
          readAll: () => new Map(chat === null ? [] : chat.entries()),
          // The wire never calls these — the collection's write verbs are not
          // exposed — but the surface needs somewhere to persist a `ctx` write,
          // and the transcript has already recorded it by the time we publish.
          upsert: () => {},
          remove: () => {},
        },
      },
      procedures: {
        chat: {
          send: ({ input }) => withChat((open) => open.send(input.text)),
          cancel: () => withChat((open) => open.cancel),
          newSession: () => withChat((open) => open.newSession),
          loadSession: ({ input }) => withChat((open) => open.loadSession(input.id)),
          sessions: () => withChat((open) => open.sessions),
        },
      },
    }

    // `ctx` is the WRITE face and it stays here: the transport gets `Bound`,
    // which is the runtime with `ctx` taken off, so nothing that serves a
    // socket can also publish into the surface.
    const runtime = implementSurface(surface, deps)

    // From here on an entry write PUBLISHES as well as landing in the
    // projection. Before this line the connector had already run its first
    // revision into `entries`, which is what a subscription is snapshotted
    // from — and there can be no subscription yet, because the listener is
    // built from what this function returns.
    published = runtime.ctx

    return {
      bound: runtime,
      publish: {
        state: (state) => runtime.ctx.cells.chat.set(state),
        transcript: (change) => {
          for (const key of change.removes) runtime.ctx.collections.transcript.remove(key)
          for (const [key, entry] of change.upserts) {
            runtime.ctx.collections.transcript.upsert(key, entry)
          }
        },
      },
    }
  })

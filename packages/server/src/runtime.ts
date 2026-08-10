/**
 * The surface, bound to the store and to the conversation.
 *
 * Two subjects, and the bindings say which is which:
 *
 *   - the OUTLINE is the store's. One fiber follows `SubscriptionRef.changes`
 *     of the snapshot — current value first, then every later one — and each
 *     revision it sees becomes three writes: the entries whose file moved, the
 *     keys whose file is gone, and the manifest. It is an OWNED source (the
 *     `manifest` cell's `connect`), like the error cell's, so it lives on the
 *     runtime's own scope and a failure in it settles `done`.
 *
 *     What makes that ONE fiber rather than two is that the collection and the
 *     cell are two halves of one revision: publishing them from two
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
  type OutlineEntry,
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
import { publishedOf } from "./outlines.ts"

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

    /** The served directory as entries — the collection's own value, replaced
     *  whole by the connector below and never mutated after, which is what lets
     *  `readAll` hand it over as it is. A fresh subscription's snapshot and the
     *  deltas an open one is watching are two readings of one map rather than
     *  two copies to keep in step. */
    let entries = new Map<string, OutlineEntry>()
    /** Where an entry write goes once there is a runtime to publish through —
     *  filled the moment `implementSurface` returns. The connector installs
     *  synchronously, so the FIRST revision is written before this exists; that
     *  is exactly the moment there is nobody subscribed to hear it, and
     *  `entries` above has it. */
    let write: {
      readonly upsert: (key: string, entry: OutlineEntry) => void
      readonly remove: (key: string) => void
    } | null = null

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
        /** The whole outline binding, because one revision is one write of all
         *  three things: the entries that moved, the keys that went, and the
         *  facts that belong to no file. `null` reaches the wire verbatim — a
         *  store with no snapshot has never loaded, and an empty collection on
         *  its own cannot say that. */
        manifest: {
          store: inMemoryStore<Manifest>(null),
          connect: (cell) =>
            Stream.runForEach(
              SubscriptionRef.changes(wiring.store.snapshot),
              (snapshot) =>
                Effect.sync(() => {
                  if (snapshot === null) return cell.set(null)
                  const published = publishedOf(snapshot, entries)
                  entries = published.entries
                  for (const [key, entry] of published.upserts) write?.upsert(key, entry)
                  for (const key of published.removes) write?.remove(key)
                  // The manifest LAST: it is the revision announcing itself, and
                  // the entries it speaks for are already published when it does.
                  cell.set(published.manifest)
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
          readAll: () => entries,
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
    write = {
      upsert: (key, entry) => runtime.ctx.collections.outlines.upsert(key, entry),
      remove: (key) => runtime.ctx.collections.outlines.remove(key),
    }

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

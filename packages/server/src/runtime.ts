/**
 * The surface, bound to the store and to the conversation.
 *
 * Two subjects, and the bindings say which is which:
 *
 *   - the OUTLINE is the store's, and it needed nothing new when the store went
 *     live: the stream is `SubscriptionRef.changes` verbatim — current value
 *     first, then every later one — which is already surface's
 *     snapshot-then-deltas contract, and the error cell is an OWNED source, so
 *     the fiber that follows the other ref lives on the runtime's own scope and
 *     a failure in it settles `done`.
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
import { CHAT_OFF, type ChatEntry, type ChatState, surface } from "@olai/surface"
import {
  type ImplementSurfaceDeps,
  implementSurface,
  inMemoryStore,
  type SurfaceRuntime,
} from "@kolu/surface/server"
import { Effect, Stream, SubscriptionRef } from "effect"

import type { Chat } from "./chat/chat.ts"

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
  readonly transcript: (change: {
    readonly upserts: ReadonlyArray<readonly [string, ChatEntry]>
    readonly removes: ReadonlyArray<string>
  }) => void
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

    const gone = () =>
      Effect.die(
        new Error(
          "the surface is serving chat procedures with no agent configured — " +
            "`bind` was handed `chat: null`, which is supposed to make the cell `off`",
        ),
      )

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
      },
      collections: {
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
      streams: {
        outlines: {
          source: () =>
            Stream.map(SubscriptionRef.changes(wiring.store.snapshot), (snapshot) =>
              snapshot === null
                ? null
                : { rev: snapshot.rev, set: snapshot.value }),
        },
      },
      procedures: {
        chat: {
          send: ({ input }) => chat === null ? gone() : chat.send(input.text),
          cancel: () => chat === null ? gone() : chat.cancel,
          newSession: () => chat === null ? gone() : chat.newSession,
          loadSession: ({ input }) => chat === null ? gone() : chat.loadSession(input.id),
          sessions: () => chat === null ? gone() : chat.sessions,
        },
      },
    }

    // `ctx` is the WRITE face and it stays here: the transport gets `Bound`,
    // which is the runtime with `ctx` taken off, so nothing that serves a
    // socket can also publish into the surface.
    const runtime = implementSurface(surface, deps)

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

/**
 * Who holds a key: a per-key subscription's LIFETIME, said out loud.
 *
 * The wire already says when a reader OPENS a key — a per-key `get` IS a
 * subscription, and the collection's `readOne` is where the server hears one
 * arrive. What no member says is when the last reader LETS GO. That fact is the
 * framework's: a handler answers with a `Stream`, the stream's scope is the
 * subscription, and the scope closes when the tab navigates, the socket drops,
 * the runtime is torn down, or a one-shot reader takes its frame and leaves
 * ("FIBER INTERRUPTION IS THE UNSUBSCRIBE" — `@kolu/surface`'s `server.ts`).
 * The framework does not publish it, so a server that has to know whether
 * anybody is still showing a file was left inferring it from opens and aging
 * the answer out (`@olai/server`'s `bodies.ts`, which bounded that guess at
 * sixteen paths and named this module as what would replace it).
 *
 * This is that fact, taken from where it already exists rather than invented:
 * {@link holding} wraps one collection's `get` so that the {@link Hold} runs in
 * the STREAM's scope, which makes a hold and a subscription the same lifetime by
 * construction. There is nothing to age out and no number to choose.
 *
 * IT IS NOT A MEMBER OF THE SPEC, and that is the decision worth stating. A
 * verb a reader had to CALL to say "I am done with this key" would be a promise
 * a closed tab cannot keep: the readers this is about are exactly the ones that
 * vanish — a killed browser, a dropped socket, an agent that exits mid-read —
 * and none of them get to send a message on their way out. The transport is
 * what notices, so the transport is what is asked, and nothing new crosses the
 * wire at all.
 *
 * WHY THE HANDLER, and not one of the two other seams that could carry this:
 *
 *   - `readOne` is a read of the SET. It is called once per subscription, it
 *     cannot see the end of one, and a lifetime whose two halves lived in
 *     different places would be a hold with no matching release the first time
 *     a reader was interrupted between subscribing and being snapshotted.
 *   - the CHANNEL under the member is the framework's own bookkeeping, and its
 *     in-memory implementation does count subscribers (`subscriberCount`,
 *     `onIdle`). Reaching for it means serving on a caller-provided channel
 *     factory and recognising a member's per-key channel BY NAME — a string
 *     shape the framework mints for its own use — to learn a fact about a
 *     member. The handler is the same fact one layer up, in the vocabulary the
 *     surface already publishes.
 *
 * WHERE IT WOULD RATHER LIVE is upstream: this is a property of any keyed
 * collection, not of olai's, and a `holders` seam beside `readOne` in
 * `@kolu/surface`'s own `CollectionHandlerDeps` would serve every consumer of
 * the framework and let the wrap go. It is written here because that is the
 * repository this change is in; the shape is deliberately one function over a
 * handler record so that moving it costs its callers one import.
 *
 * WHAT IT DOES NOT DO: it counts, and it does not decide. Which member is
 * instrumented, what a hold is worth and what happens when the count reaches
 * zero belong to whoever is answering a question about the served directory —
 * here, the body reader.
 */

import { surfaceTag } from "@kolu/surface/define"
import { emptyHandlers, type SurfaceHandler, type SurfaceHandlers } from "@kolu/surface/server"
import { Effect, type Scope, Stream } from "effect"

import { surface } from "./index.ts"

/** A keyed member of olai's surface. A name that is not one is a type error
 *  rather than a handler wrapped at a tag nobody serves. */
export type Keyed = keyof typeof surface.spec.collections

/**
 * A reader has taken this key, for the lifetime of the scope this runs in.
 *
 * A SCOPE rather than a returned release, because the two ends of a lifetime a
 * caller has to pair by hand are two ends one interrupted caller leaks — and
 * because a scope is what the framework itself uses for exactly this (its
 * channel subscription is one `acquireRelease`, and the release is the
 * unsubscribe). Two readers of one key are two holds and two closes.
 */
export type Hold = (key: string) => Effect.Effect<unknown, never, Scope.Scope>

/**
 * The same handlers, with one collection's `get` reporting its holders.
 *
 * A copy rather than a mutation, and rebuilt with `emptyHandlers()` for the
 * reason `@olai/server`'s `writerAt` is: a handler record is null-prototype on
 * purpose, so a member legitimately named `toString` cannot collide with what
 * an object literal inherits.
 *
 * A member with no `get` handler is a boot crash rather than a silent no-op:
 * the whole point is that a hold is taken on every subscription, and a wrap
 * that quietly instrumented nothing would leave a refcount permanently at zero
 * — which reads, from every consumer, as "nobody is watching anything".
 */
export const holding = (
  handlers: SurfaceHandlers,
  member: Keyed,
  hold: Hold,
): SurfaceHandlers => {
  const tag = surfaceTag(surface.tagPrefix, member, "get")
  const answer = handlers[tag]
  if (answer === undefined) {
    throw new Error(
      `holding: no handler at "${tag}" — the "${member}" collection does not serve a per-key \`get\`, so there is no subscription to hold.`,
    )
  }
  /** The hold runs in the STREAM's scope rather than at the handler call, so a
   *  subscription nobody runs holds nothing and one that is interrupted
   *  anywhere — mid-snapshot included — releases exactly once. `Stream.unwrap`
   *  is what provides that scope, which is the same construction the
   *  framework's own channel subscription is built on. */
  const held: SurfaceHandler = (payload: { readonly key: string }) =>
    Stream.unwrap(
      Effect.map(hold(payload.key), () => answer(payload) as Stream.Stream<unknown, unknown>),
    )

  // Onto a null-prototype record rather than into a literal, for the reason
  // above; `Object.assign` copies the own keys and inherits nothing.
  return Object.assign(emptyHandlers(), handlers, { [tag]: held })
}

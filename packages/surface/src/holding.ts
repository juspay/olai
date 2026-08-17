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
 * {@link holding} wraps one collection's `get` in a scoped acquire — hold on
 * the way in, release on the way out — so a member's holders are counted by the
 * same lifetime the framework already manages. There is nothing to age out and
 * no number to choose.
 *
 * IT IS NOT A MEMBER OF THE SPEC, and that is the decision worth stating. A
 * verb a reader had to CALL to say "I am done with this key" would be a promise
 * a closed tab cannot keep: the readers this is about are exactly the ones that
 * vanish — a killed browser, a dropped socket, an agent that exits mid-read —
 * and none of them get to send a message on their way out. The transport is
 * what notices, so the transport is what is asked, and nothing new crosses the
 * wire at all.
 *
 * WHY THE HANDLER AND NOT THE DEPS. `readOne` is the other place a subscription
 * is visible, and it is a read of the SET: it is called once per subscription,
 * it cannot see the end of one, and a lifetime whose two halves lived in
 * different places would be a hold with no matching release the first time a
 * reader was interrupted between subscribing and being snapshotted. The wrap is
 * one acquire/release pair, so the two halves cannot come apart — and a release
 * is idempotent besides ({@link Hold}), which is the shape kolu's refcounted
 * watchers landed on for the same reason.
 *
 * WHAT IT DOES NOT DO: it counts, and it does not decide. Which member is
 * instrumented, what a hold is worth and what happens when the count reaches
 * zero belong to whoever is answering a question about the served directory —
 * here, the body reader.
 */

import { surfaceTag } from "@kolu/surface/define"
import { emptyHandlers, type SurfaceHandler, type SurfaceHandlers } from "@kolu/surface/server"
import { Effect, Stream } from "effect"

import { surface } from "./index.ts"

/** A keyed member of olai's surface. A name that is not one is a type error
 *  rather than a handler wrapped at a tag nobody serves. */
export type Keyed = keyof typeof surface.spec.collections

/**
 * A reader has taken this key.
 *
 * What comes back is that ONE reader letting go, and calling it twice is
 * calling it once — a scope that closes more than once, or a caller that
 * releases and is then torn down, must not take a hold somebody else still has.
 * Two readers of one key are two holds and two releases.
 */
export type Hold = (key: string) => () => void

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
  /** The acquire is the hold and the release is the reader leaving. Both hang
   *  off the STREAM's scope rather than the handler call, so a subscription
   *  that is never run holds nothing and one that is interrupted anywhere —
   *  mid-snapshot included — releases exactly once (`Stream.unwrap` runs the
   *  scoped effect in the stream's own scope, which is what the framework's own
   *  channel subscription is built on). */
  const held: SurfaceHandler = (payload: { readonly key: string }) =>
    Stream.unwrap(
      Effect.map(
        Effect.acquireRelease(
          Effect.sync(() => hold(payload.key)),
          (release) => Effect.sync(release),
        ),
        () => answer(payload) as Stream.Stream<unknown, unknown>,
      ),
    )

  const reported = emptyHandlers()
  for (const [at, handler] of Object.entries(handlers)) reported[at] = handler
  reported[tag] = held
  return reported
}

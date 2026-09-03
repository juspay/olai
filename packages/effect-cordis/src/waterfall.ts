/**
 * A WATERFALL — around-middleware, as Effects, with the chain held by the host
 * and the registrations held by the plugins that made them.
 *
 * ## What this is the translation OF
 *
 * Cordis has five dispatch modes and the mode is part of an event's contract. A
 * WATERFALL is the one where each listener is handed the payload and a `next`,
 * so a listener may transform what the ones after it see, or decline to call
 * through and short-circuit the rest. That shape is what olai's one plugin event
 * is: a conversation opens, every plugin that has something to ask about the
 * host pushes it, and ONE dispatch collects them all — which is the invariant
 * that used to be a hand-written rule with an incident behind it (asking twice
 * started somebody's daemon twice).
 *
 * ## Why the chain is Effect's rather than Cordis's
 *
 * Cordis's own `emit` is a bare loop of `Reflect.apply` with no `try` in it, and
 * its waterfall is the same loop with the payload threaded — so a listener that
 * throws takes every listener after it down, and the dispatcher's caller with
 * them. Phase 2 found that the hard way on the two vault events and answered it
 * by making them doors that wrap each handler once.
 *
 * Doing it in Effect gets the containment for free and gets it in the right
 * shape: a middleware that DIES is caught here, said on the owner's channel with
 * the plugin's own word on the line, and the chain carries on with the value as
 * it stood. One plugin's broken listener is one plugin's absence from a session,
 * not a session that will not open.
 *
 * ## The registration is a finalizer, like every other one
 *
 * `use` attaches to the CALLING plugin's scope, so a plugin that unloads is off
 * the chain with nothing on either side remembering to say so. That is the same
 * property `ctx.on` had — listeners are effects in Cordis too — kept.
 */

import { Effect, Scope } from "effect"

import { failed } from "./broadcast.ts"
import { type Host, provide } from "./host.ts"
import { roster } from "./registry.ts"
import { serviceTag, type ServiceKey } from "./service.ts"

/**
 * ONE LINK IN THE CHAIN.
 *
 * Handed the value as it stands and a `next` that continues the chain with
 * whatever it passes on. Returning `next(value)` is the ordinary case;
 * returning anything else without calling through short-circuits, which is the
 * half a plain event bus cannot express.
 */
export type Middleware<A> = (value: A, next: (value: A) => Effect.Effect<A>) => Effect.Effect<A>

/** WHAT A PLUGIN NAMES — one verb, and it is a registration rather than a
 *  subscription: what comes back is nothing, and what holds it is the scope. */
export interface Chain<A> {
  readonly use: (middleware: Middleware<A>) => Effect.Effect<void, never, Scope.Scope>
}

/** ...AND WHAT THE HOST HOLDS: one dispatch per occasion. */
export type Dispatch<A> = (initial: A) => Effect.Effect<A>

/** A waterfall, as its two ends. */
export interface Waterfall<A> {
  /** The key a plugin puts in its `needs`. */
  readonly key: ServiceKey<Chain<A>>
  /** Provide it on a host for as long as the enclosing scope is open, and take
   *  the dispatcher back. */
  readonly open: (host: Host) => Effect.Effect<Dispatch<A>, never, Scope.Scope>
}

/** Declare one. */
export const waterfall = <A>(cordis: string): Waterfall<A> => {
  const key = serviceTag<Chain<A>>(cordis)
  return {
    key,
    open: (host) =>
      Effect.gen(function*() {
        /** IN REGISTRATION ORDER, which is the order the fibers activated in and
         *  is deliberately NOT a promise to anybody: a row's `apply` runs when
         *  the loader's `import()` for that row comes back, so two rows race and
         *  the order moves between boots. A caller that needs an order imposes
         *  one on the RESULT, against a list that is written down.
         *
         *  {@link ./registry.ts}'s `roster` holds it — the same entry-held-by-a-
         *  scope this used to write out as an array with an `indexOf` and a
         *  `splice` behind it, which is the O(n) removal the keyed table exists
         *  to be instead of. */
        const chain = roster<{ readonly plugin: string; readonly middleware: Middleware<A> }>()
        yield* provide(host, key, (plugin) => ({
          use: (middleware) => chain.hold({ plugin, middleware }),
        }))
        return (initial: A) => {
          // A SNAPSHOT, taken at the dispatch — `read` copies, so a plugin that
          // unloads mid-chain cannot re-index the walk underneath it. What a
          // dispatch is ABOUT is the set of plugins that were mounted when it
          // started.
          const links = chain.read()
          const step = (at: number, value: A): Effect.Effect<A> =>
            at >= links.length ? Effect.succeed(value) : Effect.gen(function*() {
              const link = links[at]!
              // DID IT CALL THROUGH? — the one fact the recovery below turns on,
              // and it can only be known by watching. See the arm for why.
              let continued = false
              const next = (passed: A): Effect.Effect<A> => {
                continued = true
                return step(at + 1, passed)
              }
              return yield* link.middleware(value, next).pipe(
                // CONTAINED, and the SENTENCE is {@link ./broadcast.ts}'s — one
                // line for every plugin bus in the tree rather than one per
                // dispatch mode, because the thing that must not drift is what a
                // reader is told, not how each mode recovers.
                //
                // WHAT IT RECOVERS TO IS THE REST OF THE CHAIN, and for a round
                // it was not. A death was caught and the value handed back as it
                // stood — which took every LATER link down with the dying one,
                // silently, exactly as a voluntary short-circuit would. Four
                // written claims said otherwise, including this file's own
                // header and a bench whose title asserted the opposite of its
                // assertion, and the code was the outlier.
                //
                // It matters beyond the prose because registration order RACES:
                // a row's `apply` runs when its `import()` comes back, so WHICH
                // plugins lost their say to somebody else's defect moved between
                // boots. "One plugin's broken listener is one plugin's absence"
                // is only true if the ones after it are still asked.
                //
                // So a link that died WITHOUT calling through has not consulted
                // the rest, and they are not its to skip: the chain resumes at
                // the next link with the value this one was handed. A link that
                // died AFTER calling through already got its answer, and the
                // ones after it have already run — asking them again is the
                // double-ask this waterfall exists to make impossible — so that
                // arm hands back the value as it stood. Either way a link that
                // dies may have done half of what it meant to, and there is
                // nothing honest to do with a half-transformed value but leave
                // it alone.
                Effect.catchCause((cause) =>
                  Effect.flatMap(
                    failed(link.plugin, `the "${cordis}" waterfall`, cause),
                    () => continued ? Effect.succeed(value) : step(at + 1, value),
                  )
                ),
              )
            })
          return step(0, initial)
        }
      }),
  }
}

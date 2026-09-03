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
         *  one on the RESULT, against a list that is written down. */
        const chain: Array<{ readonly plugin: string; readonly middleware: Middleware<A> }> = []
        yield* provide(host, key, (plugin) => ({
          use: (middleware) =>
            Effect.acquireRelease(
              Effect.sync(() => {
                const link = { plugin, middleware }
                chain.push(link)
                return link
              }),
              (link) =>
                Effect.sync(() => {
                  const at = chain.indexOf(link)
                  if (at !== -1) chain.splice(at, 1)
                }),
            ).pipe(Effect.asVoid),
        }))
        return (initial: A) => {
          // A SNAPSHOT, taken at the dispatch. A plugin that unloads mid-chain
          // would otherwise re-index the array under the walk; and what a
          // dispatch is ABOUT is the set of plugins that were mounted when it
          // started.
          const links = [...chain]
          const step = (at: number, value: A): Effect.Effect<A> =>
            at >= links.length ? Effect.succeed(value) : Effect.gen(function*() {
              const link = links[at]!
              return yield* link.middleware(value, (passed) => step(at + 1, passed)).pipe(
                // CONTAINED, and the SENTENCE is {@link ./broadcast.ts}'s — one
                // line for every plugin bus in the tree rather than one per
                // dispatch mode, because the thing that must not drift is what a
                // reader is told, not how each mode recovers. What each mode
                // recovers TO is genuinely its own: a broadcast has nothing to
                // hand back, and this chain carries on from where it stood,
                // which is the value this link was handed — a link that died may
                // have done half of what it meant to, and there is nothing
                // honest to do with a half-transformed value but leave it alone.
                Effect.catchCause((cause) =>
                  Effect.as(failed(link.plugin, `the "${cordis}" waterfall`, cause), value)
                ),
              )
            })
          return step(0, initial)
        }
      }),
  }
}

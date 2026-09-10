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
 *
 * Being off the chain is not by itself being uncallable, for the reason
 * {@link ./gate.ts} was written down: a dispatch takes ONE snapshot and walks
 * it, so a plugin that unloads while an earlier link is parked is out of the
 * roster and still in the copy. Each registration carries a gate, and a link
 * whose plugin has stopped is skipped rather than called.
 */

import { Deferred, Effect, Exit, Fiber, Scope } from "effect"

import { failed } from "./broadcast.ts"
import { type Gate, gate, wasCut } from "./gate.ts"
import { type Host, provide } from "./host.ts"
import { roster } from "./registry.ts"
import { serviceTag, type ServiceKey } from "./service.ts"

/** WHAT A LINK ASKED THE DISPATCHER FOR — a value to carry on with, or nothing
 *  because it ended without asking. A sentinel rather than `undefined`, so a
 *  waterfall over a nullable payload cannot be misread. */
const SILENT = Symbol("effect-cordis/waterfall/silent")
type Asked<A> = { readonly passed: A } | typeof SILENT

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
        const chain = roster<{
          readonly plugin: string
          readonly middleware: Middleware<A>
          readonly gate: Gate
        }>()
        const occasion = `the "${cordis}" waterfall`
        yield* provide(host, key, (plugin) => ({
          // GATED AT REGISTRATION, exactly as {@link ./broadcast.ts}'s handlers
          // are and for the reason that file's `listen` gives: the snapshot
          // below is a promise about the WALK and not about the CALL, so a link
          // whose plugin unloaded while an earlier link was parked is off the
          // chain and still in the copy.
          use: (middleware) =>
            Effect.flatMap(gate(plugin, occasion), (shut) =>
              chain.hold({ plugin, middleware, gate: shut })),
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
              /**
               * THE CHAIN IS THE DISPATCHER'S, and that is the whole of what
               * `next` was changed to say.
               *
               * A link runs on a fiber of its own now, so that a plugin leaving
               * can CUT its own link without touching the publisher. If `next`
               * still ran `step(at + 1)` inline, the rest of the chain would be
               * running INSIDE that fiber — and cutting one plugin's middleware
               * would take every plugin after it down, which is the opposite of
               * what this file promises.
               *
               * So `next` does not run the rest. It ASKS for it: the link says
               * what it is passing on and parks, the dispatcher runs the rest on
               * its own fiber, and the answer comes back. Downstream work
               * therefore has no fiber-shaped relationship to the link that
               * asked for it, so cutting the asker settles nothing else.
               *
               * ASKED TWICE IS ASKED ONCE, which is a strengthening rather than
               * a side effect: a second `next` finds the request already made
               * and takes the same answer back, where before it would have run
               * the whole rest of the chain a second time. This file's header
               * has an incident behind exactly that ("asking twice started
               * somebody's daemon twice").
               */
              const asking = Deferred.makeUnsafe<Asked<A>>()
              const answered = Deferred.makeUnsafe<A>()
              /** WHETHER THE ANSWER EVER LANDED, which is the third state the
               *  recovery needs and a bare "did it call through" cannot carry:
               *  a link cut WHILE the dispatcher is still running the rest is
               *  not the same as one cut after the rest came back, and neither
               *  is one that never asked. */
              let asked: "no" | "asking" | "answered" = "no"
              const next = (passed: A): Effect.Effect<A> =>
                Effect.suspend(() => {
                  if (asked === "no") asked = "asking"
                  Deferred.doneUnsafe(asking, Effect.succeed({ passed }))
                  return Deferred.await(answered)
                })
              return yield* link.gate.through(
                Effect.ensuring(
                  // SUSPENDED, which is not decoration: `link.middleware(value,
                  // next)` is an ordinary call, so writing it as the argument
                  // would RUN the plugin's middleware and hand the gate only the
                  // Effect it came back with. A middleware is typed
                  // `(value, next) => Effect<A>` and is under no obligation to be
                  // lazy — this file's own bench happens to write every fixture
                  // with an `Effect.suspend` inside, which is exactly why the
                  // hole survived the first pass. {@link ./broadcast.ts}'s
                  // handler is wrapped the same way for the same reason.
                  Effect.suspend(() => link.middleware(value, next)),
                  // A LINK THAT ENDS WITHOUT ASKING — returned, died, or was cut
                  // — has to say so, or the dispatcher would sit waiting for a
                  // request that is never coming. `doneUnsafe` on an already-made
                  // request is a no-op, so this is only ever the other arm.
                  Effect.sync(() => { Deferred.doneUnsafe(asking, Effect.succeed(SILENT)) }),
                ),
                // A LINK WHOSE PLUGIN HAD ALREADY STOPPED IS SKIPPED, and the
                // skip is the chain carrying on at the next link with the value
                // as it stands — the same recovery the died-without-calling-
                // through arm takes, for the same reason: a link that was never
                // entered has consulted nobody, and the ones after it are not
                // its to take with it.
                (running) =>
                  running === undefined ? step(at + 1, value) : Effect.gen(function*() {
                    const request = yield* Deferred.await(asking)
                    if (request !== SILENT) {
                      const carried = yield* step(at + 1, request.passed)
                      asked = "answered"
                      yield* Deferred.succeed(answered, carried)
                    }
                    const exit = yield* Fiber.await(running)
                    if (Exit.isSuccess(exit)) return exit.value
                    /**
                     * THE THREE STATES A STOPPED LINK CAN BE IN, and they want
                     * three different answers.
                     *
                     * NEVER ASKED — it consulted nobody, so the chain resumes at the
                     * next link with the value this one was handed.
                     *
                     * ASKED AND ANSWERED — the rest of the chain has already run,
                     * on the dispatcher's own fiber, and asking it again is the
                     * double-ask this waterfall exists to make impossible. The
                     * value comes back as this link was handed it, because a link
                     * that stopped mid-transform may have done half of what it
                     * meant to and a half-transformed value is not something to
                     * pass on.
                     *
                     * ASKED AND STILL RUNNING — the same answer, and it is safe for
                     * a structural reason rather than a careful one: the rest of the
                     * chain is not in this fiber, so cutting this link did not touch
                     * it. It settles under the dispatcher above, which is what the
                     * `yield*` two lines up already waited for.
                     *
                     * A CUT is not a FAILURE and is not said: the plugin left, which
                     * is nobody's news. A link that DIED is the other arm, and it
                     * keeps the sentence every bus in this tree shares.
                     */
                    const onward = asked === "no"
                      ? step(at + 1, value)
                      : Effect.succeed(value)
                    if (wasCut(exit)) return yield* onward
                    return yield* Effect.flatMap(failed(link.plugin, occasion, exit.cause), () => onward)
                  }),
              )
            })
          return step(0, initial)
        }
      }),
  }
}

/**
 * A GATE — the half of a registration that says WHEN it may be called, beside
 * {@link ./registry.ts}'s roster, which only says whether it is in the table.
 *
 * ## The hole the roster alone leaves, and it was reproduced rather than argued
 *
 * A dispatch reads the table ONCE and walks the copy, which is the roster's own
 * documented promise: *what a dispatch is ABOUT is the set of plugins that were
 * mounted when it started*. That sentence is true of the WALK and says nothing
 * about the CALL. An event goes to several plugins; the first of them takes its
 * time; a later one unloads while the walk is parked — its entry is gone from
 * the table, its finalizers have run, its resources are closed — and the walk
 * then reaches the copy's next element and calls it anyway:
 *
 * ```text
 * second resource released
 * second.dispose completed
 * second handler called; resource alive = false
 * ```
 *
 * Containment does not make that harmless. A late handler is not a handler that
 * throws: it is a handler that RUNS, over a closed connection, a revoked service
 * or a directory the plugin no longer owns, and it may finish what it meant to
 * do before anything notices. The failure is being called at all.
 *
 * ## The two halves of "stopped", and they need different answers
 *
 * A call that HAS NOT STARTED is the easy half and the reproduced one: the gate
 * shuts before the plugin's other finalizers run (it is registered first, so
 * LIFO releases it last of the registration's own pair and before anything the
 * `apply` acquired ahead of it), and every later arrival takes the `instead`
 * arm rather than the handler.
 *
 * A call ALREADY RUNNING is somebody else's fiber standing in the middle of this
 * plugin's resources, and it may not simply be cut: the fiber it is running on
 * is the PUBLISHER's — the vault's composition root rings a revision from inside
 * its own connector — so interrupting the work would interrupt the caller, and
 * one leaving plugin would take the publisher and every handler after it down.
 * So the gate WAITS, which is the same discipline {@link ./lifecycle.ts}'s
 * `close` already keeps one level up: revoke first, join what is still inside,
 * release the resources last.
 *
 * ## ...AND THE WAIT IS BOUNDED, twice, because one bound is not enough
 *
 * **{@link PATIENCE} is the bound that always holds.** After it the release says
 * so — with the plugin's word and the occasion on the line — and goes on to
 * close the resources, which is exactly what happens today except that today it
 * happens instantly and in silence. A finalizer that could block forever on a
 * plugin's own misbehaviour would be a worse failure than the one this module
 * exists to fix.
 *
 * **The closing fiber's own calls are not waited for at all.** A `Scope.close`
 * made from INSIDE a call — the same fiber, synchronously — would otherwise be
 * a fiber waiting for itself, and no timer makes that anything but five wasted
 * seconds. Excluding it by fiber identity costs nothing and is exact.
 *
 * WHAT THAT ESCAPE DOES NOT REACH, measured rather than assumed: a handler that
 * stops its own PLUGIN. `definePlugin`'s disposer runs the scope close through
 * `Effect.runPromiseWith` on a fresh fiber, so the closer's identity can never
 * be the handler's however the stop was asked for. Such a handler is served by
 * the first bound instead — the release waits five seconds, says so, and the
 * handler then finishes — so it is bounded and loud rather than excluded, and
 * the line it produces names that reading beside the other one. Threading the
 * asking fiber across the disposer boundary is what would close it; that is
 * `./lifecycle.ts`'s shape to change, not this module's.
 */

import { Deferred, Duration, Effect, Scope } from "effect"

/**
 * ONE REGISTRATION'S GATE — one verb, and the second argument is what makes it
 * usable by both dispatch modes.
 *
 * A broadcast has nothing to hand back and passes `Effect.void`; a waterfall
 * must not swallow the rest of its chain and passes the step that carries on
 * with the value as it stands — the same recovery its dying-link arm already
 * takes. Neither mode is asked to learn what a shut gate MEANS; each says what
 * it wants done instead.
 */
export interface Gate {
  readonly through: <A>(work: Effect.Effect<A>, instead: Effect.Effect<A>) => Effect.Effect<A>
}

/**
 * HOW LONG A LEAVING PLUGIN WAITS for a call still inside one of its
 * registrations before it stops waiting and says so.
 *
 * Five seconds is long enough that no honest handler on this tree's buses ever
 * reaches it — a revision walk is milliseconds — and short enough that a plugin
 * a person switched off in the panel goes off rather than appearing to hang.
 */
export const PATIENCE: Duration.Duration = Duration.seconds(5)

/**
 * Open one, held by the registering plugin's scope.
 *
 * `plugin` and `what` are the same pair {@link ./broadcast.ts}'s `failed` takes
 * and are here for the same reason: the one line this module can ever write is
 * about a named plugin on a named occasion, and no caller may sign another
 * plugin's name to it.
 */
export const gate = (
  plugin: string,
  what: string,
  patience: Duration.Input = PATIENCE,
): Effect.Effect<Gate, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => open(plugin, what)),
    (held) => held.shut(patience),
  ).pipe(Effect.map((held) => held.gate))

/** WHAT THE SCOPE HOLDS — the gate a dispatch calls through and the release
 *  only this module may run. */
interface Held {
  readonly gate: Gate
  readonly shut: (patience: Duration.Input) => Effect.Effect<void>
}

const open = (plugin: string, what: string): Held => {
  let shut = false
  /** CALLS INSIDE, BY FIBER — a count rather than a flag, because a fiber may be
   *  inside twice (a waterfall link whose `next` reaches the same plugin's later
   *  link), and by fiber rather than in one total because the release has to be
   *  able to tell its own re-entrant caller apart from everybody else. */
  const inside = new Map<number, number>()
  let waiting: { readonly closer: number; readonly idle: Deferred.Deferred<void> } | undefined
  /** Everybody the release is genuinely waiting for — which is everybody except
   *  the fiber doing the releasing. See the header's second bound, including
   *  what it does not reach. */
  const outstanding = (closer: number): number => {
    let calls = 0
    for (const [fiber, depth] of inside) if (fiber !== closer) calls += depth
    return calls
  }
  const leave = (fiber: number): void => {
    const depth = (inside.get(fiber) ?? 1) - 1
    if (depth <= 0) inside.delete(fiber)
    else inside.set(fiber, depth)
    if (waiting !== undefined && outstanding(waiting.closer) === 0) {
      Deferred.doneUnsafe(waiting.idle, Effect.void)
    }
  }
  return {
    gate: {
      through: (work, instead) =>
        // THE FIBER FIRST, then one synchronous block: the read of `shut` and
        // the entry that follows it must not be separated by a step, or a
        // release landing between them would leave a call inside a gate that
        // has already stopped waiting for anybody.
        Effect.flatMap(Effect.fiberId, (fiber) =>
          Effect.suspend(() => {
            if (shut) return instead
            inside.set(fiber, (inside.get(fiber) ?? 0) + 1)
            // ENSURING rather than a `flatMap` after the work: a handler that
            // dies, and a handler whose own fiber is interrupted out from under
            // it, both have to leave — otherwise one failure parks a release
            // for the whole of its patience.
            return Effect.ensuring(work, Effect.sync(() => leave(fiber)))
          })),
    },
    shut: (patience) =>
      Effect.flatMap(Effect.fiberId, (closer) =>
        Effect.suspend(() => {
          // SHUT BEFORE THE WAIT, always: what the wait is for is the calls
          // already inside, and a gate that took new ones while it waited would
          // never be done.
          shut = true
          if (outstanding(closer) === 0) return Effect.void
          const idle = Deferred.makeUnsafe<void>()
          waiting = { closer, idle }
          return Effect.timeoutOrElse(Deferred.await(idle), {
            duration: patience,
            orElse: () =>
              // BOTH READINGS, because the release cannot tell them apart and a
              // line that named only the first would be wrong half the time.
              Effect.logWarning(
                `plugins: stopped waiting for "${plugin}" to come out of ${what} after `
                  + `${Duration.format(Duration.fromInputUnsafe(patience))} — its resources `
                  + "close under a handler that is still running, which is either stuck "
                  + "or waiting on this plugin's own stop",
              ),
          })
        })),
  }
}

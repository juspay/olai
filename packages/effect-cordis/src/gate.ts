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
 * ## The two halves of "stopped", and the second one is why this forks
 *
 * A call that HAS NOT STARTED is the easy half and the reproduced one: the gate
 * is shut before the plugin unwinds anything, and every later arrival takes the
 * caller's other arm rather than the handler.
 *
 * A call ALREADY RUNNING has to be CUT, and it cannot be cut where it used to
 * run. It ran on the PUBLISHER's fiber — the vault's composition root rings a
 * revision from inside its own connector — so interrupting it there would
 * interrupt the publisher, and one leaving plugin would take the publisher and
 * every handler after it down with it.
 *
 * So a gated call gets a fiber of its OWN, started with the publisher's
 * services (it sees exactly what it saw before) and joined by the publisher (a
 * dispatch still answers when the last handler has). Cutting it is then
 * `Fiber.interrupt` on that fiber alone: the handler unwinds its own
 * finalizers, the publisher sees a completed join and walks on to the next
 * handler, and nothing else in the tree notices.
 *
 * ## THIS REPLACED A TIMER, and the timer was the wrong answer
 *
 * The first version of this module WAITED for a running call and, after five
 * seconds, logged a line and released the resources underneath it. Both
 * reviewers reproduced the obvious consequence with an ordinary slow handler —
 * `resource released` / `dispose completed` / `handler resumed; resource alive
 * = false` — and they are right that announcing the violation is not answering
 * it. There is no patience here now, and no constant to tune: the call is cut,
 * and `Fiber.interrupt` does not answer until the fiber it cut has finished
 * unwinding.
 *
 * WHAT THAT DOES NOT PROMISE, said plainly: a handler that has put itself in an
 * uninterruptible region is waited for, because that is what Effect's
 * interruption means everywhere else in this tree. This module can promise that
 * a call is cut and joined before its plugin's resources close; it cannot
 * promise a bound on code that has declined to be interrupted. The one thing it
 * will not do again is proceed anyway.
 *
 * ## ...AND WHERE THE CUT IS RUN FROM IS THE OTHER HALF OF THE REPAIR
 *
 * The first version registered the cut as an ordinary scope finalizer, which
 * made it hostage to registration order: a resource acquired AFTER the `listen`
 * is released BEFORE the gate, so LIFO teardown handed a running handler a
 * released resource without ever reaching the timer. Reproduced, and the tree
 * really is written that way — `xyne-spaces` subscribes `onSeen` and registers
 * its mirrors' stop after it, deliberately; `git` registers a revision handler
 * and forks four scoped loops after that.
 *
 * `Listen` puts no constraint on registration order and should not have to. So
 * a gate under a plugin is not the SCOPE's at all: it registers with the
 * ACTIVATION, the way an offer does, and {@link ./lifecycle.ts}'s `close` shuts
 * every one of them before it unwinds anything and cuts every one of them
 * before it closes the resource scope. Shut-all-then-cut-all, in that order,
 * because a sequential loop would leave a later registration accepting calls
 * while an earlier one was still being cut.
 *
 * A gate opened on a BARE scope — a bench, a `standing()` runtime, anything
 * that is not a plugin activation — falls back to a scope finalizer, and there
 * LIFO is the only ordering there is. That is the honest limit of what a scope
 * can offer, and it is why the plugin path does not use one.
 */

import { Cause, Effect, Exit, Fiber, Scope } from "effect"

import { quieting } from "./lifecycle.ts"

/**
 * ONE REGISTRATION'S GATE — one verb, and what comes back is a FIBER rather
 * than an answer.
 *
 * The caller waits for it (see {@link holding}), which is what keeps a
 * dispatch's promise to answer when the last handler has. What the caller gets
 * for holding the handle instead of the value is the two things a gate is for:
 * `undefined` says the call was never started, and the exit says whether the
 * one that was started finished or was cut.
 */
export interface Gate {
  readonly start: <A>(work: Effect.Effect<A>) => Effect.Effect<Fiber.Fiber<A> | undefined>
}

/**
 * HOLD A STARTED CALL for as long as `work` runs — and take it with you if you
 * are interrupted first.
 *
 * The fiber a gate starts is a ROOT fiber and not a child of the publisher's:
 * that is what makes the check-and-start one synchronous block, with no step in
 * the middle for a cut to land in. The price of a root is that nothing carries
 * the publisher's own interruption down to it, so every caller pays it back
 * here, once, in the one place both dispatch modes can share.
 */
export const holding = <A, B>(
  started: Fiber.Fiber<A>,
  work: Effect.Effect<B>,
): Effect.Effect<B> => Effect.onInterrupt(work, () => Fiber.interrupt(started))

/**
 * Open one, held by the registering plugin's activation — or, failing that, by
 * the enclosing scope.
 *
 * `plugin` and `what` are the same pair {@link ./broadcast.ts}'s `failed` takes.
 * They carry no behaviour here and are not spent on a log line; they are what a
 * reader of a stack or a heap sees when they ask whose gate this is.
 */
export const gate = (plugin: string, what: string): Effect.Effect<Gate, never, Scope.Scope> =>
  Effect.gen(function*() {
    const held = open(plugin, what)
    // THE ACTIVATION FIRST, because only it can promise to run this before the
    // plugin's resources rather than somewhere in their LIFO order.
    if (yield* quieting(held.quiet)) return held.gate
    yield* Effect.addFinalizer(() =>
      Effect.promise(async () => {
        held.quiet.shut()
        await held.quiet.cut()
      })
    )
    return held.gate
  })

/** WHAT THE OWNER HOLDS — the gate a dispatch calls through, and the two-step
 *  stop only {@link ./lifecycle.ts} and the fallback finalizer may run. */
interface Held {
  readonly gate: Gate
  readonly quiet: { readonly shut: () => void; readonly cut: () => Promise<void> }
}

const open = (_plugin: string, _what: string): Held => {
  let shut = false
  /** THE CALLS INSIDE, as fibers — which is the whole of what a cut needs, and
   *  is why there is no counting, no deferred and no timer left in this file. */
  const inside = new Set<Fiber.Fiber<unknown>>()
  return {
    gate: {
      start: <A>(work: Effect.Effect<A>) =>
        // THE PUBLISHER'S OWN SERVICES, captured here and handed to the fiber
        // below, so a handler sees exactly the logger, the level and the
        // annotations it saw when it ran on the publisher's fiber directly.
        // The fork is the only thing that changed; what it runs under is not.
        Effect.flatMap(Effect.context<never>(), (services) =>
          Effect.suspend(() => {
            // ONE SYNCHRONOUS BLOCK, from the read of `shut` to the entry in
            // `inside`. There is no Effect step in the middle, so a cut landing
            // "between" them is not an arrangement that exists: either it sees
            // this fiber in the set, or this call was never started.
            if (shut) return Effect.succeed(undefined)
            let held: Fiber.Fiber<A> | undefined
            let ended = false
            const started = Effect.runForkWith(services)(Effect.ensuring(
              work,
              Effect.sync(() => {
                ended = true
                if (held !== undefined) inside.delete(held)
              }),
            ))
            held = started
            // A call that finished inside the fork itself was never in the set
            // and must not be put there afterwards.
            if (!ended) inside.add(started)
            return Effect.succeed(started)
          })),
    },
    quiet: {
      shut: () => { shut = true },
      cut: async () => {
        const cutting = [...inside]
        inside.clear()
        if (cutting.length === 0) return
        // INTERRUPT AND JOIN, which is one verb in Effect: `Fiber.interrupt`
        // answers when the fiber it cut has run its finalizers. That is the
        // difference between this and the timer it replaced — the resources
        // below are not closed on a promise that the call will stop, but after
        // it has.
        await Effect.runPromise(
          Effect.forEach(cutting, (one) => Fiber.interrupt(one), {
            concurrency: "unbounded",
            discard: true,
          }),
        )
      },
    },
  }
}

/** ...and the one reading of a cut call both dispatch modes make: it was
 *  interrupted, by us, because its plugin left — not a failure anybody should
 *  be told about. A handler that FAILED is a different sentence and belongs to
 *  the caller. */
export const wasCut = <A>(exit: Exit.Exit<A>): boolean =>
  Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)

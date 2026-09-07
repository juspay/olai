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
 * a gate registers with the ACTIVATION, the way an offer does, and
 * {@link ./lifecycle.ts}'s `close` shuts every one of them before it unwinds
 * anything and cuts every one of them before it closes the resource scope.
 * Shut-all-then-cut-all, in that order, because a sequential loop would leave a
 * later registration accepting calls while an earlier one was still being cut.
 *
 * ## ...AND IT KEEPS ITS SCOPE FINALIZER AS WELL, because they are two lifetimes
 *
 * The second version registered with the activation and RETURNED, which took
 * `listen`'s own contract away: `Scope` is what those verbs are typed with, and
 * a plugin may register inside a child scope and close it while staying
 * mounted. See {@link gate} for what that cost and what it now does.
 *
 * A gate opened on a BARE scope — a bench, a `standing()` runtime, anything
 * that is not a plugin activation — has only the finalizer, and there LIFO is
 * the only ordering there is. That is the honest limit of what a scope can
 * offer, and it is why the plugin path does not rely on it.
 */

import { Cause, Effect, Exit, Fiber, Scope } from "effect"

import { type Quieting, quieting } from "./lifecycle.ts"

/**
 * ONE REGISTRATION'S GATE — one verb, and it takes the caller's continuation
 * rather than handing a fiber back.
 *
 * `use` is given the started call and runs while it runs, so a dispatch still
 * answers when its last handler has. `undefined` is a call that was never
 * started because the registration had already stopped; each mode says for
 * itself what to do instead.
 *
 * ## Why the continuation and not the fiber
 *
 * A fiber handed back has to be HELD by whoever took it — the publisher's own
 * interruption does not reach it, because a gated call is a ROOT fiber and not
 * a child (that is what makes the check-and-start one synchronous block). Two
 * callers each holding it correctly is two chances to get it wrong, and one of
 * them did: `flatMap(start, (started) => holding(started, …))` installs the
 * hold in a LATER step, so a publisher interrupted in the handoff between them
 * left the root call running with nobody left to cut it. Reproduced through the
 * real bus:
 *
 * ```text
 * publisher finished: true handler unwound: false
 * ```
 *
 * So the start and the hold are one step here, inside an uninterruptible mask,
 * and only the WAIT is restored to interruptible — which is the part that has
 * to stay interruptible, since it is where a publisher spends its time.
 */
export interface Gate {
  readonly through: <A, B>(
    work: Effect.Effect<A>,
    use: (started: Fiber.Fiber<A> | undefined) => Effect.Effect<B>,
  ) => Effect.Effect<B>
}

/**
 * Open one, held by BOTH the registering plugin's activation and the enclosing
 * scope.
 *
 * ## Both, and the reason is that they are different lifetimes
 *
 * The ACTIVATION is what can promise ordering: it shuts every gate before the
 * plugin unwinds anything and cuts them all before a single resource
 * finalizer runs, so where a `listen` sits among a plugin's acquisitions does
 * not enter into it.
 *
 * The SCOPE is what `listen` and `use` are TYPED with, and it is a real
 * lifetime of its own: a plugin may register a handler inside a child scope and
 * close that child while staying mounted. The roster drops the entry then — and
 * the gate used to stay open, so a dispatch already holding a snapshot called
 * the handler over the child's released resources:
 *
 * ```text
 * child resource released
 * child scope closed; owner plugin still mounted
 * child handler called; alive=false
 * ```
 *
 * Registering with the activation may not take that contract away, so it does
 * not: whichever lifetime ends first stops the gate, and {@link Quieting}'s two
 * verbs are idempotent and join-safe so the second one to arrive waits for the
 * first rather than cutting twice.
 *
 * WHAT A SCOPE STILL CANNOT DO is order itself against its own siblings: a
 * resource acquired in the child AFTER the `listen` is released before the gate
 * gets there, because LIFO is the only ordering a scope has. That is the same
 * honest limit the plugin path pays nothing for, and it is why the plugin path
 * does not rely on it.
 *
 * `plugin` and `what` are the same pair {@link ./broadcast.ts}'s `failed` takes.
 * They carry no behaviour here and are not spent on a log line; they are what a
 * reader of a stack or a heap sees when they ask whose gate this is.
 */
export const gate = (plugin: string, what: string): Effect.Effect<Gate, never, Scope.Scope> =>
  Effect.gen(function*() {
    const held = open(plugin, what)
    yield* quieting(held.quiet)
    yield* Effect.addFinalizer(() =>
      Effect.promise(async () => {
        held.quiet.shut()
        await held.quiet.cut()
      })
    )
    return held.gate
  })

/** WHAT THE OWNERS HOLD — the gate a dispatch calls through, and the two-step
 *  stop {@link ./lifecycle.ts} and the scope finalizer both run. */
interface Held {
  readonly gate: Gate
  readonly quiet: Quieting
}

/**
 * ONE CALL INSIDE — a record and not a fiber, which is a distinction the first
 * version did not make and lost a cut to.
 *
 * `Effect.runForkWith` runs the forked fiber's synchronous prefix BEFORE it
 * hands the fiber back, and a handler's prefix can reach the caller: it
 * completes a `Deferred` somebody is awaiting, that somebody wakes, closes a
 * scope, and the cut runs — all before the line that would have put the fiber
 * in the set. Measured: `CUT called, size 0` printed before `STARTED`.
 *
 * So what goes in the set goes in BEFORE the fork, and it carries three things
 * the fiber alone could not: whether the fiber is known yet, whether a cut has
 * already asked for it, and a promise that settles when the call is out. A cut
 * that arrives early marks the record and the start interrupts on its own way
 * back; a cut that arrives late interrupts directly. Either way it waits on the
 * same promise, which is what makes "cut" mean "finished unwinding".
 */
interface Inside {
  fiber: Fiber.Fiber<unknown> | undefined
  cut: boolean
  readonly out: Promise<void>
  readonly left: () => void
}

const open = (_plugin: string, _what: string): Held => {
  let shut = false
  const inside = new Set<Inside>()
  /** THE CUT, ONCE. Two owners can reach it — a child scope closing and the
   *  activation's pre-close stage — and the second must WAIT for the first
   *  rather than find an empty set and answer at once, or a resource would
   *  close beside a call that is still unwinding. */
  let cutting: Promise<void> | undefined
  const stop = (call: Inside): void => {
    call.cut = true
    if (call.fiber !== undefined) Effect.runFork(Fiber.interrupt(call.fiber))
  }
  return {
    gate: {
      through: <A, B>(
        work: Effect.Effect<A>,
        use: (started: Fiber.Fiber<A> | undefined) => Effect.Effect<B>,
      ) =>
        // THE MASK IS THE WHOLE OF THE HANDOFF FIX. Starting the call and
        // installing the hold that will cut it are one step now; only `use` is
        // restored, because that is where the caller waits and a publisher must
        // stay interruptible while it does.
        Effect.uninterruptibleMask((restore) =>
          // THE PUBLISHER'S OWN SERVICES, captured here and handed to the fiber
          // below, so a handler sees exactly the logger, the level and the
          // annotations it saw when it ran on the publisher's fiber directly.
          // The fork is the only thing that changed; what it runs under is not.
          Effect.flatMap(Effect.context<never>(), (services) =>
            Effect.suspend(() => {
              // ONE SYNCHRONOUS BLOCK, from the read of `shut` to the entry in
              // `inside`. There is no Effect step in the middle, so a cut
              // landing "between" them is not an arrangement that exists:
              // either it sees this call in the set, or this call was never
              // started.
              if (shut) return restore(use(undefined))
              const settled = Promise.withResolvers<void>()
              const call: Inside = {
                fiber: undefined,
                cut: false,
                out: settled.promise,
                left: () => settled.resolve(),
              }
              inside.add(call)
              const started = Effect.runForkWith(services)(Effect.ensuring(
                work,
                Effect.sync(() => {
                  inside.delete(call)
                  call.left()
                }),
              ))
              call.fiber = started
              // A CUT THAT ARRIVED WHILE THE FORK'S OWN PREFIX WAS RUNNING has
              // marked this record and could not reach the fiber, because there
              // was not one yet. This is that interrupt, on the way back.
              if (call.cut) Effect.runFork(Fiber.interrupt(started))
              // ...AND THE HOLD, in the same step. A gated call is a root
              // fiber, so nothing carries the caller's interruption down to it;
              // this frame is what does, and it is installed before anything
              // interruptible runs.
              return Effect.onInterrupt(
                restore(use(started)),
                () => Fiber.interrupt(started),
              )
            }))),
    },
    quiet: {
      shut: () => { shut = true },
      cut: () =>
        cutting ??= (async () => {
          const cut = [...inside]
          inside.clear()
          if (cut.length === 0) return
          // INTERRUPT AND JOIN, and they are two steps because a call whose
          // fiber is not known yet can be asked for but not yet interrupted.
          // What is awaited is the record's own promise, which settles when the
          // call has run its finalizers — the difference between this and the
          // timer it replaced is that the resources below are not closed on a
          // promise that the call will stop, but after it has.
          for (const call of cut) stop(call)
          await Promise.all(cut.map((call) => call.out))
        })(),
    },
  }
}

/** ...and the one reading of a cut call both dispatch modes make: it was
 *  interrupted, by us, because its registration left — not a failure anybody
 *  should be told about. A handler that FAILED is a different sentence and
 *  belongs to the caller. */
export const wasCut = <A>(exit: Exit.Exit<A>): boolean =>
  Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)

/**
 * ONE ACTIVATION'S LIFETIME, on both sides of the bridge.
 *
 * Cordis owns readiness and reactive reloads; Effect owns resources. This module
 * owns the join between them: revoke provisions, wait for dependent cleanup,
 * then close the resource scope. Plugin configuration and failure presentation
 * do not participate in that ordering and remain in plugin.ts.
 */
import type { Context as CordisContext, Fiber as CordisFiber } from "cordis"
import { Context, Duration, Effect, Exit, Fiber, Scope } from "effect"
import type { Provision, ServiceKey } from "./service.ts"

/** A duplicate is a distinct defect so the API can supply its own sentence
 * without accidentally disguising a cancellation or disposer-ownership defect. */
export class OfferConflict extends Error {
  constructor(readonly owner: string, readonly key: string, cause: Error) {
    super(cause.message, { cause })
  }
}

/**
 * A REGISTRATION THAT MUST STOP ACCEPTING CALLS BEFORE THIS ACTIVATION UNWINDS
 * — the plugin buses' half of the lifetime, and the reason it is here rather
 * than on the scope.
 *
 * A scope orders finalizers by registration, LIFO, and `Listen` puts no
 * constraint on when a plugin registers a handler relative to the resources
 * that handler reads. So a resource acquired after a `listen` was released
 * BEFORE the handler was stopped — reproduced, and the tree really is written
 * that way. What a running handler needs is not a place in that order; it is a
 * stage BEFORE it, which only the activation can offer.
 *
 * THIS DOES NOT REPLACE THE SCOPE'S OWN LIFETIME. A registration made inside a
 * child scope is stopped when that child closes as well, and both owners reach
 * the same `cut`; the second waits for the first rather than finding an empty
 * set. See {@link ../gate.ts}.
 *
 * TWO STEPS, and they are separate because ALL of the first must happen before
 * ANY of the second: a sequential shut-and-cut loop would leave a later
 * registration admitting calls while an earlier one was still being cut.
 */
export interface Quieting {
  /** Stop accepting calls. Synchronous, and run for every registration on the
   *  activation before any of them is cut. */
  readonly shut: () => void
  /** Cut what is still inside, and answer only when it has finished unwinding.
   *  Signalling a cancellation is not joining one; a resource may not close
   *  until this has answered. */
  readonly cut: () => Promise<void>
}

/** The plugin adapter can bind initialization and close its lifetime, but cannot
 * rearrange revocation or mark cleanup complete without actually doing it. */
export interface Activation {
  readonly scope: Scope.Closeable
  readonly bind: (fiber: Fiber.Fiber<void>) => void
  readonly interrupt: () => void
  readonly close: (exit: Exit.Exit<void>) => Promise<void>
  readonly offer: <Shape>(key: ServiceKey<Shape>, provision: Provision<Shape>) => void
  readonly quiet: (quieting: Quieting) => void
}

interface Live {
  readonly ctx: CordisContext
  readonly dependencies: ReadonlySet<CordisFiber>
  readonly drained: Promise<void>
  readonly interrupt: () => void
}

/** Cordis removes fibers from its registry BEFORE asynchronous cleanup ends.
 * Keeping the activation until its scope has closed lets a departing provider
 * and host shutdown join consumers that are no longer discoverable there.
 * This is cleanup bookkeeping, not a second readiness or dependency scheduler:
 * dependencies are the provider identities Cordis committed for this activation.
 * The entry is removed in finally, including failed and interrupted starts.
 */
const live = new Map<CordisFiber, Live>()

export const Offering = Context.Reference<Activation | undefined>("effect-cordis/Offering", {
  defaultValue: () => undefined,
})

/** Include activations whose disposal already removed their registry entry. */
export const hostActivations = (ctx: CordisContext): ReadonlyArray<Live> =>
  [...live.values()].filter((activation) => activation.ctx.root.fiber === ctx.root.fiber)

export const interrupt = (fiber: CordisFiber): void => live.get(fiber)?.interrupt()

export const activate = (ctx: CordisContext, services: Context.Context<never>): Activation => {
  const scope = Scope.makeUnsafe()
  const drained = Promise.withResolvers<void>()
  let closing: Promise<void> | undefined
  const revokes: Array<() => Promise<void>> = []
  const quiets: Array<Quieting> = []
  let running: Fiber.Fiber<void> | undefined
  let interrupted = false
  const interrupt = (): void => {
    interrupted = true
    if (running !== undefined) Effect.runFork(Fiber.interrupt(running))
  }
  const activation: Live = {
    ctx, drained: drained.promise, interrupt,
    dependencies: new Set(Object.values(ctx.fiber.store ?? {}).map((impl) => impl.fiber)),
  }
  live.set(ctx.fiber, activation)
  return {
    scope,
    interrupt,
    // runForkWith may run plugin code before returning its fiber. Remember an
    // interruption received during that work, then deliver it when bound.
    bind: (fiber) => {
      running = fiber
      if (interrupted || ctx.fiber.uid === null || Object.keys(ctx.fiber.inject).some((key) => ctx.reflect.get(key) === undefined)) interrupt()
    },
    close: (exit) => closing ??= Promise.resolve().then(async () => {
      try {
        // STOP ACCEPTING FIRST, and all of them before any of the rest — the
        // paper's L-Leave, and the one ordering a scope cannot express. A
        // handler that has not started is now never started, whatever this
        // plugin registered when.
        for (const quiet of quiets) quiet.shut()
        // ...AND THE CUT STARTS HERE, BEFORE THE FIRST AWAIT, because the two
        // lines under it both wait for DEPENDENTS and a dependent can be
        // waiting for one of these calls.
        //
        // That is not hypothetical and it is not only about the explicit drain
        // below: the pin's own provision disposer ends with
        // `Promise.allSettled(fibers.map(fiber => fiber.await()))`, so
        // `await revoke()` waits for dependent fibers too. A consumer whose
        // finalizer joins an in-flight provider handler would therefore hold
        // the revoke, which would hold the cut, which is the only thing that
        // could finish the handler — a cycle with no timer in it and no
        // uninterruptible code anywhere. Reproduced.
        //
        // So: START the cut, then withdraw, then join, then AWAIT the cut. The
        // distinction between beginning a withdrawal and waiting for one is the
        // whole of the repair.
        const cutting = joinCuts(quiets, ctx.fiber.name ?? "a plugin", services)
        for (const revoke of revokes.reverse()) await revoke()
        await Promise.all([...live.values()]
          .filter((other) => other.dependencies.has(ctx.fiber))
          .map((other) => other.drained))
        // ...AND IT IS AWAITED HERE, before a single resource finalizer runs.
        // `cut` answers when the calls it interrupted have finished unwinding,
        // so what follows this line is running under nothing.
        //
        // THERE IS NO GIVING UP. One shared interval for the whole activation
        // says so if a cut is slow, and then goes on waiting: the version that
        // released resources under a still-running handler after five seconds
        // is exactly the defect this stage exists to close, and a timer that
        // abandoned the wait would be it again. An invocation that has made
        // itself uninterruptible is waited for; that is what Effect's
        // interruption means everywhere else in this tree.
        await cutting
      } finally {
        try {
          await Effect.runPromiseWith(services)(Scope.close(scope, exit))
        } finally {
          live.delete(ctx.fiber)
          drained.resolve()
        }
      }
    }),
    quiet: (quieting) => {
      // A registration made while this activation is already closing has missed
      // the shut above, so it is shut here instead of being enrolled in a
      // stage that has gone past.
      if (closing !== undefined) {
        quieting.shut()
        return
      }
      quiets.push(quieting)
    },
    offer: (key, provision) => {
      if (closing !== undefined) throw new Error("effect-cordis: offer requires an open plugin activation")
      let revoke: () => void
      try {
        revoke = ctx.provide(key.cordis, provision)
      } catch (cause) {
        // The pinned runtime exposes no typed duplicate error. Recognize its
        // exact sentence here, beside the call it belongs to; callers neither
        // parse Cordis prose nor preflight its exclusive-provider decision.
        const prefix = `service "${key.cordis}" has been registered at <`
        if (cause instanceof Error && cause.message.startsWith(prefix) && cause.message.endsWith(">")) {
          throw new OfferConflict(cause.message.slice(prefix.length, -1), key.cordis, cause)
        }
        throw cause
      }
      // Pin coupling: ctx.provide installs its own guarded disposer into this
      // set, whose members Cordis unloads concurrently. An Effect finalizer
      // calling that wrapper again would return without joining its first call.
      // Remove it and become the ONLY caller, in close's earlier revoke phase.
      // Assert the handoff here so pin drift names the cause, not just a later
      // resource-use failure in a dependent's cleanup.
      if (!ctx.fiber._disposables.delete(revoke)) {
        throw new Error(`effect-cordis: could not take ownership of the disposer for "${key.cordis}"; the Cordis pin's provision ownership changed.`)
      }
      revokes.push(async () => { await revoke() })
    },
  }
}

/**
 * HOW LONG A SLOW CUT GOES UNMENTIONED — a reporting interval and NOT a bound.
 *
 * Nothing is abandoned when it elapses. What it buys is that an unload which is
 * genuinely stuck inside somebody's handler says so, once, naming the plugin,
 * instead of looking like a hang with no author.
 */
const SLOW_CUT = Duration.seconds(5)

/** Cut every registration together, and say so if it takes a while — see the
 *  paragraph in `close`. One timer for the activation rather than one per
 *  registration: the stage is one stage.
 *
 *  CALLED FOR ITS START rather than awaited where it is called: `close` needs
 *  the interruptions in flight before it waits for anything, and the promise
 *  back for later. */
const joinCuts = async (
  quiets: ReadonlyArray<Quieting>,
  plugin: string,
  services: Context.Context<never>,
): Promise<void> => {
  if (quiets.length === 0) return
  const cutting = Promise.all(quiets.map((quiet) => quiet.cut()))
  let slow: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
    slow = undefined
    void Effect.runPromiseWith(services)(Effect.logWarning(
      `plugins: "${plugin}" is still stopping — a handler of its own has not come out of its `
        + `invocation after ${Duration.format(SLOW_CUT)}, and its resources stay open until it does`,
    ))
  }, Duration.toMillis(SLOW_CUT))
  try {
    await cutting
  } finally {
    if (slow !== undefined) clearTimeout(slow)
  }
}

/** Register a bus registration's stop with the CALLING plugin's activation, and
 *  say whether there was one. `false` is a gate opened on a bare scope — a
 *  bench, a `standing()` runtime — which falls back to a scope finalizer and
 *  the LIFO ordering that comes with it. */
export const quieting = (quieting: Quieting): Effect.Effect<boolean> =>
  Effect.map(Offering, (activation) => {
    if (activation === undefined) return false
    activation.quiet(quieting)
    return true
  })

/** The offering context is ambient, so authors receive a capability, never the
 * Cordis fiber or a caller-supplied identity. Readiness remains Cordis's: a
 * provision on this context is unavailable until the provider becomes ACTIVE. */
export const offer = <Shape>(key: ServiceKey<Shape>, provision: Provision<Shape>): Effect.Effect<void> =>
  Effect.flatMap(Offering, (activation) => Effect.sync(() => {
    if (activation === undefined) throw new Error("effect-cordis: offer requires a plugin activation")
    activation.offer(key, provision)
  }))

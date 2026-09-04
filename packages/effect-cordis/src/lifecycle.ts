/**
 * ONE ACTIVATION'S LIFETIME, on both sides of the bridge.
 *
 * Cordis owns readiness and reactive reloads; Effect owns resources. This module
 * owns the join between them: revoke provisions, wait for dependent cleanup,
 * then close the resource scope. Plugin configuration and failure presentation
 * do not participate in that ordering and remain in plugin.ts.
 */
import type { Context as CordisContext, Fiber as CordisFiber } from "cordis"
import { Context, Effect, Exit, Fiber, Scope } from "effect"
import type { Provision, ServiceKey } from "./service.ts"

/** A duplicate is a distinct defect so the API can supply its own sentence
 * without accidentally disguising a cancellation or disposer-ownership defect. */
export class OfferConflict extends Error {
  constructor(readonly owner: string, readonly key: string, cause: Error) {
    super(cause.message, { cause })
  }
}

/** The plugin adapter can bind initialization and close its lifetime, but cannot
 * rearrange revocation or mark cleanup complete without actually doing it. */
export interface Activation {
  readonly scope: Scope.Closeable
  readonly bind: (fiber: Fiber.Fiber<void>) => void
  readonly interrupt: () => void
  readonly close: (exit: Exit.Exit<void>) => Promise<void>
  readonly offer: <Shape>(key: ServiceKey<Shape>, provision: Provision<Shape>) => void
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
        for (const revoke of revokes.reverse()) await revoke()
        await Promise.all([...live.values()]
          .filter((other) => other.dependencies.has(ctx.fiber))
          .map((other) => other.drained))
      } finally {
        try {
          await Effect.runPromiseWith(services)(Scope.close(scope, exit))
        } finally {
          live.delete(ctx.fiber)
          drained.resolve()
        }
      }
    }),
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

/** The offering context is ambient, so authors receive a capability, never the
 * Cordis fiber or a caller-supplied identity. Readiness remains Cordis's: a
 * provision on this context is unavailable until the provider becomes ACTIVE. */
export const offer = <Shape>(key: ServiceKey<Shape>, provision: Provision<Shape>): Effect.Effect<void> =>
  Effect.flatMap(Offering, (activation) => Effect.sync(() => {
    if (activation === undefined) throw new Error("effect-cordis: offer requires a plugin activation")
    activation.offer(key, provision)
  }))

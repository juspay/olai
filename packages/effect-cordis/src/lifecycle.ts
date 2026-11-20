import type { Context as CordisContext, Fiber as CordisFiber } from "cordis"
import { Context, Duration, Effect, Exit, Fiber, Scope } from "effect"
import type { Provision, ServiceKey } from "./service.ts"

export class OfferConflict extends Error {
  constructor(readonly owner: string, readonly key: string, cause: Error, message = cause.message) {
    super(message, { cause })
  }
}

/**
 * A REGISTRATION THAT MUST STOP ACCEPTING CALLS BEFORE THIS ACTIVATION UNWINDS.
 *
 * TWO STEPS, and they are separate because ALL of the first must happen before
 * ANY of the second: a sequential shut-and-cut loop would leave a later
 * registration admitting calls while an earlier one was still being cut.
 */
export interface Quieting {
  readonly shut: () => void
  readonly cut: () => Promise<void>
  readonly done: Promise<void>
}

export interface Activation {
  readonly current: () => boolean
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

const live = new Map<CordisFiber, Live>()

export const Offering = Context.Reference<Activation | undefined>("effect-cordis/Offering", {
  defaultValue: () => undefined,
})

export const hostActivations = (ctx: CordisContext): ReadonlyArray<Live> =>
  [...live.values()].filter((activation) => activation.ctx.root.fiber === ctx.root.fiber)

export const interrupt = (fiber: CordisFiber): void => live.get(fiber)?.interrupt()

export const provideExclusive = <Shape>(
  ctx: CordisContext,
  key: ServiceKey<Shape>,
  provision: Provision<Shape>,
): ReturnType<CordisContext["provide"]> => {
  try {
    return ctx.provide(key.cordis, provision)
  } catch (cause) {
    const prefix = `service "${key.cordis}" has been registered at <`
    if (cause instanceof Error && cause.message.startsWith(prefix) && cause.message.endsWith(">")) {
      throw new OfferConflict(cause.message.slice(prefix.length, -1), key.cordis, cause)
    }
    const holder = ctx.reflect._getImpl(key.cordis, false)
    if (holder !== undefined && holder.fiber !== ctx.fiber) {
      throw new OfferConflict(holder.fiber.name, key.cordis, cause instanceof Error ? cause : new Error(String(cause)),
        `effect-cordis: service "${key.cordis}" is already provided by <${holder.fiber.name}>`)
    }
    throw cause
  }
}

const thrown = new WeakMap<CordisFiber, { readonly reason: unknown }>()
export const startThrew = (fiber: CordisFiber, reason: unknown): void => { thrown.set(fiber, { reason }) }
export const startBegins = (fiber: CordisFiber): void => { thrown.delete(fiber) }
export const lastStartThrew = (fiber: CordisFiber): { readonly reason: unknown } | undefined => thrown.get(fiber)

export const activate = (ctx: CordisContext, services: Context.Context<never>): Activation => {
  const scope = Scope.makeUnsafe()
  const drained = Promise.withResolvers<void>()
  let closing: Promise<void> | undefined
  const revokes: Array<() => Promise<void>> = []
  const quiets = new Set<Quieting>()
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
    current: () => closing === undefined && !interrupted && ctx.fiber.uid !== null,
    scope,
    interrupt,
    bind: (fiber) => {
      running = fiber
      if (interrupted || ctx.fiber.uid === null || Object.keys(ctx.fiber.inject).some((key) => ctx.reflect.get(key) === undefined)) interrupt()
    },
    close: (exit) => closing ??= Promise.resolve().then(async () => {
      // STOP ACCEPTING, AND START CUTTING, before the first `await` in this
      // function. Both are outside the `try` because the `finally` has to be
      // able to wait for the cut whatever the withdrawal did, and a resource may
      // not close before it has.
      for (const quiet of quiets) quiet.shut()
      const cutting = joinCuts([...quiets], ctx.fiber.name ?? "a plugin", services)
      try {
        for (const revoke of revokes.reverse()) await revoke()
        await Promise.all([...live.values()]
          .filter((other) => other.dependencies.has(ctx.fiber))
          .map((other) => other.drained))
      } finally {
        try {
          await cutting
          await Effect.runPromiseWith(services)(Scope.close(scope, exit))
        } finally {
          live.delete(ctx.fiber)
          drained.resolve()
        }
      }
    }),
    quiet: (quieting) => {
      if (closing !== undefined) {
        quieting.shut()
        return
      }
      quiets.add(quieting)
      void quieting.done.then(() => { quiets.delete(quieting) })
    },
    offer: (key, provision) => {
      if (closing !== undefined) throw new Error("effect-cordis: offer requires an open plugin activation")
      const revoke = provideExclusive(ctx, key, provision)
      if (!ctx.fiber._disposables.delete(revoke)) {
        throw new Error(`effect-cordis: could not take ownership of the disposer for "${key.cordis}"; the Cordis pin's provision ownership changed.`)
      }
      revokes.push(async () => { await revoke() })
    },
  }
}

const SLOW_CUT = Duration.seconds(5)

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

export const quieting = (quieting: Quieting): Effect.Effect<void> =>
  Effect.map(Offering, (activation) => { activation?.quiet(quieting) })

export const offer = <Shape>(key: ServiceKey<Shape>, provision: Provision<Shape>): Effect.Effect<void> =>
  Effect.flatMap(Offering, (activation) => Effect.sync(() => {
    if (activation === undefined) throw new Error("effect-cordis: offer requires a plugin activation")
    activation.offer(key, provision)
  }))

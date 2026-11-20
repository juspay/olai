import { Context as CordisContext, FiberState } from "cordis"
import type { Fiber } from "cordis"
import { Context, Effect, Queue, Scope, Stream } from "effect"

import { moduleFibers } from "./module.ts"
import { hostActivations, interrupt, lastStartThrew, provideExclusive } from "./lifecycle.ts"
import type { Plugin } from "./plugin.ts"
import type { ConsumerLifetime, Provision, ServiceKey } from "./service.ts"

const SERVICES: unique symbol = Symbol.for("olai.effect-cordis.host")
const CTX: unique symbol = Symbol.for("olai.effect-cordis.host.ctx")

export interface Host {
  readonly [CTX]: CordisContext
}

export const held = (of: CordisContext): Context.Context<never> => {
  const found = (of as unknown as Record<symbol, Context.Context<never> | undefined>)[SERVICES]
  if (found === undefined) {
    throw new Error(
      "effect-cordis: this plugin was mounted on a context that is not a host — "
        + "mount through `mountPlugin` or the loader, which is what captures the "
        + "Effect services a plugin's `apply` runs under.",
    )
  }
  return found
}

export const ctxOf = (host: Host): CordisContext => host[CTX]

export const openHost: Effect.Effect<Host, never, Scope.Scope> = Effect.flatMap(
  Effect.context<never>(),
  (services) => {
    const ctx = new CordisContext()
    ;(ctx as unknown as Record<symbol, Context.Context<never>>)[SERVICES] = services
    const host: Host = { [CTX]: ctx }
    ctx.on("internal/plugin", (fiber) => { if (fiber.uid === null) interrupt(fiber) })
    ctx.on("internal/service", (name) => {
      ctx.registry.forEach((runtime) => {
        for (const fiber of runtime.fibers) {
          if (name in fiber.inject && fiber.ctx.reflect.get(name) === undefined) interrupt(fiber)
        }
      })
    })
    return Effect.as(Effect.addFinalizer(() => closeHost(host)), host)
  },
)

export const hostChanges = (host: Host): Stream.Stream<void> => Stream.callback<void>((queue) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const release = ctxOf(host).on("internal/status", () => { Queue.offerUnsafe(queue, undefined) })
      Queue.offerUnsafe(queue, undefined)
      return release
    }),
    (release) => Effect.promise(async () => { await release() }),
  ), { bufferSize: 1, strategy: "sliding" })

export const serviceChanges = <Shape>(host: Host, key: ServiceKey<Shape>): Stream.Stream<Shape | undefined> =>
  Stream.changes(Stream.callback<Shape | undefined>((queue) => Effect.acquireRelease(
    Effect.sync(() => {
      const publish = () => { Queue.offerUnsafe(queue, offered(host, key)) }
      const release = ctxOf(host).on("internal/service", (name) => { if (name === key.cordis) publish() })
      publish()
      return release
    }),
    (release) => Effect.promise(async () => { await release() }),
  )))

const closing = new WeakMap<Host, Promise<void>>()

export const closeHost = (host: Host): Effect.Effect<void> => Effect.promise(() => {
  let task = closing.get(host)
  if (task === undefined) {
    const ctx = ctxOf(host)
    task = Promise.resolve().then(async () => {
      const active = hostActivations(ctx)
      for (const activation of active) activation.interrupt()
      await ctx.fiber.dispose()
      await Promise.all(active.map((activation) => activation.drained))
    })
    closing.set(host, task)
  }
  return task
})

export const offered = <Shape>(
  host: Host,
  key: ServiceKey<Shape>,
  caller = "core",
  lifetime?: ConsumerLifetime,
): Shape | undefined => {
  const value = ctxOf(host).reflect.get(key.cordis)
  if (typeof value !== "function") return undefined
  return (value as Provision<Shape>)(caller, lifetime)
}

export const provide = <Shape>(
  host: Host,
  key: ServiceKey<Shape>,
  provision: Provision<Shape>,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => provideExclusive(ctxOf(host), key, provision)),
    (revoke) => Effect.promise(async () => void await revoke()),
  ).pipe(Effect.asVoid)

export interface Mounted {
  readonly report: Effect.Effect<RowReport>
  readonly dispose: Effect.Effect<void>
}

export const mountPlugin = (
  host: Host,
  plugin: Plugin,
  options: { readonly wait?: boolean; readonly config?: unknown } = {},
): Effect.Effect<Mounted> =>
  Effect.promise(async () => {
    if (closing.has(host)) throw new Error("effect-cordis: cannot mount on a closed host")
    const fiber: Fiber = (ctxOf(host).plugin as (plugin: Plugin, config?: unknown) => Fiber)(plugin, options.config)
    if (options.wait !== false) await fiber.await().catch(() => undefined)
    let dropping: Promise<void> | undefined
    return {
      report: Effect.suspend(() => {
        const said = reportOf(fiber)
        return said.state === "failed" ? Effect.promise(() => faulted(fiber)) : Effect.succeed(said)
      }),
      dispose: Effect.promise(() => {
        if (!dropping) dropping = Promise.resolve().then(async () => {
          interrupt(fiber)
          await fiber.dispose()
          await fiber.await().catch(() => undefined)
        })
        return dropping
      }),
    }
  })

const mountedFibers = (host: Host, ids: ReadonlyArray<string>): ReadonlyMap<string, Fiber> => {
  const wanted = new Set(ids)
  const fibers = new Map<string, Fiber>()
  ctxOf(host).registry.forEach((runtime) => {
    const id = runtime.name
    if (id === undefined || !wanted.has(id) || fibers.has(id)) return
    const [first] = runtime.fibers
    if (first !== undefined) fibers.set(id, first)
  })
  return fibers
}

const PASSES = 100

export const settled = (host: Host, ids: ReadonlyArray<string>): Effect.Effect<void> =>
  Effect.flatMap(
    Effect.promise(async () => {
      const stillMoving = (): ReadonlyArray<readonly [string, Promise<void>]> =>
        [...mountedFibers(host, ids)].flatMap(([id, fiber]) =>
          moduleFibers(fiber).flatMap((part) => part.inertia === undefined ? [] : [[id, part.inertia] as const])
        )
      for (let pass = 0; pass < PASSES; pass += 1) {
        const held = stillMoving()
        if (held.length === 0) return []
        await Promise.allSettled(held.map(([, inertia]) => inertia))
      }
      return stillMoving().map(([id]) => id)
    }),
    (moving) =>
      moving.length === 0 ? Effect.void : Effect.logWarning(
        `plugins: gave up waiting for ${moving.join(", ")} to settle after ${PASSES} passes`,
      ),
  )

export const namedBy = (
  host: Host,
  ids: ReadonlyArray<string>,
): ReadonlyMap<string, ReadonlyArray<string>> =>
  new Map(
    [...mountedFibers(host, ids)].map(([id, fiber]) => [id, [...new Set(moduleFibers(fiber).flatMap((part) => Object.keys(part.inject)))]] as const),
  )

export type RowState = "running" | "waiting" | "failed" | "off"

export type RowReport =
  | { readonly state: "running" | "off" }
  | { readonly state: "waiting"; readonly missing?: ReadonlyArray<string> }
  | { readonly state: "failed"; readonly fault?: string }

export const rowReport = (
  host: Host,
  ids: ReadonlyArray<string>,
): Effect.Effect<ReadonlyMap<string, RowReport>> =>
  Effect.promise(async () => {
    const mounted = mountedFibers(host, ids)
    const read = ids.map((id) => [id, mounted.get(id)] as const)
      .map(([id, fiber]) => [id, fiber, fiber === undefined ? OFF : reportOf(fiber)] as const)
    const table = new Map<string, RowReport>()
    for (const [id, fiber, said] of read) {
      table.set(
        id,
        said.state === "failed" && fiber !== undefined ? await faulted(fiber) : said,
      )
    }
    return table
  })

const OFF: RowReport = { state: "off" }

const reportOf = (fiber: Fiber): RowReport => {
  const parts = moduleFibers(fiber)
  const reports = parts.map(singleReport)
  if (reports.some((part) => part.state === "failed")) return { state: "failed" }
  const waiting = reports.filter((part) => part.state === "waiting")
  if (waiting.length) {
    const missing = [...new Set(waiting.flatMap((part) => part.missing ?? []))]
    return missing.length ? { state: "waiting", missing } : { state: "waiting" }
  }
  return reports[0]!
}
const singleReport = (fiber: Fiber): RowReport => {
  switch (fiber.state) {
    case FiberState.ACTIVE:
      return { state: "running" }
    case FiberState.PENDING:
      return { state: "waiting", missing: missingOf(fiber) }
    case FiberState.LOADING:
      return { state: "waiting" }
    case FiberState.FAILED:
      return { state: "failed" }
    default:
      return OFF
  }
}

const faulted = async (fiber: Fiber): Promise<RowReport> => {
  const failed = moduleFibers(fiber).find((part) => part.state === FiberState.FAILED) ?? fiber
  const fault = await failed.await().then(
    () => undefined,
    (reason: unknown) => faultOf((lastStartThrew(failed.ctx.fiber) ?? { reason }).reason),
  )
  return fault === undefined ? { state: "failed" } : { state: "failed", fault }
}

const missingOf = (fiber: Fiber): ReadonlyArray<string> =>
  Object.keys(fiber.inject).filter((name) => fiber.ctx.reflect.get(name) === undefined)

const faultOf = (reason: unknown): string | undefined => {
  const said = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : ""
  const trimmed = said.trim()
  return trimmed === "" ? undefined : trimmed
}

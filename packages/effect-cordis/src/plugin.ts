import type { Context as CordisContext } from "cordis"
import { Cause, Context, Effect, Exit, Fiber, FiberSet, Schema, Scope } from "effect"

import { moduleOwner } from "./module.ts"
import { failed } from "./broadcast.ts"
import { held } from "./host.ts"
import { Offering, activate, startBegins, startThrew } from "./lifecycle.ts"
import type { AnyKey } from "./service.ts"

export const PluginName = Context.Reference<string>("effect-cordis/PluginName", {
  defaultValue: () => "root",
})

export interface Detach {
  (work: Effect.Effect<void>): void
  readonly held: (work: Effect.Effect<void>) => Fiber.Fiber<void>
}

export const detached: Effect.Effect<Detach, never, Scope.Scope> = Effect.gen(function*() {
  const who = yield* PluginName
  const run = yield* FiberSet.makeRuntime<never, void, never>()
  const contained = (work: Effect.Effect<void>): Effect.Effect<void> =>
    Effect.catchCause(work, (cause) => failed(who, "detached work", cause))
  const detach: Detach = Object.assign(
    (work: Effect.Effect<void>) => { run(contained(work)) },
    { held: (work: Effect.Effect<void>) => run(contained(work)) },
  )
  return detach
})

export interface EnvironmentDeclaration {
  readonly key: string
  readonly secret: boolean
  readonly says: string
}

export interface Plugin {
  readonly name: string
  readonly environment?: ReadonlyArray<EnvironmentDeclaration>
  readonly config?: Schema.ConstraintDecoder<unknown, never>
  readonly configUpdates?: "reapply" | "live"
  readonly inject: ReadonlyArray<string>
  readonly apply: (ctx: CordisContext, config?: unknown) => Promise<() => Promise<void>>
}

type NeedsOf<Keys extends ReadonlyArray<AnyKey>> =
  | Scope.Scope
  | Context.Service.Identifier<Keys[number]>

export const definePlugin = <const Keys extends ReadonlyArray<AnyKey>, Config = unknown>(
  spec: {
    readonly name: string
    readonly needs: Keys
    readonly environment?: ReadonlyArray<EnvironmentDeclaration>
    readonly config?: Schema.Schema<Config> & { readonly DecodingServices: never }
    readonly configUpdates?: "reapply" | "live"
    readonly apply:
      | Effect.Effect<void, never, NeedsOf<Keys>>
      | ((config: Config) => Effect.Effect<void, never, NeedsOf<Keys>>)
  },
): Plugin => ({
  name: spec.name,
  ...(spec.environment === undefined ? {} : { environment: spec.environment }),
  ...(spec.config === undefined ? {} : { config: spec.config }),
  ...(spec.configUpdates === undefined ? {} : { configUpdates: spec.configUpdates }),
  inject: spec.needs.map((key) => key.cordis),
  apply: async (ctx: CordisContext, config?: unknown) => {
    startBegins(ctx.fiber)
    try {
      const opened = held(ctx)
      if (ctx.fiber.uid === null) return async () => {}
      const who = moduleOwner(ctx)
      let services = Context.merge(opened, Context.make(PluginName, who)) as Context.Context<never>
      const activation = activate(ctx, opened)
      try {
        for (const key of spec.needs) {
          const provision = (ctx as unknown as Record<string, unknown>)[key.cordis]
          if (typeof provision !== "function") {
            throw new Error(
              `effect-cordis: "${who}" named the service "${key.cordis}", which is `
                + "provided as something other than a provision — a host provides "
                + "`(plugin) => service` and nothing else.",
            )
          }
          services = Context.add(
            services,
            key as unknown as Context.Service<unknown, unknown>,
            (provision as (plugin: string, lifetime: { current: () => boolean }) => unknown)(who, { current: activation.current }),
          ) as Context.Context<never>
        }
      } catch (error) {
        await activation.close(Exit.void)
        throw error
      }
      services = Context.add(Context.add(services, Offering, activation), Scope.Scope, activation.scope) as Context.Context<never>
      const work = Effect.suspend(() => {
        const value = spec.config === undefined ? (config ?? {}) as Config : Schema.decodeUnknownSync(spec.config)(config ?? {})
        return Effect.isEffect(spec.apply) ? spec.apply : spec.apply(value)
      })
      const running = Effect.runForkWith(services)(work as Effect.Effect<void>)
      activation.bind(running)
      const exit = await Effect.runPromise(Fiber.await(running))
      if (Exit.isFailure(exit)) {
        const unwound = await Effect.runPromiseExit(Effect.promise(() => activation.close(exit)))
        if (Exit.isFailure(unwound)) {
          await Effect.runPromiseWith(opened)(
            failed(who, "unwinding after a failed start", unwound.cause),
          )
        }
        if (!Cause.hasInterruptsOnly(exit.cause)) throw Cause.squash(exit.cause)
      }
      return () => activation.close(Exit.void)
    } catch (reason) {
      startThrew(ctx.fiber, reason)
      throw reason
    }
  },
})

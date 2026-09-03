/**
 * A PLUGIN, AS AN EFFECT — the whole of the translation, in one function.
 *
 * ## The two accumulators are one accumulator
 *
 * The paper Cordis is built on calls a plugin a set of REVERTIBLE EFFECTS: a
 * context transformation paired with its inverse, with the runtime holding the
 * inverses and running them LIFO when the plugin unloads. Cordis spells that
 * `ctx.effect(() => disposer)`.
 *
 * Effect's `Scope` is the same accumulator, spelled `Effect.acquireRelease` and
 * `Effect.addFinalizer`, with the same LIFO discipline and a great deal more
 * said about interruption. So {@link definePlugin} opens ONE `Scope` when the
 * fiber activates, runs the plugin's Effect inside it, and hands Cordis a
 * disposer that closes it. Every registration a plugin makes is a finalizer on
 * that scope; the plugin author never calls `ctx.effect`, never sees a
 * disposer, and never learns that Cordis is under any of it.
 *
 * ## `inject` and the requirement channel are one declaration
 *
 * `needs` is a list of {@link ServiceKey}s. The `inject` array Cordis holds the
 * fiber `PENDING` against is `needs.map(key => key.cordis)`; the `R` the
 * compiler holds `apply` against is the union of the same list's identifiers.
 * A plugin that yields a tag it did not list is a type error at its own
 * `definePlugin` call, with the plugin's file in the message — which is the
 * guarantee `as const satisfies` used to buy at a registry, moved to the one
 * place both halves are in hand.
 *
 * ## A FAILURE INSTALLS NOTHING
 *
 * If the Effect dies, the scope is closed with that exit — every finalizer it
 * had already installed runs, in reverse — and the failure is re-thrown into
 * Cordis, which lands the fiber in `FAILED` with its siblings ACTIVE. That is
 * the corollary the whole bundle's boot containment rests on, and it is
 * strictly cheaper to keep here than in every plugin.
 */

import type { Context as CordisContext } from "cordis"
import { Cause, Context, Effect, Exit, FiberSet, Scope } from "effect"

import { failed } from "./broadcast.ts"
import { held } from "./host.ts"
import type { ServiceKey } from "./service.ts"

/**
 * THE PLUGIN'S OWN WORD — the name the registry bound this fiber under, read
 * off the fiber once and provided to the Effect.
 *
 * A `Reference` rather than a service, so it is AMBIENT: it never appears in a
 * plugin's `needs`, because there is no arrangement in which a plugin is
 * running and does not have one. What it is FOR is the handful of places a
 * plugin has to spell its own identity into a value core does not stamp for it
 * — a coalesce key, a sentence about itself — and using this rather than a
 * module constant is what keeps that word the registry binding rather than a
 * second copy of it.
 *
 * The default is `"root"`, which is the word Cordis's own root fiber answers
 * with; nothing mounted through this package ever reads it.
 */
export const PluginName = Context.Reference<string>("effect-cordis/PluginName", {
  defaultValue: () => "root",
})

/**
 * RUN AN EFFECT FROM CODE THAT IS NOT ONE — the one seam across the boundary,
 * named once so it is not re-invented per plugin.
 *
 * ## Why it exists at all
 *
 * A plugin's `apply` is an Effect and everything it registers is a finalizer,
 * but what DRIVES a plugin at runtime is frequently not Effect: an appliance's
 * watcher fires a callback, a timer beats, a socket says something. Those
 * libraries are not olai's and are not wrapped (that is a standing ruling about
 * `@kolu/surface` and every appliance beside it), so somewhere at that edge an
 * Effect has to be started from a plain function.
 *
 * This is that somewhere, and there is exactly one of it. What it gives back
 * runs the work under the plugin's OWN services — so a line the work logs
 * carries the level the operator asked for and the annotations the serve set,
 * which a bare `Effect.runFork` would silently drop — and forks it into a set
 * held by the calling scope, so work still in flight when the plugin unloads is
 * interrupted with it rather than outliving the fiber that started it.
 *
 * FIRE AND FORGET, because every caller is a sink with nowhere to put a
 * failure. The work's error channel is `never` for the same reason: a callback
 * from somebody else's timer is not a place to decide what a failure means.
 *
 * ## ...AND FORGET IS NOT SILENT
 *
 * It was. The fiber this forks is discarded, a failing one only settles a
 * `Deferred` nobody joins, and effect's error reporting is opt-in — so a defect
 * in detached work vanished: no log, no fault, no row. That is the one seam
 * every plugin drives its real work through (a doorbell walk, a snapshot the
 * mirror persists, a heartbeat), and it was the only one of the three
 * fire-and-forget edges in this package that said nothing, where a bus and a
 * waterfall both name the plugin and carry the cause.
 *
 * So the work is wrapped in the same {@link ./broadcast.ts}'s `contained` the
 * other two use, with this plugin's own word on the line — read off
 * {@link PluginName}, which is provided into every `apply` before it runs.
 */
export type Detach = (work: Effect.Effect<void>) => void

/** The seam, for the scope that yields it. */
export const detached: Effect.Effect<Detach, never, Scope.Scope> = Effect.gen(function*() {
  const who = yield* PluginName
  const run = yield* FiberSet.makeRuntime<never, void, never>()
  return (work) => {
    run(Effect.catchCause(work, (cause) => failed(who, "detached work", cause)))
  }
})

/** ANY SERVICE KEY, whatever it is a key FOR — the constraint {@link needs}
 *  takes, and the reason it is written as an intersection is that both halves
 *  are load-bearing: the Effect side is what `R` is computed from, and
 *  `cordis` is what `inject` is. */
export type AnyKey = Context.Service.Any & { readonly cordis: string }

/**
 * WHAT CORDIS MOUNTS — a plain object with the three fields the registry reads.
 *
 * Deliberately structural and deliberately not exported as a class: this is the
 * value a bundle row's module hands the loader (as its `default`), and the
 * loader's own contract is "a function, or an object with an `apply`". Nothing
 * about it is this package's to make ceremonious.
 */
export interface Plugin {
  readonly name: string
  readonly inject: ReadonlyArray<string>
  readonly apply: (ctx: CordisContext) => Promise<() => Promise<void>>
}

/**
 * DEFINE ONE.
 *
 * `name` is the word the fiber is bound under — for a bundle row, the row's
 * `id`, which is also the sibling key, the docs slug and the stamp every keyed
 * service reads.
 */
export const definePlugin = <const Keys extends ReadonlyArray<AnyKey>>(
  spec: {
    readonly name: string
    /** The services this plugin needs, as keys. Both declarations come off this
     *  one list, so they cannot disagree. */
    readonly needs: Keys
    /** ...and the plugin itself. `never` in the error channel because a plugin
     *  has nobody to fail TO: what it cannot survive is a defect, which lands
     *  the fiber in `FAILED` and says so on the row. */
    readonly apply: Effect.Effect<
      void,
      never,
      Scope.Scope | Context.Service.Identifier<Keys[number]>
    >
  },
): Plugin => ({
  name: spec.name,
  inject: spec.needs.map((key) => key.cordis),
  apply: async (ctx: CordisContext) => {
    const host = held(ctx)
    // THE STAMP, READ ONCE, off the registry binding — never off anything the
    // plugin supplied. Every keyed service below is minted from it.
    const who = ctx.fiber.name
    const scope = Scope.makeUnsafe()
    let services: Context.Context<never> = Context.merge(
      host.services,
      Context.make(PluginName, who),
    ) as Context.Context<never>
    services = Context.add(services, Scope.Scope, scope) as Context.Context<never>
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
        (provision as (plugin: string) => unknown)(who),
      ) as Context.Context<never>
    }
    const exit = await Effect.runPromiseExitWith(services)(
      spec.apply as Effect.Effect<void>,
    )
    if (Exit.isFailure(exit)) {
      // EVERY FINALIZER IT HAD ALREADY INSTALLED, before the throw goes out —
      // which is what "lands FAILED having installed nothing" means when the
      // plugin got halfway. Closing with the failing exit is also what tells a
      // finalizer it is unwinding rather than shutting down.
      //
      // AND THE UNWIND MAY FAIL TOO, which is why this is `Exit` rather than a
      // bare await. `Scope.close` is typed `Effect<void>` and is not infallible:
      // it collects every finalizer's exit and ends on their combination, so one
      // dying finalizer made this promise REJECT — and the `throw` below never
      // ran, so what Cordis recorded as the row's fault, and what an operator
      // then read on the preferences row, was the CLEANUP's defect rather than
      // the plugin's. The plugin's failure is the subject of this whole arm; it
      // wins, and a finalizer that died on the way out is said beside it.
      const unwound = await Effect.runPromiseExitWith(host.services)(Scope.close(scope, exit))
      if (Exit.isFailure(unwound)) {
        await Effect.runPromiseWith(host.services)(
          failed(who, "unwinding after a failed start", unwound.cause),
        )
      }
      throw Cause.squash(exit.cause)
    }
    return () => Effect.runPromiseWith(host.services)(Scope.close(scope, Exit.void))
  },
})

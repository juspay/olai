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
 * `needs` is a list of {@link ./service.ts}'s `ServiceKey`s. The `inject` array
 * Cordis holds the fiber `PENDING` against is `needs.map(key => key.cordis)`;
 * the `R` the compiler holds `apply` against is the union of the same list's
 * identifiers. A plugin that yields a tag it did not list is a type error at its own
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
import { Cause, Context, Effect, Exit, FiberSet, Schema, Scope } from "effect"

import { failed } from "./broadcast.ts"
import { held } from "./host.ts"
import type { AnyKey } from "./service.ts"

/**
 * THE PLUGIN'S OWN WORD, INSIDE THIS PACKAGE — the name the registry bound this
 * fiber under, read off the fiber once and provided into the Effect.
 *
 * A `Reference` rather than a service, so it is AMBIENT: it never appears in a
 * plugin's `needs`, because there is no arrangement in which a plugin is running
 * and does not have one.
 *
 * ## NOT ON THE DOOR, and that is the point rather than an omission
 *
 * It was exported, and re-exported onto the door plugins open, so a plugin had
 * TWO documented ways to ask who it was. The other is {@link ./service.ts}'s
 * `Provision`, which answers the same question WITHOUT the plugin being able to
 * spell it — and that inability is the whole design: a keyed service has no
 * parameter for "who", so one plugin cannot sign another's registration. A
 * second channel where the word IS spellable weakens the first for a use no
 * plugin has (the three in this tree spell their own `name` import, which they
 * already hold from `./wire.ts`).
 *
 * What it is FOR is HERE: {@link detached} needs the word to say whose detached
 * work failed, and it is inside the facade rather than on the plugin's side of
 * it. In-package, so this package's own bench can assert the stamp through it.
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
 *
 * ## ONE FIBER PER CALL, so two calls are not ordered
 *
 * Each call forks. Two of them from one callback are two fibers, and nothing
 * sequences them: the lines they write may reach the sink in either order, and
 * a second call is not a continuation of the first. That is what a seam out of
 * somebody else's callback can be, not a shortcoming of this one — the caller
 * has no fiber to be a continuation OF.
 *
 * It is why the appliances spend this on CHATTER, where each line stands alone
 * and a swapped pair costs a reader nothing. Where an order is load-bearing,
 * the answer is one Effect that does both things rather than two calls: inside
 * an Effect the sequencing is Effect's, which is the whole reason a plugin's
 * real work is `apply` and its registrations are finalizers rather than a pile
 * of forks.
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

/**
 * WHAT CORDIS MOUNTS — a plain object with the fields the registry reads.
 *
 * Deliberately structural and deliberately not exported as a class: this is the
 * value a bundle row's module hands the loader (as its `default`), and the
 * loader's own contract is "a function, or an object with an `apply`". Nothing
 * about it is this package's to make ceremonious.
 *
 * `Config` is the row's `config:` validated at load, Standard Schema so the
 * loader refuses an invalid value with a sentence before `apply` runs. Absent
 * when the plugin has no config.
 */
export interface Plugin {
  readonly name: string
  readonly inject: ReadonlyArray<string>
  /** Standard Schema, so Cordis validates the row's `config:` at load. */
  readonly Config?: {
    readonly "~standard": {
      readonly version: 1
      readonly vendor: string
      readonly validate: (
        value: unknown,
      ) => { readonly value: unknown } | { readonly issues: ReadonlyArray<{ readonly message: string }> }
    }
  }
  readonly apply: (ctx: CordisContext, config?: unknown) => Promise<() => Promise<void>>
}

type NeedsOf<Keys extends ReadonlyArray<AnyKey>> =
  | Scope.Scope
  | Context.Service.Identifier<Keys[number]>

/** Wrap an Effect schema as the Standard Schema Cordis validates at load.
 *  Absent / null config becomes `{}`, so a row with no `config:` still
 *  decodes to the schema's defaults; an invalid value fails with a sentence. */
const standardOf = (schema: Schema.Schema<unknown>): NonNullable<Plugin["Config"]> => ({
  "~standard": {
    version: 1,
    vendor: "effect-cordis",
    validate: (value: unknown) => {
      try {
        const decode = Schema.decodeUnknownSync as (
          schema: Schema.Schema<unknown>,
        ) => (value: unknown) => unknown
        return { value: decode(schema)(value ?? {}) }
      } catch (error) {
        return {
          issues: [{ message: error instanceof Error ? error.message : String(error) }],
        }
      }
    },
  },
})

/**
 * DEFINE ONE.
 *
 * `name` is the word the fiber is bound under — for a bundle row, the row's
 * `id`, which is also the sibling key, the docs slug and the stamp every keyed
 * service reads.
 *
 * `config` is the schema a row's `config:` is validated against at load.
 * Defaults live on the fields; an invalid value fails the load with a
 * sentence. The decoded value is handed to `apply`.
 */
export const definePlugin = <const Keys extends ReadonlyArray<AnyKey>, Config = unknown>(
  spec: {
    readonly name: string
    readonly needs: Keys
    readonly config?: Schema.Schema<Config>
    readonly apply:
      | Effect.Effect<void, never, NeedsOf<Keys>>
      | ((config: Config) => Effect.Effect<void, never, NeedsOf<Keys>>)
  },
): Plugin => ({
  name: spec.name,
  inject: spec.needs.map((key) => key.cordis),
  ...(spec.config === undefined ? {} : { Config: standardOf(spec.config as Schema.Schema<unknown>) }),
  apply: async (ctx: CordisContext, config?: unknown) => {
    const opened = held(ctx)
    // THE STAMP, READ ONCE, off the registry binding — never off anything the
    // plugin supplied. Every keyed service below is minted from it.
    const who = ctx.fiber.name
    const scope = Scope.makeUnsafe()
    // THE TWO AMBIENT ONES KEEP THEIR TYPES, because both are known here: the
    // context that comes out of this says it carries a plugin name and a scope,
    // and nothing is asserted to get there.
    //
    // The LOOP is where the tracking genuinely ends — a provision is resolved by
    // a runtime string off a Cordis context, so what a key is a key FOR is not a
    // thing the compiler can follow — and that is the one place the assertion
    // belongs. It was written four times, once after each `merge` and `add`,
    // which made a reader check three identical casts to find the one that meant
    // something.
    let services = Context.add(
      Context.merge(opened, Context.make(PluginName, who)),
      Scope.Scope,
      scope,
    ) as Context.Context<never>
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
    const work = Effect.isEffect(spec.apply)
      ? spec.apply
      : spec.apply((config ?? {}) as Config)
    const exit = await Effect.runPromiseExitWith(services)(
      work as Effect.Effect<void>,
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
      const unwound = await Effect.runPromiseExitWith(opened)(Scope.close(scope, exit))
      if (Exit.isFailure(unwound)) {
        await Effect.runPromiseWith(opened)(
          failed(who, "unwinding after a failed start", unwound.cause),
        )
      }
      throw Cause.squash(exit.cause)
    }
    return () => Effect.runPromiseWith(opened)(Scope.close(scope, Exit.void))
  },
})

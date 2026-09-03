/**
 * THE HOST — one Cordis context, and the Effect services every plugin mounted
 * on it will run under.
 *
 * ## What a host IS, and why it is opaque
 *
 * Two things at once, and they have to be minted together. The first is the
 * Cordis context: the registry a plugin is a fiber in, the reflect store an
 * `inject` resolves against, the loader the rows are mounted through. The
 * second is the Effect CONTEXT in force where the host was opened — the logger,
 * the minimum level the operator asked for, the annotations and spans the
 * enclosing scope set. A plugin's `apply` is an Effect and Cordis will call it
 * from a promise chain with no fiber under it, so the services have to be
 * captured somewhere while there IS a fiber, once, and that is here.
 *
 * Nothing outside this package may reach either half, which is why {@link Host}
 * carries no public field. A composition root that could reach the Cordis
 * context would be a second package that knows Cordis, and the whole of this
 * package's reason is that there is exactly one.
 *
 * ## The three verbs
 *
 * {@link provide} puts a service behind a key — the other end of a plugin's
 * `inject`, and the value is a {@link Provision} so the per-plugin stamp is
 * read off the fiber rather than off an argument. {@link mountPlugin} mounts one
 * plugin, which is what a test and a browser do. {@link rowReport} says what
 * became of each row.
 *
 * MOUNTING A DECLARATIVE BUNDLE is `./loader.ts`, behind this package's second
 * door, and that split is a GRAPH: the loader reads a file off a disk and the
 * tab mounts plugins too.
 */

import { Context as CordisContext, FiberState } from "cordis"
import type { Fiber } from "cordis"
import { Context, Effect, Scope } from "effect"

import type { Plugin } from "./plugin.ts"
import type { Provision, ServiceKey } from "./service.ts"

/** Where a host hangs on its own Cordis root — a SYMBOL, which Cordis's reflect
 *  proxy passes straight through to the underlying object rather than routing
 *  through `provide`/`inject`. So the facade can find the Effect services from
 *  any derived context without the host being a service a plugin could name. */
const HELD: unique symbol = Symbol.for("olai.effect-cordis.host")

/** What {@link Host} actually is, on the inside. */
interface Held {
  readonly ctx: CordisContext
  readonly services: Context.Context<never>
}

/**
 * ONE PLUGIN RUNTIME. Opaque on purpose — see the header.
 */
export interface Host {
  readonly [HELD]: Held
}

/** The two halves, for this package's own use. */
export const heldBy = (host: Host): Held => host[HELD]

/** ...and the same reading from any context a fiber was handed, which is how
 *  `definePlugin` finds the services it must run the plugin's Effect under. */
export const heldOn = (ctx: CordisContext): Held => {
  const held = (ctx as unknown as Record<symbol, Held | undefined>)[HELD]
  if (held === undefined) {
    throw new Error(
      "effect-cordis: this plugin was mounted on a context that is not a host — "
        + "mount through `mountPlugin` or the loader, which is what captures the "
        + "Effect services a plugin's `apply` runs under.",
    )
  }
  return held
}

/**
 * OPEN A HOST, under the services of the fiber that opens it.
 *
 * NOT SCOPED, and that is a phase boundary rather than an oversight: the
 * composition root mounts its plugins before the store opens and lets the
 * process own them for its life, exactly as it did before this package existed.
 * A host that closed its fibers on scope exit would be a behaviour change on
 * every shutdown path in the tree, which is not this phase's to make.
 */
export const openHost: Effect.Effect<Host> = Effect.map(
  Effect.context<never>(),
  (services) => {
    const ctx = new CordisContext()
    const host = ctx as unknown as Host & { [HELD]: Held }
    host[HELD] = { ctx, services }
    return host
  },
)

/**
 * PUT A SERVICE BEHIND A KEY, for as long as the enclosing scope is open.
 *
 * The Cordis half of this is `ctx.provide(key, value)` on the ROOT fiber, so
 * every plugin fiber under it resolves the key and none of them can be told the
 * provider went away by anything other than this scope closing. That is the
 * reactive coeffect's other end: a fiber whose `inject` names a key nobody has
 * provided sits `PENDING`, and one whose provider is revoked unloads.
 */
export const provide = <Shape>(
  host: Host,
  key: ServiceKey<Shape>,
  provision: Provision<Shape>,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => heldBy(host).ctx.provide(key.cordis, provision)),
    (revoke) => Effect.promise(async () => void await revoke()),
  ).pipe(Effect.asVoid)

/** ONE MOUNTED PLUGIN, as the thing that mounted it holds it. */
export interface Mounted {
  /** What the runtime made of it — see {@link RowReport}. */
  readonly report: Effect.Effect<RowReport>
  /** Unload it: every finalizer its `apply` installed runs, in reverse. */
  readonly dispose: Effect.Effect<void>
}

/**
 * MOUNT ONE PLUGIN — the direct door, which is what a test uses and what a
 * composition root uses for a plugin it does not read off a row.
 *
 * It RETURNS once the fiber has settled, so a caller can read whatever the
 * plugin registered on the next line. A plugin held `PENDING` on a service
 * nobody has provided settles immediately in that state; it is not an error and
 * there is nothing to wait for.
 */
export const mountPlugin = (host: Host, plugin: Plugin): Effect.Effect<Mounted> =>
  Effect.promise(async () => {
    const fiber: Fiber = heldBy(host).ctx.plugin(plugin)
    // SWALLOWED, and it is the containment claim rather than a shrug: a plugin
    // whose `apply` failed lands in `FAILED` having installed nothing, and its
    // siblings — and the boot — are untouched. What it threw is not lost; it is
    // what {@link rowReport} quotes.
    await fiber.await().catch(() => undefined)
    return {
      report: Effect.promise(() => reportOf(fiber)),
      dispose: Effect.promise(() => fiber.dispose()),
    }
  })

/**
 * WHAT BECAME OF ONE ROW — deliberately four states rather than the runtime's
 * six.
 *
 * `off` is a row the loader declined to load and a fiber on its way out alike:
 * both have unwound every registration they made, and a reader has no use for
 * the difference. `waiting` folds `PENDING` (a service it names is not there)
 * into `LOADING` (it has not finished starting), because a row that has not
 * started has not started. This reading says nothing about WHO turned a row off;
 * the row's own default and an operator's overlay are the same field by design,
 * so telling them apart is the caller's and not this package's.
 */
export type RowState = "running" | "waiting" | "failed" | "off"

/**
 * One row's state, and the plugin's own words if its start failed.
 *
 * A UNION AND NOT A PRODUCT, because `fault`'s validity has a precondition on
 * `state` and a doc sentence is not a type. It was `{ state; fault?: string }`,
 * which made `{ state: "running", fault: "…" }` constructible and left every
 * consumer keeping the rule by hand — the shape where each field reads honest
 * alone and the lie lives in the joint distribution. The dependent fact exists
 * only on the arm that grounds it now, and `reportOf` below already built
 * exactly these two shapes.
 *
 * VERBATIM on that arm — what the plugin threw, with nothing composed around it.
 * Absent where it threw something with no message.
 */
export type RowReport =
  | { readonly state: Exclude<RowState, "failed"> }
  | { readonly state: "failed"; readonly fault?: string }

/**
 * EVERY NAMED ROW'S STATE, off the live registry.
 *
 * ## Why the registry and not the loader's entries
 *
 * `@cordisjs/plugin-include` is an `EntryTree` of its own and is mounted as an
 * ordinary plugin rather than as a loader entry — so the link `EntryTree`'s
 * constructor draws is never drawn, and `ctx.loader.entries()` yields nothing
 * about the rows. The registry has them either way: a row that loaded called
 * `ctx.plugin` on the module it named, and a runtime is keyed by that module's
 * own `name`, which every row's plugin declares as the row's `id`. One reading,
 * and it does not depend on a private link between two of the pin's packages.
 *
 * A row that never loaded is ABSENT from the registry, and that absence IS the
 * `off` arm rather than a missing case.
 */
export const rowReport = (
  host: Host,
  ids: ReadonlyArray<string>,
): Effect.Effect<ReadonlyMap<string, RowReport>> =>
  Effect.promise(async () => {
    const wanted = new Set(ids)
    const fibers = new Map<string, Fiber>()
    heldBy(host).ctx.registry.forEach((runtime) => {
      const id = runtime.name
      if (id === undefined || !wanted.has(id)) return
      // The FIRST fiber, and a row has exactly one: a bundle mounts each module
      // once. A second would mean two rows naming one module, which the entry
      // ids already forbid.
      for (const fiber of runtime.fibers) {
        if (!fibers.has(id)) fibers.set(id, fiber)
      }
    })
    const table = new Map<string, RowReport>()
    for (const id of ids) {
      const fiber = fibers.get(id)
      table.set(id, fiber === undefined ? { state: "off" } : await reportOf(fiber))
    }
    return table
  })

/** One fiber's state, as a row's word.
 *
 *  ASYNC because a fault is only readable by asking for it: Cordis keeps a
 *  failed fiber's error private and re-throws it from `await()`, which for a
 *  settled fiber is one already-rejected promise. Every other state answers
 *  synchronously. */
const reportOf = async (fiber: Fiber): Promise<RowReport> => {
  switch (fiber.state) {
    case FiberState.ACTIVE:
      return { state: "running" }
    case FiberState.PENDING:
    case FiberState.LOADING:
      return { state: "waiting" }
    case FiberState.FAILED: {
      const fault = await fiber.await().then(() => undefined, faultOf)
      return fault === undefined ? { state: "failed" } : { state: "failed", fault }
    }
    default:
      return { state: "off" }
  }
}

/** The plugin's own words, or nothing — never a paraphrase of them. A throw with
 *  no message reaches a reader as a row that says a start threw and quotes
 *  nobody, which is honest; `String(reason)` on a bare `Error` would put the
 *  word "Error" on screen as if the plugin had said it. */
const faultOf = (reason: unknown): string | undefined => {
  const said = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : ""
  const trimmed = said.trim()
  return trimmed === "" ? undefined : trimmed
}

/**
 * A SCOPE THAT OUTLIVES ITS CALLER, and the one way to run against it from code
 * that is not an Effect.
 *
 * ## What it is for
 *
 * Everything this package hands back is `Effect<_, never, Scope>`: a host, a
 * service, a bus, a mounted plugin. Every one of those is opened by something
 * that is NOT an Effect and that owns the runtime for its own lifetime — a tab's
 * module scope, a bench's case, a composition root's boot. That crossing was
 * written out seven times in one commit, byte for byte, and a seam re-invented
 * per caller is a seam nobody can change; {@link detached} is the same argument
 * about the other direction, and it is one function.
 *
 * ## The scope is never closed, and that is the shape rather than a leak
 *
 * A standing runtime lives as long as the thing that opened it: a page until it
 * navigates away, a case until it ends, a serve until the process does. What the
 * scope is FOR is that every registration a plugin makes hangs off ITS OWN
 * scope, inside this one, and unwinds when that plugin is dropped. A caller that
 * genuinely wants to close the whole runtime holds an `Effect.scoped` instead
 * and never reaches for this.
 */
export const standing = (): <A>(work: Effect.Effect<A, never, Scope.Scope>) => Promise<A> => {
  const scope = Scope.makeUnsafe()
  return (work) => Effect.runPromise(Effect.provideService(work, Scope.Scope, scope))
}

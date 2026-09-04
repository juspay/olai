/**
 * THE HOST — one Cordis context, and the Effect services every plugin mounted
 * on it will run under.
 *
 * ## What a host IS, and why it is opaque
 *
 * A host IS the Cordis context — the registry a plugin is a fiber in, the
 * reflect store an `inject` resolves against, the loader the rows are mounted
 * through — with ONE thing hung on it: the Effect CONTEXT in force where it was
 * opened (the logger, the minimum level the operator asked for, the annotations
 * and spans the enclosing scope set). A plugin's `apply` is an Effect and Cordis
 * will call it from a promise chain with no fiber under it, so the services have
 * to be captured somewhere while there IS a fiber, once, and that is here.
 *
 * Nothing outside this package may reach either, which is why {@link Host}
 * carries no public field. A composition root that could reach the Cordis
 * context would be a second package that knows Cordis, and the whole of this
 * package's reason is that there is exactly one.
 *
 * ## The four verbs
 *
 * {@link provide} puts a service behind a key — the other end of a plugin's
 * `inject`, and the value is a {@link Provision} so the per-plugin stamp is
 * read off the fiber rather than off an argument. {@link mountPlugin} mounts one
 * plugin, which is what a test and a browser do. {@link settled} waits until the
 * named rows have stopped moving, which is what a bundle whose own rows provide
 * services to each other needs and what mounting one alone does not give.
 * {@link rowReport} says what became of each row.
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

/**
 * ONE PLUGIN RUNTIME. Opaque on purpose — see the header.
 *
 * What it hangs on itself is the Effect services and NOTHING ELSE, so that is
 * what the symbol holds rather than a record with one field on it. It carried
 * the Cordis context beside them for a round, which was a self-reference the
 * type hid: a host IS that context ({@link openHost} casts one), so the field
 * was always `host` itself. {@link ctxOf} is that cast, spelled once — and when
 * it went, the wrapper it had shared was a box with one thing in it.
 */
export interface Host {
  readonly [HELD]: Context.Context<never>
}

/**
 * WHAT A HOST IS HOLDING — read off any context a fiber was handed, which is how
 * `definePlugin` finds the services it must run the plugin's Effect under.
 *
 * A CORDIS CONTEXT is what every caller has, and a host is one: `extend` puts
 * the root on the prototype chain, so a derived context resolves the same symbol
 * off the same object, and {@link ctxOf} spells the other direction where the
 * three verbs below need it.
 */
export const held = (of: CordisContext): Context.Context<never> => {
  const found = (of as unknown as Record<symbol, Context.Context<never> | undefined>)[HELD]
  if (found === undefined) {
    throw new Error(
      "effect-cordis: this plugin was mounted on a context that is not a host — "
        + "mount through `mountPlugin` or the loader, which is what captures the "
        + "Effect services a plugin's `apply` runs under.",
    )
  }
  return found
}

/** ...and the host AS the context it is, which is the one cast this package
 *  makes about its own opaque type. */
export const ctxOf = (host: Host): CordisContext => host as unknown as CordisContext

/**
 * OPEN A HOST, under the services of the fiber that opens it.
 *
 * ## NOT SCOPED — and what that does and does not leave undone
 *
 * A host has no close. What it holds is a registry and the Effect services in
 * force where it was opened; neither is a resource, and both go with the
 * process.
 *
 * ITS PLUGINS DO COME DOWN, and by the reactive half rather than by anything
 * here. {@link provide} is an `acquireRelease` on the CALLER's scope, so a
 * composition root that closes that scope on the way out revokes every service
 * it provided, and revoking one unloads every fiber that named it — which
 * closes each plugin's own scope and runs its finalizers, in reverse. That is
 * the shutdown path in this tree: `@olai/server`'s `main.ts` runs the whole
 * command under `Effect.scoped`, and `runMain` interrupts it on SIGINT and
 * SIGTERM, so the unwind is the ordinary one. `plugin.test.ts`'s replaced-
 * provider bench is the same mechanism, two lines apart.
 *
 * WHAT IS LEFT is a plugin whose `needs` is EMPTY: it depends on nothing that
 * can be revoked, so nothing unloads it but the disposer its mount handed back.
 * There is no such plugin in this tree — every half, in both processes, names at
 * least one service — and the bench beside that one pins the shape so the claim
 * is checkable rather than remembered. A host that closed its own fibers would
 * close that gap and would also be a behaviour change on every shutdown path,
 * which is the loader surface's to make when it owns one.
 */
export const openHost: Effect.Effect<Host> = Effect.map(
  Effect.context<never>(),
  (services) => {
    const host = new CordisContext() as unknown as { [HELD]: Context.Context<never> }
    host[HELD] = services
    return host as unknown as Host
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
    Effect.sync(() => ctxOf(host).provide(key.cordis, provision)),
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
    const fiber: Fiber = ctxOf(host).plugin(plugin)
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
 * THE NAMED ROWS' FIBERS, off the live registry — the one walk both verbs below
 * spend, and the reading that does not depend on a private link between two of
 * the pin's packages.
 *
 * ## Why the registry and not the loader's entries
 *
 * `@cordisjs/plugin-include` is an `EntryTree` of its own and is mounted as an
 * ordinary plugin rather than as a loader entry — so the link `EntryTree`'s
 * constructor draws is never drawn, and `ctx.loader.entries()` yields nothing
 * about the rows. The registry has them either way: a row that loaded called
 * `ctx.plugin` on the module it named, and a runtime is keyed by that module's
 * own `name`, which every row's plugin declares as the row's `id`.
 *
 * A row that never loaded is ABSENT from the map, and the two callers read that
 * absence differently on purpose — {@link rowReport} calls it `off`, and
 * {@link settled} has nothing to wait for.
 */
const fibersOf = (host: Host, ids: ReadonlyArray<string>): ReadonlyMap<string, Fiber> => {
  const wanted = new Set(ids)
  const fibers = new Map<string, Fiber>()
  ctxOf(host).registry.forEach((runtime) => {
    const id = runtime.name
    if (id === undefined || !wanted.has(id) || fibers.has(id)) return
    // The FIRST fiber, and a row has exactly one: a bundle mounts each module
    // once. A second would mean two rows naming one module, which the entry ids
    // already forbid — so this reads the first and does not loop looking for one
    // it has already refused to replace.
    const [first] = runtime.fibers
    if (first !== undefined) fibers.set(id, first)
  })
  return fibers
}

/**
 * HOW MANY PASSES {@link settled} MAKES before it stops waiting and says so.
 *
 * A bound rather than a `for(;;)`, because the termination argument is a claim
 * about a PIN: `inertia` is cleared when a transition finishes, and a revision
 * that left a resolved promise on the field instead would turn the loop into a
 * hang at every boot — which is the worst failure shape available here. A high
 * bound costs nothing on the path anybody walks (a bundle settles in two or
 * three passes) and turns that hang into a slow boot with a loud line on it.
 */
const PASSES = 100

/**
 * WAIT UNTIL THE NAMED ROWS HAVE STOPPED MOVING — the settle a bundle needs once
 * one of its own rows provides a service another one names.
 *
 * ## Why mounting a bundle is not enough, and never was
 *
 * `./loader.ts`'s `mountRows` awaits a row's module IMPORT and the creation of
 * its fiber; it never awaits the fiber, because `Entry.init`'s own
 * `this.fiber?.await()` is deliberately not awaited. And `ctx.loader.await()`
 * walks the LOADER's tree, which is empty for the reason {@link fibersOf}
 * records one wall up: the include is an `EntryTree` mounted as an ordinary
 * plugin, so the rows are in ITS store and the loader's own is bare. The whole
 * of `mountRows`' guarantee is `await ctx.plugin(Include, …)`, which covers an
 * `apply` that finishes inside the mount's own microtask chain and nothing more.
 *
 * MEASURED, not reasoned: two rows through `mountRows`, one providing a key the
 * other names. Both applies microtask-only — both `running` on return. One
 * `Effect.sleep("5 millis")` in either apply — that row `waiting` on return,
 * and if it is the PROVIDER, both are. A tree in which every row's `apply` is
 * microtask-only is correct by coincidence; this makes it correct by
 * construction, which is what a bundle whose own rows stand behind doors needs.
 *
 * ## The loop, and why it terminates
 *
 * `inertia` is set only across a transition and cleared when it finishes, so a
 * fiber holding one is mid-reload or mid-unload. Awaiting a pass can create work
 * for the next one — a row that provides while it applies wakes its dependents,
 * which is the whole case this exists for — so it is a loop rather than one
 * `Promise.all`, which is also the shape the loader's own `EntryTree.await`
 * takes. {@link PASSES} bounds it.
 *
 * ## What it does NOT do is decide anything is wrong
 *
 * This waits out MOVEMENT, not readiness. A fiber genuinely `PENDING` on a key
 * nothing in this build offers holds no inertia at all, so it settles at once
 * and stays `waiting` — the `--plugins=kolu`-without-its-provider case, which is
 * a legitimate resting state and is what {@link rowReport} is about to name.
 */
export const settled = (host: Host, ids: ReadonlyArray<string>): Effect.Effect<void> =>
  Effect.flatMap(
    Effect.promise(async () => {
      const stillMoving = (): ReadonlyArray<readonly [string, Promise<void>]> =>
        [...fibersOf(host, ids)].flatMap(([id, fiber]) =>
          fiber.inertia === undefined ? [] : [[id, fiber.inertia] as const]
        )
      for (let pass = 0; pass < PASSES; pass += 1) {
        const held = stillMoving()
        if (held.length === 0) return []
        // ALLSETTLED, not `all`: a row whose reload throws rejects its own
        // inertia, and a boot that stopped waiting for its siblings because one
        // plugin died would be the containment claim undone at the last step.
        await Promise.allSettled(held.map(([, inertia]) => inertia))
      }
      // READ AFRESH rather than reported off the last pass: what the warning owes
      // a person is which rows are moving NOW, and the pass that ran out may have
      // been the one that finished them.
      return stillMoving().map(([id]) => id)
    }),
    (moving) =>
      moving.length === 0 ? Effect.void : Effect.logWarning(
        `plugins: gave up waiting for ${moving.join(", ")} to settle after ${PASSES} passes`,
      ),
  )

/**
 * WHAT BECAME OF ONE ROW — deliberately four states rather than the runtime's
 * six.
 *
 * `off` is a row the loader declined to load and a fiber on its way out alike:
 * both have unwound every registration they made, and a reader has no use for
 * the difference. `waiting` is one WORD over `PENDING` (a service it names is not
 * there) and `LOADING` (it has not finished starting), because a row that has not
 * started has not started — the two are told apart by what {@link RowReport}
 * carries beside the word rather than by a fifth state, so nothing that draws a
 * row has to learn a new one. This reading says nothing about WHO turned a row off;
 * the row's own default and an operator's overlay are the same field by design,
 * so telling them apart is the caller's and not this package's.
 */
export type RowState = "running" | "waiting" | "failed" | "off"

/**
 * One row's state, the plugin's own words if its start failed, and the keys it
 * is short of if it has not started.
 *
 * A UNION AND NOT A PRODUCT, because each dependent fact's validity has a
 * precondition on `state` and a doc sentence is not a type. It was `{ state;
 * fault?: string }`, which made `{ state: "running", fault: "…" }` constructible
 * and left every consumer keeping the rule by hand — the shape where each field
 * reads honest alone and the lie lives in the joint distribution. Each dependent
 * fact exists only on the arm that grounds it, and `reportOf` below already
 * builds exactly these shapes.
 *
 * `fault` is VERBATIM — what the plugin threw, with nothing composed around it.
 * Absent where it threw something with no message.
 *
 * `missing` NAMES KEYS AND NEVER A PLUGIN. Which row WOULD provide one is the
 * bundle's business and nothing here may know it; a second declaration on
 * `definePlugin` saying so would be a list that can disagree with the `inject`
 * derived from `needs`, which is the one thing that list is shaped to prevent.
 * A person reading `deliveries` on one row with `off` on another's two lines up
 * has the whole story, and no general package joined it for them. It is absent
 * rather than empty on the LOADING half of `waiting` — see {@link reportOf}.
 */
export type RowReport =
  | { readonly state: "running" | "off" }
  | { readonly state: "waiting"; readonly missing?: ReadonlyArray<string> }
  | { readonly state: "failed"; readonly fault?: string }

/**
 * EVERY NAMED ROW'S STATE, off the live registry — {@link fibersOf}'s walk, and
 * that function's header is where the argument for reading the registry rather
 * than the loader's entries lives.
 *
 * A row that never loaded is ABSENT from the registry, and that absence IS the
 * `off` arm rather than a missing case.
 */
export const rowReport = (
  host: Host,
  ids: ReadonlyArray<string>,
): Effect.Effect<ReadonlyMap<string, RowReport>> =>
  Effect.promise(async () => {
    const fibers = fibersOf(host, ids)
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
 *  synchronously.
 *
 *  THE TWO HALVES OF `waiting` ARE ONE WORD AND TWO ANSWERS. `PENDING` is a
 *  fiber short of something it names, and it can say WHAT; `LOADING` is a fiber
 *  that has not finished starting, which is short of nothing — so it carries no
 *  `missing` rather than an empty one, because an empty list reads as "waiting
 *  on nothing at all", which is a different and untrue sentence. They folded
 *  into one word before a service could arrive from a ROW, when nothing at a
 *  serve could produce the first of them. */
const reportOf = async (fiber: Fiber): Promise<RowReport> => {
  switch (fiber.state) {
    case FiberState.ACTIVE:
      return { state: "running" }
    case FiberState.PENDING:
      return { state: "waiting", missing: missingOf(fiber) }
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

/** WHICH OF A PENDING FIBER'S NAMED SERVICES NOBODY HAS PROVIDED.
 *
 *  Through the reflect PROXY and not off a private field: `reflect.get(name)`
 *  resolves a service and answers `undefined` where there is no impl at all OR
 *  where the impl's own fiber is not ACTIVE — which is exactly the question
 *  `Fiber._refresh` asks of each injected name to decide whether the fiber may
 *  run. `fiber.inject` is public too, and this package only ever produces
 *  REQUIRED injects (`needs.map(key => key.cordis)`, one list), so every key it
 *  answers with is one the fiber is genuinely held on.
 *
 *  Both readings are of the pin's public surface, which is the point: a private
 *  field would be a second coupling to a revision beside the two this package
 *  already names. */
const missingOf = (fiber: Fiber): ReadonlyArray<string> =>
  Object.keys(fiber.inject).filter((name) => fiber.ctx.reflect.get(name) === undefined)

/** The plugin's own words, or nothing — never a paraphrase of them. A throw with
 *  no message reaches a reader as a row that says a start threw and quotes
 *  nobody, which is honest; `String(reason)` on a bare `Error` would put the
 *  word "Error" on screen as if the plugin had said it. */
const faultOf = (reason: unknown): string | undefined => {
  const said = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : ""
  const trimmed = said.trim()
  return trimmed === "" ? undefined : trimmed
}


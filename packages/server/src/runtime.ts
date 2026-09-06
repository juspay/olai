/** The host composes scoped capability surfaces and publishes management.
 * Domain providers keep their own handlers, sources and compatibility tags.
 * A provider's disappearance revokes retained handlers through Surface's own
 * mount generation; unrelated sources and handler identities remain stable.
 */


import { NotFoundFailure, type PluginPin } from "@olai/format"
import { type BuiltPlugin, NO_ROSTER, type PluginRoster, type PluginState, type Who } from "@olai/surface/host"
import type { SurfaceSpec } from "@kolu/surface/define"
import { emptyHandlers, type ImplementSurfaceDeps, inMemoryStore, type MountedSurface, type SurfaceHandlers, type SurfaceRuntime } from "@kolu/surface/server"
import { Effect, Fiber, Queue, Stream } from "effect"
import type { Plugins, Registered, Wake } from "@olai/plugin-api/services"
import type { RowReport } from "@olai/bundle/bundle"
import { emitter } from "@olai/log"
import { hostSurface, hostFaces } from "@olai/surface/host"
import { composeCapabilities } from "./composition.ts"
import { authorityAt } from "@olai/plugin-api/authority"
import { CurrentWho } from "./who.ts"
export type Bound = Omit<SurfaceRuntime<typeof hostSurface.spec>, "ctx"> & { readonly writes: ReadonlyArray<string>; readonly rows: ReadonlyArray<Registered>; readonly rosterMoved: (run: () => void) => () => void }
export interface PluginRuntime {
  readonly plugins: Plugins
  readonly onChange: { run: () => void }
  readonly built: ReadonlyArray<string>
  readonly browserOnly?: ReadonlyArray<string>
  readonly pin: PluginPin
  readonly report: () => ReadonlyMap<string, RowReport>
  readonly names: () => ReadonlyMap<string, ReadonlyArray<string>>
  readonly configs: () => ReadonlyMap<string, Readonly<Record<string, unknown>>>
  readonly set: (id: string, enabled: boolean) => Effect.Effect<boolean>
  readonly reread: Effect.Effect<void>
  readonly switched: () => ReadonlySet<string>
  readonly catalogs?: () => ReadonlyArray<import("@olai/plugin-api/services").Catalog>
}
export interface Wiring {
  readonly hostname: string
  readonly startedAt: string
  readonly plugins: PluginRuntime | null
}
export const rosterOf = (
  offered: Wiring["plugins"],
  wakes: ReadonlyMap<string, Wake> = new Map(),
  offers: ReadonlyMap<string, string> = new Map(),
  defined: ReadonlyArray<BuiltPlugin> = [],
): PluginRoster =>
  offered === null ? NO_ROSTER : ((
    names: ReadonlyMap<string, ReadonlyArray<string>>,
  ) => ({
    built: [...offered.built.map((name) => {
      const report = offered.report().get(name) ?? { state: "off" as const }
      const said = stateOf(offered, name, report)
      const live = said.state === "running"
      const wake = live ? wakes.get(name) : undefined
      const carrying = live ? carriedBy(name, offered.built, names, offers) : []
      const config = offered.configs().get(name)
      return {
        name,
        running: live,
        ...(offered?.browserOnly?.includes(name) ? { browserOnly: true } : {}),
        state: said.state,
        ...(said.fault === undefined ? {} : { fault: said.fault }),
        ...(said.missing === undefined ? {} : { missing: said.missing }),
        ...(carrying.length === 0 ? {} : { carrying }),
        ...(wake === undefined ? {} : {
          wake: {
            subject: wake.subject,
            from: wake.from,
            waiting: wake.waiting,
            kinds: wake.kinds,
          },
        }),
        ...(config === undefined ? {} : { config }),
      }
    }), ...defined],
    pin: offered.pin,
    pinned: offered.pin.kind === "exact" ? offered.pin.names : null,
  }))(offered.names())
const carriedBy = (
  name: string,
  built: ReadonlyArray<string>,
  names: ReadonlyMap<string, ReadonlyArray<string>>,
  offers: ReadonlyMap<string, string>,
): ReadonlyArray<string> => {
  const held = new Set(
    [...offers].flatMap(([door, by]) => by === name ? [door] : []),
  )
  if (held.size === 0) return []
  return built.filter((row) =>
    row !== name && (names.get(row) ?? []).some((door) => held.has(door))
  )
}
const whoTurnedItOff = (
  offered: NonNullable<Wiring["plugins"]>,
  name: string,
): PluginState => {
  if (offered.switched().has(name)) return "switched"
  return offered.pin.kind === "exact" ? "off" : "optIn"
}
const stateOf = (
  offered: NonNullable<Wiring["plugins"]>,
  name: string,
  report: RowReport,
): {
  readonly state: PluginState
  readonly fault?: string
  readonly missing?: ReadonlyArray<string>
} => {
  switch (report.state) {
    case "failed":
      return report.fault === undefined
        ? { state: "failed" }
        : { state: "failed", fault: report.fault }
    case "waiting":
      return report.missing === undefined || report.missing.length === 0
        ? { state: "waiting" }
        : { state: "waiting", missing: report.missing }
    case "off":
      return { state: whoTurnedItOff(offered, name) }
    case "running":
      return { state: "running" }
  }
}
const impl =
  <I, A, E>(answer: (input: I) => Effect.Effect<A, E>) =>
  ({ input }: { input: I }): Effect.Effect<A, E> => answer(input)
export const writerAt = (bound: Pick<Bound, "handlers" | "writes">, _ops: unknown, caller: { readonly writer: string; readonly fence?: unknown }): SurfaceHandlers => authorityAt(bound, caller)
export const bind = (wiring: Wiring) => Effect.gen(function*() {
    const runtimeScope = yield* Effect.scope
    const say = yield* emitter
    let pluginsCell: { set: (value: PluginRoster) => void } | null = null
    const republishPlugins = () => pluginsCell?.set(roster())
    const offered = wiring.plugins
    const plugins = offered?.plugins ?? null
    const siblings = (): ReadonlyArray<Registered> => plugins?.composed() ?? []
    const rings = (): ReadonlyMap<string, Wake> => plugins?.declared() ?? new Map()
    const roster = (): PluginRoster =>
      rosterOf(
        offered,
        rings(),
        plugins?.offers() ?? new Map(),
        (offered?.catalogs?.() ?? []).flatMap(catalog => catalog.rows(offered?.report() ?? new Map())) as ReadonlyArray<BuiltPlugin>,
      )
    /**
     * THE SUPPRESSION WRAPPER, DECLARED BEFORE THERE IS ANYTHING TO WRAP.
     *
     * `plugins.set` below closes over this BINDING, not over the identity
     * function it starts as, and that is the whole reason it is a `let` seeded
     * with a pass-through rather than a `const` written once. The real wrapper
     * needs `moving`, `pendingStatus` and `refreshPlugins` — all of which need
     * `recompose`, which needs the composed runtime, which needs `deps`, which
     * is what this file is in the middle of building. Spelling the procedure
     * after `composeCapabilities` instead would mean building the deps record
     * in two passes and handing kolu a half-populated one.
     *
     * THE PROCEDURE MUST SEE THE FINAL ONE OR THE SWITCH LOSES ITS POINT: the
     * identity function runs the flip and publishes nothing, so a press would
     * return `{}` with the roster still describing the bundle as it was before
     * it, and the panel would draw the row it just moved as it was until
     * something unrelated republished. The seed is never actually spent — the
     * handlers `composeCapabilities` composes below are reachable only through
     * the generation `bind` hands back, and the assignment lands well before
     * this function returns — so the pass-through is a type obligation rather
     * than a behaviour, and it is written as one line for that reason.
     */
    let settling: (run: Effect.Effect<boolean>) => Effect.Effect<boolean> = (run) => run
    // Management owns only roster state and switches. A switch outlives the
    // connection that requested it: disabling a transport may close that very
    // connection, but must not interrupt its accepted lifecycle transition.
    const deps: ImplementSurfaceDeps<typeof hostSurface.spec> = {
      cells: { plugins: { store: inMemoryStore<PluginRoster>(roster()), connect: cell => Effect.sync(() => { pluginsCell = cell }) } },
      procedures: {
plugins: {
          set: ({ input }) =>
            Effect.gen(function*() {
              for (const catalog of offered?.catalogs?.() ?? []) {
                if (yield* settling(catalog.set(input.name, input.enabled))) return {}
              }
              if (offered !== null && (yield* settling(offered.set(input.name, input.enabled)))) {
                return {}
              }
              return yield* Effect.fail(
                new NotFoundFailure({
                  reason: `this build has no plugin named "${input.name}"`,
                  named: input.name,
                }),
              )
            }).pipe(
              // FORKED INTO THE SERVE'S SCOPE, JOINED FROM THE REQUEST'S. The
              // scope is the one thing here that must NOT be the caller's: an
              // RPC handler runs on a fiber the connection owns, and a flip that
              // turns a transport row off closes that very connection — so a
              // handler left on it is interrupted partway through unwinding the
              // rows the flip revoked, and what survives is a bundle nobody
              // asked for and no press can undo. `runtimeScope` is `bind`'s own,
              // which is `serve`'s, so the transition finishes or the whole
              // process is going down. It is the same law the paragraph above
              // `deps` states, spelled here where it is bought.
              Effect.forkIn(runtimeScope),
              // ...and the caller still JOINS, because the answer is a browser's
              // and not a background job's: `{}` means the flip happened, and
              // `NotFoundFailure` means this build has no such plugin, which is
              // a refusal a person typed their way into and has to see. The join
              // also puts the fork's own defects back on the request that asked
              // for them rather than into an unread fiber. A caller whose socket
              // goes is interrupted at the join; the fork it is waiting on is
              // not, which is exactly the split this pair exists to make.
              Effect.flatMap(Fiber.join),
            ),
        },
who: {
          get: (() =>
            CurrentWho.use((who) => Effect.succeed(who))) as unknown as () => Effect.Effect<
              Who | null
            >,
        },
app: {
          get: () =>
            Effect.succeed({
              hostname: wiring.hostname,
              startedAt: wiring.startedAt,
            }),
        }
      },
    }
    const runtime = composeCapabilities(hostSurface, deps, hostFaces)
    const mounted = new Map<string, MountedSurface<SurfaceSpec>>()
    const standing = new Map<string, Registered>()
    /**
     * WHO WANTS TO BE TOLD THE COMPOSED ROSTER MOVED.
     *
     * The browser learns it from the `plugins` cell and redials; a face that is
     * not a wire client has no cell to watch, and `olai-plugin-mcp` is one —
     * its adapter holds a resolved table of resources and has to be handed a new
     * roster in place (`reroster`) rather than restarted. Rung at the TAIL of
     * `recompose`, after every mount, every drop and the gate, so a watcher
     * reading `rows` sees the generation that has just been published rather
     * than the one being assembled.
     */
    const watchers = new Set<() => void>()
    /**
     * THE SIBLING REGISTRY, MADE INTO THE COMPOSED ROSTER — one movement of the
     * table, synchronous, and ARRIVALS ARE COMPOSED BEFORE DEPARTURES ARE
     * DROPPED.
     *
     * THE ORDER USED TO DECIDE WHAT A COLLISION MEANT, and that reason is gone
     * with the bare tags (#546). While six rows shared `surface/edit/apply`,
     * `./composition.ts` judged each new claim against the generation as it
     * STOOD — every current owner had to declare dispatch, the fields had to
     * agree, the cases had to be disjoint — so composing first held every
     * arrival to the FULL roster and made "two capabilities in this build claim
     * one verb" answer the same way on every recompose. Dropping first would
     * have made that defect intermittent: a pass that happened to remove the
     * incumbent would accept the claim, one that did not would throw, and which
     * a person got would depend on which rows their press moved together.
     *
     * Every member now answers under its owner's name alone, so there is no
     * cross-row claim left for an order to arbitrate — two mounts can only
     * collide on the mount NAME, which kolu refuses on its own and which the
     * `mounted.has` / `leaving` pair below is what handles.
     *
     * WHAT THE ORDER STILL BUYS is the survivor. A row that did not move is
     * touched by neither loop, so the arrivals pass only ever adds:
     * `mounted.has(key)` is what keeps it on the same handler values, stores,
     * channels and running sources it had. Recomposing the whole table is
     * `./composition.ts`'s discipline; not recomposing a row that did not move
     * is this one's.
     */
    const recompose = (): void => {
      const wanted = new Map(siblings().map((one) => [one.name, one] as const))
      // Preserve surviving mounts by identity. A returning owner waits for its
      // previous generation to finish draining, so two generations cannot own
      // one capability while unrelated siblings remain continuously available.
      //
      // DEFERRED AS A CONTINUATION rather than awaited: kolu's own `mount`
      // refuses a key whose previous generation has not finished coming down,
      // and it is right to — a returning owner that re-mounted over a draining
      // one would get its predecessor's channel names and could be handed a
      // value that exists in no store on the bundle. So the drop is remembered
      // per key and the arrival is hung off its settle, which keeps this pass
      // synchronous and blocks nothing.
      for (const [key, one] of wanted) {
        if (mounted.has(key)) continue
        const settling = leaving.get(key)
        if (settling !== undefined) {
          void settling.then(() => {
            if (!mounted.has(key)) recompose()
          })
          continue
        }
        const mount = runtime.mount(
          key,
          one.surface as never,
          one.deps as never,
          { writes: one.writes, faces: one.faces as never },
        )
        mounted.set(key, mount)
        // WHAT WAS REGISTERED, held beside what was MOUNTED. The two tables are
        // not the same reading — `leaving` above is what pulls them apart — and
        // the agent's tool list has to come from the second: a row registered
        // and not yet composed serves no tag, so a verb of its offered now would
        // be a tool that refuses.
        standing.set(key, one)
        one.published?.(mount.ctx)
      }
      // Drop revokes dispatch immediately; asynchronous resource cleanup can
      // continue afterward. Remove the public entry before waiting, otherwise
      // a stale connection could keep starting work during the drain.
      for (const [key, mount] of [...mounted]) {
        if (wanted.has(key)) continue
        mounted.delete(key)
        standing.delete(key)
        const settling = mount.drop().catch((thrown: unknown) => {
          say(
            Effect.logWarning(
              `plugins: "${key}" left the wire and its teardown failed — ${String(thrown)}`,
            ),
          )
        })
        leaving.set(key, settling)
        void settling.then(() => {
          if (leaving.get(key) === settling) leaving.delete(key)
        })
      }
      // THE GATE IS READ OFF WHAT IS SERVED, at the TAIL, after every mount and
      // every drop in this pass. Two things ride on both halves.
      //
      // Off what is SERVED, and not off `siblings()`: the registry and the
      // composed group are not the same table, and `leaving` above is what pulls
      // them apart — a row switched off and on again before its previous
      // generation has drained is registered and not yet mounted. A gate derived
      // from the registry would then name tags the group does not carry, and
      // kolu's `restrictHandlers` compares the two as a set EQUALITY at every
      // accept: not a member refused, a socket terminated, for every tab of
      // every tenant of this wire until the deferred mount landed.
      //
      // At the TAIL, so there is one gate per generation rather than one per
      // mount — and one VALUE, which is what lets a reader say the gate it holds
      // belongs to the group it holds. `./runtime.test.ts`'s "the browser gate
      // names exactly what the group serves, and is one value per generation"
      // asserts both, through the same call the transport makes.
      gates = gatesFor()
      // NOT WHILE A FLIP IS IN FLIGHT — see the paragraph over `settling`, which
      // is what sets `moving` and what republishes once the bundle has stopped.
      if (!moving) republishPlugins()
      // ...AND THE FACES THAT ARE NOT WIRE CLIENTS, last of all. A tab hears
      // this through the `plugins` cell above and redials; a projecting face
      // has no cell to watch and holds a table it must be handed a new roster
      // for. Rung after the gate so a watcher reading `rows` sees the
      // generation that has just been published.
      for (const run of watchers) run()
    }
    const refreshPlugins = Effect.gen(function*() {
      pendingStatus = false
      yield* offered?.reread ?? Effect.void
      recompose()
    })
    /**
     * Suppress intermediate roster publication during a switch. The report
     * must describe the settled graph, not a mixture of old rows and new
     * service availability; dispatch revocation itself remains synchronous.
     *
     * WHICH FRAME THE BROWSER WOULD OTHERWISE DRAW is what makes that worth a
     * flag. A roster change is a REDIAL — the `plugins` cell moving builds a new
     * wire and rebuilds the page's whole tree under it (`@olai/surface`'s
     * `core.ts` argues the cell, and its `equals` is what keeps a republish that
     * says nothing new from costing that). Turning the chat row off revokes the
     * four doors it stands behind, which unloads every fiber that named one, and
     * each of those is a whole turn later. Publish mid-flip and the tab redials
     * onto a wire that is still coming apart, drawing the engines `running` for
     * one frame after the row that carries them has gone — and it pays a full
     * tree rebuild for that frame and another for the real one behind it.
     *
     * `moving` is set across the whole transition rather than per row for a
     * second reason of the same kind: a report taken while the bundle is moving
     * reads each row at a different instant, so one tenant says `waiting` on one
     * door while its neighbour says `waiting` on two, about a fiber that names
     * both. `ensuring` clears it on every exit, an interrupt included, because a
     * press that was interrupted must not leave the roster frozen for the life
     * of the process.
     *
     * `pendingStatus` is the other half: a registration that landed WHILE the
     * flip was in flight was answered with silence by the stream loop below, so
     * the settle republishes on its behalf even when the flip itself changed
     * nothing. Without it, turning a row off and a plugin's own registration
     * arriving in the same breath leaves the panel a frame behind with nothing
     * scheduled to fix it.
     */
    settling = (run) =>
      Effect.gen(function*() {
        const changed = yield* Effect.ensuring(
          Effect.andThen(Effect.sync(() => { moving = true }), run),
          Effect.sync(() => { moving = false }),
        )
        if (changed || pendingStatus) yield* refreshPlugins
        return changed
      })
    // THE STATE `recompose`, `refreshPlugins` AND `settling` READ, declared
    // below all three of them. `gates` seeds off the generation
    // `composeCapabilities` published for the bare host, so `bind` has a gate to
    // answer with even on a serve that composes no sibling at all.
    //
    // `let` and `const` are in the temporal dead zone until this line — not
    // hoisted-as-`undefined` the way a `var` would be — so the arrangement is
    // safe for exactly one reason: none of the three is CALLED until the
    // statement below, which is after all five. Moving that first `recompose()`
    // above here is not a type error, it is a `ReferenceError` on the boot path
    // with the bundle already mounted.
    let gates = runtime.faces as { browser: import("@kolu/surface/expose").FaceExposure, agent: import("@kolu/surface/expose").FaceExposure }
    const gatesFor = (): typeof gates => runtime.faces as typeof gates
    const leaving = new Map<string, Promise<void>>()
    let moving = false
    let pendingStatus = false
    // COMPOSE ONCE, IN LINE, BEFORE THE STREAM LOOP EXISTS. `bind` returns a
    // generation, and `./serve.ts` hands that generation to the transport door
    // on the next statements — so waiting for the forked loop's first tick to
    // compose would mean publishing a wire carrying the bare host surface and no
    // plugin's tags at all, for however long the fork took to be scheduled.
    //
    // WHAT COVERS A REGISTRATION LANDING BETWEEN HERE AND THE SWAP BELOW is the
    // merged stream's first element, not luck. `offered.onChange.run` is still
    // the box's no-op until `notifyChange` is installed, so a registration in
    // that window rings nothing — but `hostChanges` offers one `undefined` on
    // SUBSCRIBE (`@olai/effect-cordis`'s `host.ts`), so the very first thing the
    // forked loop does is `refreshPlugins`, which re-reads the registry and
    // recomposes whatever arrived. The window closes itself rather than being
    // reasoned about, which is why the swap is allowed to be two statements
    // later than the compose.
    recompose()
    if (offered !== null) {
      // Owner-local registration changes can precede the loader's report.
      // Recompose immediately for revocation, then refresh reports on the
      // scoped queue. A notification must not publish yesterday's row state.
      //
      // THE QUEUE AND ITS FINALIZER ARE REGISTERED BEFORE THE SWAP AND THE
      // FINALIZER THAT UNDOES IT, and since a scope runs finalizers in REVERSE
      // registration order that puts the teardown in the only order that works:
      // the stream loop is interrupted first, then `onChange.run` is put back,
      // and only then is the queue shut. Shut the queue first and every dispose
      // in the drain still runs `notifyChange` — which recomposes against a
      // runtime that is closing and offers into a queue nobody will ever read —
      // for as long as the rows take to unwind, which is exactly the window in
      // which registrations arrive fastest.
      //
      // And the restore is registered HERE rather than earlier for the other
      // half of the same reason: `./serve.ts` registers `plugins.close` after
      // `bind` returns, so it drains BEFORE this restore runs and every
      // departing row is genuinely dropped from the composed generation on its
      // way out rather than left mounted over a closed host.
      const statusChanges = yield* Queue.unbounded<void>()
      yield* Effect.addFinalizer(() => Queue.shutdown(statusChanges))
      const previousChange = offered.onChange.run
      const notifyChange = () => {
        recompose()
        Queue.offerUnsafe(statusChanges, undefined)
      }
      offered.onChange.run = notifyChange
      yield* Effect.addFinalizer(() => Effect.sync(() => {
        if (offered.onChange.run === notifyChange) offered.onChange.run = previousChange
      }))
      yield* Stream.runForEach(Stream.merge(offered.plugins.changes, Stream.fromQueue(statusChanges)), () =>
        Effect.suspend(() => {
          if (!moving) return refreshPlugins
          pendingStatus = true
          return Effect.void
        }),
      ).pipe(Effect.forkScoped)
    }
    return {
      bound: {
        get writes() { return runtime.writes },
        get rows() { return [...standing.values()] },
        rosterMoved: (run: () => void) => {
          watchers.add(run)
          return () => watchers.delete(run)
        },
        get group() {
          return runtime.group
        },
        get handlers() {
          return runtime.handlers
        },
        done: runtime.done,
        close: runtime.close,
      },
      get faces() {
        return gates
      },
    }
  })

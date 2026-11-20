import { configurationUnavailable } from "@olai/plugin-api/configuration"
import { NotFoundFailure, UsageFailure, type OpFailure } from "@olai/format"
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
export type Bound = Omit<SurfaceRuntime<typeof hostSurface.spec>, "ctx"> & { readonly writes: ReadonlyArray<string>; readonly rows: ReadonlyArray<Registered>; readonly agentRows: TransportSurface["agentRows"]; readonly rosterMoved: (run: () => void) => () => void }
import type { Configuration, PolicyRow, EnvironmentReading } from "@olai/plugin-api/configuration"
import type { TransportSurface } from "@olai/plugin-api/transport"
import type { FaceExposure } from "@kolu/surface/expose"

export interface PluginRuntime {
  readonly plugins: Plugins
  readonly onChange: { run: () => void }
  readonly built: ReadonlyArray<string>
  readonly instance?: () => NonNullable<PluginRoster["instance"]>
  readonly browserOnly?: ReadonlyArray<string>
  readonly offByDefault?: ReadonlyArray<string>
  readonly report: () => ReadonlyMap<string, RowReport>
  readonly names: () => ReadonlyMap<string, ReadonlyArray<string>>
  readonly configuration?: () => Configuration | undefined
  readonly environment?: ReadonlyMap<string, ReadonlyArray<EnvironmentReading>>
  readonly configurationDefaults?: ReadonlyMap<string, PolicyRow>
  readonly configs: () => ReadonlyMap<string, Readonly<Record<string, unknown>>>
  readonly persistent?: (id: string) => boolean
  readonly set: (id: string, enabled: boolean) => Effect.Effect<boolean, OpFailure>
  readonly configure?: (id: string, key: string, value: string | null, defined: () => Effect.Effect<boolean, OpFailure>) => Effect.Effect<boolean, OpFailure>
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
  generations: ReadonlyMap<string, number> = new Map(),
): PluginRoster =>
  offered === null ? NO_ROSTER : ((
    names: ReadonlyMap<string, ReadonlyArray<string>>,
    configuration: Configuration | undefined,
  ) => ({
    built: [...offered.built.map((name) => {
      const report = offered.report().get(name) ?? { state: "off" as const }
      const said = stateOf(offered, name, report)
      const live = said.state === "running"
      const wake = live ? wakes.get(name) : undefined
      const carrying = live ? carriedBy(name, offered.built, names, offers) : []
      const config = offered.configs().get(name)
      const reading = configuration?.rows.get(name)
      const policy = reading ?? offered.configurationDefaults?.get(name)
      return {
        name,
        ...(offered.environment?.get(name)?.length ? { environment: offered.environment.get(name)! } : {}),
        switchPersistence: offered.persistent?.(name) === true ? "file" as const : "session" as const,
        running: live,
        ...(live && generations.get(name) !== undefined ? { generation: generations.get(name)! } : {}),
        ...(offered?.browserOnly?.includes(name) ? { browserOnly: true } : {}),
        state: said.state,
        ...(said.fault === undefined ? {} : { fault: said.fault }),
        ...(said.missing === undefined ? {} : { missing: said.missing }),
        ...(carrying.length === 0 ? {} : { carrying }),
        ...(wake === undefined ? {} : {
          wake: {
            subject: wake.subject,
            waiting: wake.waiting,
          },
        }),
        ...(config === undefined ? {} : { config }),
        ...(policy === undefined ? {} : { configurationValues: policy.values }),
        ...(policy?.node === undefined ? {} : { configurationNode: policy.node }),
        ...(policy?.on === undefined ? {} : { desiredOn: policy.on }),

      }
    }), ...defined.map((row) => {
      const generation = generations.get(row.name)
      return row.running && generation !== undefined ? { ...row, generation } : row
    })],
    ...(configuration?.file === undefined ? {} : { configurationFile: configuration.file }),
    ...(configuration?.broken === undefined ? {} : { configurationError: configuration.broken }),
    configurationAvailable: configuration !== undefined,
    ...(offered.instance === undefined ? {} : { instance: offered.instance() }),
  }))(offered.names(), offered.configuration?.())
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
  if (offered.configuration?.()?.rows.get(name)?.on === false) return "off"
  if (offered.switched().has(name)) return "switched"
  return offered.offByDefault?.includes(name) ? "optIn" : "off"
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
export const writerAt = (bound: Pick<Bound, "handlers" | "writes">, _ops: unknown, caller: { readonly writer: string; readonly rule?: unknown }): SurfaceHandlers => authorityAt(bound, caller)
export const bind = (wiring: Wiring) => Effect.gen(function*() {
    const runtimeScope = yield* Effect.scope
    const say = yield* emitter
    let pluginsCell: { set: (value: PluginRoster) => void } | null = null
    const republishPlugins = () => pluginsCell?.set(roster())
    const generations = new Map<string, number>()
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
        generations,
      )
    const leaving = new Map<string, Promise<void>>()
    let moving = false
    let pendingStatus = false
    const deps: ImplementSurfaceDeps<typeof hostSurface.spec> = {
      cells: { plugins: { store: inMemoryStore<PluginRoster>(roster()), connect: cell => Effect.sync(() => { pluginsCell = cell }) } },
      procedures: {
plugins: {
          configure: ({ input }) => Effect.gen(function*() {
            if (offered?.configure === undefined) return yield* Effect.fail(new UsageFailure({ reason: configurationUnavailable }))
            const defined = () => Effect.gen(function*() {
              for (const catalog of offered.catalogs?.() ?? []) if (yield* catalog.configure(input.name, input.key, input.value)) return true
              return false
            })
            if (yield* settling(offered.configure(input.name, input.key, input.value, defined))) return {}
            return yield* Effect.fail(new NotFoundFailure({ reason: `this build has no plugin named "${input.name}"`, named: input.name }))
          }).pipe(Effect.forkIn(runtimeScope), Effect.flatMap(Fiber.join)),
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
              Effect.forkIn(runtimeScope),
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
    const watchers = new Set<() => void>()
    const composeArrivals = (wanted: ReadonlyMap<string, Registered>): void => {
      for (const [key, one] of wanted) {
        if (mounted.has(key)) continue
        const draining = leaving.get(key)
        if (draining !== undefined) {
          void draining.then(() => {
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
        const generation = (generations.get(key) ?? 0) + 1
        generations.set(key, generation)
        say(Effect.logDebug(`plugins: mounted "${key}"`).pipe(
          Effect.annotateLogs({ generation }),
        ))
        standing.set(key, one)
        one.published?.(mount.ctx)
      }
    }
    const drainDepartures = (wanted: ReadonlyMap<string, Registered>): void => {
      for (const [key, mount] of [...mounted]) {
        if (wanted.has(key)) continue
        mounted.delete(key)
        standing.delete(key)
        say(Effect.logDebug(`plugins: dropped "${key}"`).pipe(
          Effect.annotateLogs({ generation: generations.get(key) ?? 0 }),
        ))
        const draining = mount.drop().catch((thrown: unknown) => {
          say(
            Effect.logWarning(
              `plugins: "${key}" left the wire and its teardown failed — ${String(thrown)}`,
            ),
          )
        })
        leaving.set(key, draining)
        void draining.then(() => {
          if (leaving.get(key) === draining) leaving.delete(key)
        })
      }
    }
    const recompose = (): void => {
      const wanted = new Map(siblings().map((one) => [one.name, one] as const))
      composeArrivals(wanted)
      drainDepartures(wanted)
      if (!moving) republishPlugins()
      for (const run of watchers) run()
    }
    const refreshPlugins = Effect.gen(function*() {
      pendingStatus = false
      yield* offered?.reread ?? Effect.void
      recompose()
    })
    function settling(run: Effect.Effect<boolean, OpFailure>): Effect.Effect<boolean, OpFailure> {
      return Effect.gen(function*() {
        const changed = yield* Effect.ensuring(
          Effect.andThen(Effect.sync(() => { moving = true }), run),
          Effect.sync(() => { moving = false }),
        )
        if (changed || pendingStatus) yield* refreshPlugins
        return changed
      })
    }
    recompose()
    if (offered !== null) {
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
        agentRows: () => [...standing.values()].map((one) => ({
          name: one.name,
          surface: one.surface,
          resources: one.resources ?? {},
          tools: one.tools ?? [],
          charter: one.charter,
        })),
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
        return runtime.faces as { browser: FaceExposure, agent: FaceExposure }
      },
    }
  })

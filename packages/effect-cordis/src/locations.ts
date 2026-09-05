/**
 * Locations are scoped capabilities, not a visibility filter. Only root is
 * supplied by the renderer. An entry offers its child locations from its own
 * activation; withdrawing that entry revokes the offers, drains dependent
 * activations, and only then closes its resources. Cordis owns that ordering
 * through the same bridge used by ordinary plugin services.
 *
 * A registration lives in the caller's scope, but its integration runs in a
 * separate activation. Waiting for a shell therefore leaves independent plugin
 * work alone. Returning owners start fresh integrations; unrelated entries keep
 * their identity. Put listeners and subscriptions in `activate`, not beside the
 * registration, when they require that location to exist.
 *
 * Child contracts are declared with the registration, so conflicts and cycles
 * can be rejected even before providers arrive. Reserving a name does not make
 * it available: only the particular active entry which owns it can do that.
 * Cardinality includes waiting entries, preventing ambiguous later activation.
 */
import { Cause, Effect, Exit, Scope, Stream, Semaphore } from "effect"
import { hostChanges, mountPlugin, openHost, provide, settled, type Mounted, type RowReport } from "./host.ts"
import { offer } from "./lifecycle.ts"
import { definePlugin } from "./plugin.ts"
import { registry, roster } from "./registry.ts"
import { serviceTag } from "./service.ts"

export interface Location<T> {
  readonly name: string
  readonly cardinality: "one" | "many"
  readonly keyedBy?: "owner" | "key"
  readonly _value?: (_: T) => T
}
type Contract = Pick<Location<never>, "name" | "cardinality" | "keyedBy">
const validName = (name: string): boolean => /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/.test(name)

export const location = <T>(
  name: string,
  cardinality: Location<T>["cardinality"] = "many",
  keyedBy?: Location<T>["keyedBy"],
): Location<T> => {
  if (!validName(name)) throw new Error(`Invalid location name: "${name}"`)
  return Object.freeze({ name, cardinality, ...(keyedBy === undefined ? {} : { keyedBy }) })
}
export interface Contribution<T> {
  readonly owner: string
  readonly value: T
  readonly key?: string
}
export interface LocationOwner {
  /** Register one independently activated integration. Child locations belong
   * to this entry, including when its registration ends before its plugin does.
   * `activate` acquires location-dependent resources in a fresh scoped lifetime.
   * It may fail or be interrupted; children are offered only after it succeeds. */
  readonly contribute: <T>(slot: Location<T>, value: T, options?: {
    /** Optional unique key within this location, reserved even while waiting. */
    readonly key?: string
    readonly children?: ReadonlyArray<Contract>
    readonly activate?: Effect.Effect<void, never, Scope.Scope>
  }) => Effect.Effect<void, never, Scope.Scope>
}
export interface LocationReport {
  readonly name: string
  readonly owner: string
  readonly state: "active" | "waiting" | "failed" | "off"
  readonly waitingFor?: string
  readonly fault?: string
}
export interface Locations {
  readonly forOwner: (owner: string) => LocationOwner
  readonly read: <T>(slot: Location<T>) => ReadonlyArray<Contribution<T>>
  readonly inspect: () => ReadonlyArray<LocationReport>
  /** Join current activations, including asynchronous initialization/cleanup. */
  readonly settled: Effect.Effect<void>
  /** Retry failed integrations without restarting independent plugin work. */
  readonly retry: Effect.Effect<void>
}
interface Declaration {
  readonly owner: string
  readonly parent: string
  readonly cardinality: Contract["cardinality"]
  readonly keyedBy?: Contract["keyedBy"]
}
interface Registration {
  readonly id: string
  readonly owner: string
  readonly slot: Contract
  readonly key?: string
  mounted?: Mounted
  report: RowReport
  cleanupFault?: string
  retry?: Effect.Effect<void>
}

/** The renderer owns the host and closes it with its own activation. No global
 * scheduler, root, declarations, or integration scopes survive that close. */
export const locations = (config: {
  readonly changed?: () => void
  readonly reading?: () => void
} = {}): Effect.Effect<Locations, never, Scope.Scope> => Effect.gen(function*() {
  const host = yield* openHost
  const key = (name: string) => serviceTag<true>(`location:${name}`)
  yield* provide(host, key("root"), () => true as const)
  const declarations = registry<string, Declaration>()
  const registrations = roster<Registration>()
  const entries = roster<{ readonly slot: string; readonly contribution: Contribution<unknown> }>(config.changed)
  let serial = 0

  const refresh = Effect.gen(function*() {
    let changed = false
    for (const registration of registrations.read()) {
      if (!registration.mounted) continue
      const report: RowReport = registration.cleanupFault === undefined
        ? yield* registration.mounted.report
        : { state: "failed", fault: registration.cleanupFault }
      if (JSON.stringify(report) !== JSON.stringify(registration.report)) {
        registration.report = report
        changed = true
      }
    }
    // A rendering observer can refuse an entry; entries.hold rolls that
    // acquisition back. Reporting that failure must remain readable even if
    // the same observer also throws while being told about the report.
    if (changed) yield* Effect.sync(() => config.changed?.()).pipe(Effect.catchDefect(() => Effect.void))
  })
  yield* Effect.forkScoped(Stream.runForEach(hostChanges(host), () => refresh))
  const joined = Effect.gen(function*() {
    yield* settled(host, registrations.read().map((entry) => entry.id))
    yield* refresh
  })
  const validate = (slot: Contract, owner: string): void => {
    if (!validName(slot.name) || (slot.cardinality !== "one" && slot.cardinality !== "many")) {
      throw new Error(`Locations: "${owner}" supplied an invalid location contract for "${slot.name}"`)
    }
    const declaration = declarations.read().get(slot.name)
    const prior = registrations.read().find((entry) => entry.slot.name === slot.name)
    if (slot.name === "root" && slot.keyedBy !== undefined) {
      throw new Error(`Locations: "${owner}" cannot change the host root's key rules`)
    }
    const rules = declaration ?? prior?.slot
    if (rules && rules.keyedBy !== slot.keyedBy) {
      throw new Error(`Locations: "${owner}" disagrees with "${declaration?.owner ?? prior?.owner}" about keys of "${slot.name}"`)
    }
    if (slot.keyedBy !== undefined && !["owner", "key"].includes(slot.keyedBy)) {
      throw new Error(`Locations: "${owner}" supplied invalid key rules for "${slot.name}"`)
    }
    const cardinality = slot.name === "root" ? "one" : declaration?.cardinality ?? prior?.slot.cardinality
    if (cardinality !== undefined && cardinality !== slot.cardinality) {
      throw new Error(`Locations: "${owner}" disagrees with "${declaration?.owner ?? prior?.owner ?? "host"}" about cardinality of "${slot.name}"`)
    }
  }
  return {
    forOwner: (owner) => ({
      contribute: (slot, value, options = {}) => Effect.gen(function*() {
        validate(slot, owner)
        const prior = registrations.read().find((entry) => entry.slot.name === slot.name)
        if (slot.cardinality === "one" && prior) {
          return yield* Effect.die(new Error(`Locations: "${owner}" and "${prior.owner}" both occupy single location "${slot.name}"`))
        }
        const entryKey = slot.keyedBy === "owner" ? owner : options.key
        if (slot.keyedBy === "key" && entryKey === undefined) {
          return yield* Effect.die(new Error(`Locations: "${owner}" must supply a key for "${slot.name}"`))
        }
        if (slot.keyedBy === "owner" && options.key !== undefined && options.key !== owner) {
          return yield* Effect.die(new Error(`Locations: "${owner}" cannot choose another owner's key in "${slot.name}"`))
        }
        if (entryKey !== undefined) {
          const held = registrations.read().find((entry) => entry.slot.name === slot.name && entry.key === entryKey)
          if (held) return yield* Effect.die(new Error(`Locations: "${owner}" and "${held.owner}" both occupy "${slot.name}" under "${entryKey}"`))
        }
        // An acquisition scope rolls back all reservations if any child is
        // invalid. Its finalizer drains the activation before freeing names.
        const scope = yield* Effect.acquireRelease(Scope.make(), (scope, exit) => Scope.close(scope, exit))
        yield* Scope.provide(Effect.gen(function*() {
          for (const child of options.children ?? []) {
            validate(child, owner)
            if (child.name === "root") return yield* Effect.die(new Error(`Locations: "${owner}" cannot redeclare host location "root"`))
            let cursor = slot.name
            const path = [`${child.name} (${owner})`]
            while (true) {
              const declaration = declarations.read().get(cursor)
              path.push(`${cursor} (${declaration?.owner ?? owner})`)
              if (cursor === child.name) return yield* Effect.die(new Error(`Locations: ownership cycle ${path.join(" -> ")}`))
              if (!declaration) break
              cursor = declaration.parent
            }
            yield* declarations.claim(child.name, { owner, parent: slot.name, cardinality: child.cardinality, keyedBy: child.keyedBy },
              (held) => `Locations: "${owner}" and "${held.owner}" both declare "${child.name}"`)
          }
          const registration: Registration = { id: `entry-${++serial}`, owner, slot, key: entryKey, report: { state: "waiting" } }
          yield* registrations.hold(registration)
          const start = mountPlugin(host, definePlugin({
            name: registration.id,
            needs: [key(slot.name)],
            apply: Effect.gen(function*() {
              delete registration.cleanupFault
              const integration = yield* Effect.acquireRelease(Scope.make(), (scope, exit) =>
                Scope.close(scope, exit).pipe(Effect.onError((cause) => Effect.sync(() => {
                  registration.cleanupFault = Cause.pretty(cause)
                }))),
              )
              yield* Scope.provide(options.activate ?? Effect.void, integration)
              yield* entries.hold({ slot: slot.name, contribution: { owner, value, ...(entryKey === undefined ? {} : { key: entryKey }) } })
              for (const child of options.children ?? []) yield* offer(key(child.name), () => true as const)
            }),
          }), { wait: false })
          const lock = Semaphore.makeUnsafe(1)
          let closed = false
          registration.mounted = yield* Effect.acquireRelease(start, (initial) => lock.withPermits(1)(Effect.gen(function*() {
            closed = true
            yield* (registration.mounted ?? initial).dispose
          })))
          registration.retry = lock.withPermits(1)(Effect.gen(function*() {
            if (closed || !registration.mounted) return
            const report = yield* registration.mounted.report
            if (report.state !== "failed" && registration.cleanupFault === undefined) return
            yield* registration.mounted.dispose
            delete registration.cleanupFault
            registration.mounted = yield* start
          }).pipe(Effect.uninterruptible))
          yield* refresh
        }), scope).pipe(Effect.onError((cause) => Scope.close(scope, Exit.failCause(cause))))
      }),
    }),
    read: <T>(slot: Location<T>): ReadonlyArray<Contribution<T>> => {
      config.reading?.()
      validate(slot, "reader")
      return entries.read().filter((entry) => entry.slot === slot.name).map((entry) => entry.contribution as Contribution<T>)
    },
    inspect: () => {
      config.reading?.()
      return registrations.read().map(({ slot, owner, report }) => ({
        name: slot.name,
        owner,
        state: report.state === "running" ? "active" : report.state,
        ...(report.state === "waiting" ? { waitingFor: report.missing?.map((name) => name.replace(/^location:/, "")).join(", ") || slot.name } : {}),
        ...(report.state === "failed" ? { fault: report.fault } : {}),
      }))
    },
    settled: joined,
    retry: Effect.gen(function*() {
      for (const entry of registrations.read()) yield* entry.retry ?? Effect.void
      yield* joined
    }),
  }
})

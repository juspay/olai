/** Narrow host loading: callers own the children they load. This mechanism
 * knows plugin modules and reports, not source files, approval or compilation. */
import { serviceTag, provide, mountPlugin, rowReport, type Plugin, type Mounted, type Host, type RowReport } from "@olai/effect-cordis"
import { Effect, Exit, Scope } from "effect"

export interface Catalog {
  readonly names: () => ReadonlyArray<string>
  readonly rows: (reports: ReadonlyMap<string, RowReport>) => ReadonlyArray<unknown>
  readonly set: (name: string, enabled: boolean) => Effect.Effect<boolean>
}
export interface OwnedLoader {
  readonly mount: (plugin: Plugin) => Effect.Effect<Mounted>
}
export interface HostLoading {
  readonly changed: () => void
  readonly reports: Effect.Effect<ReadonlyMap<string, RowReport>>
  readonly services: () => ReadonlyArray<string>
  readonly browserServices: () => ReadonlyArray<string>
  readonly reserved: ReadonlyArray<string>
  readonly acquire: Effect.Effect<OwnedLoader, never, Scope.Scope>
  readonly describe: (catalog: Catalog) => Effect.Effect<void, never, Scope.Scope>
}
export const HostLoading = serviceTag<HostLoading>("host-loading")
export const openLoading = (host: Host, reserved: ReadonlyArray<string>, changed: () => void, metadata: { services: () => ReadonlyArray<string>, browserServices: () => ReadonlyArray<string> }) => Effect.gen(function*() {
  const catalogs = new Map<string, Catalog>()
  yield* provide(host, HostLoading, owner => ({
    reserved, changed, ...metadata,
    reports: Effect.suspend(() => rowReport(host, [...reserved, ...[...catalogs.values()].flatMap(one => one.names())])),
    acquire: Effect.gen(function*() {
      const parent = yield* Effect.scope
      let active = true
      yield* Effect.addFinalizer(() => Effect.sync(() => { active = false }))
      return { mount: (plugin: Plugin) => Effect.gen(function*() {
        if (!active) return yield* Effect.die(new Error(`Plugin loader owned by "${owner}" has closed`))
        if (reserved.includes(plugin.name)) return yield* Effect.die(new Error(`Plugin "${plugin.name}" is reserved by the bundle`))
        const scope = yield* Scope.fork(parent)
        const mounted = yield* Effect.acquireRelease(mountPlugin(host, plugin, { wait: false }), mounted => mounted.dispose).pipe(Scope.provide(scope))
        return { ...mounted, dispose: Scope.close(scope, Exit.void) }
      }) }
    }),
    describe: catalog => Effect.acquireRelease(Effect.sync(() => {
      if (catalogs.has(owner)) throw new Error(`Plugin "${owner}" already owns a catalog`)
      catalogs.set(owner, catalog)
      changed()
    }), () => Effect.sync(() => { catalogs.delete(owner); changed() })),
  }))
  return { catalogs: () => [...catalogs.values()], names: () => [...catalogs.values()].flatMap(one => one.names()) }
})

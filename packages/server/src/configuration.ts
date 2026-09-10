/** Serve-owned serialization of live policy publications and loader updates.
 * The provider only publishes. Losing it cancels the subscription, never a
 * patch already accepted by this worker, and never rolls row options back. */
import { ROWS } from "@olai/bundle"
import { BUNDLE_NAMES, configsOf, offered, patchBundleRow, patchBundleRows, profilePatch, serviceChanges } from "@olai/bundle/bundle"
import { BundleModules, ConfigurationSource, Env, Ops as WriteDoor } from "@olai/plugin-api/services"
import { CONFIGURATION_FILE, decodePolicy, environmentReadings, type Configuration, type PolicyRow } from "@olai/plugin-api/configuration"
import { UsageFailure, type OpFailure, type WriteRequest } from "@olai/format"
import type { Ops } from "@olai/ops"
import type { Plugin } from "@olai/plugin-api"
import { Deferred, Effect, Fiber, Queue, Semaphore, Stream, SubscriptionRef } from "effect"

export const followConfiguration = (host: Parameters<typeof patchBundleRow>[0], changed: () => void, sessionOwners: () => ReadonlyArray<string | undefined>, processChanged: (value: Configuration) => void = () => {}, profile = "web") => Effect.gen(function*() {
  type Publication = { source: ConfigurationSource; value: Configuration } | { source: undefined }
  const work = yield* Queue.unbounded<Publication>()
  yield* Effect.addFinalizer(() => Queue.shutdown(work))
  const ready = yield* Deferred.make<void>()
  const presses = yield* Semaphore.make(1)
  const progress = yield* SubscriptionRef.make(0)
  const processed = new WeakMap<ConfigurationSource, number>()
  let observed: ConfigurationSource | undefined
  const persistent = (id: string) => offered(host, ConfigurationSource) !== undefined && !sessionOwners().includes(id)
  const modules = yield* offered(host, BundleModules)!.read
  const live = new Set(modules.filter(one =>
    (one.exports as { default: Plugin }).default.configUpdates === "live").map(one => one.name))
  const defaults = new Map<string, PolicyRow>(modules.map(one => {
    const schema = (one.exports as { default: Plugin }).default.config
    try { return [one.name, schema === undefined ? { config: {}, values: [] } : decodePolicy(schema, [], undefined, () => {})] }
    catch { return [one.name, { config: {}, values: [] }] }
  }))
  const environment = new Map(modules.map(one => [one.name, environmentReadings(
    (one.exports as { default: Plugin }).default.environment ?? [], offered(host, Env, one.name)?.vars ?? {},
  )]))
  const bootConfig = configsOf(host)
  const disabled = new Map(ROWS.map(row => [row.id, row.disabled ?? false]))
  for (const row of profilePatch(profile)) disabled.set(row.id, row.disabled)
  let initialized = false
  let current: Configuration | undefined
  let active: ConfigurationSource | undefined
  const lastOn = new Map<string, boolean | undefined>()
  const subscriptions = yield* Effect.forkScoped(Stream.runForEach(
    Stream.switchMap(serviceChanges(host, ConfigurationSource),
      (source): Stream.Stream<Publication> => source === undefined ? Stream.succeed({ source })
        : Stream.map(source.changes, (value) => ({ source, value }))),
    (publication) => Queue.offer(work, publication),
  ))
  const patches = yield* Effect.forkScoped(Stream.runForEach(Stream.fromQueue(work), (publication) => Effect.gen(function*() {
    if (publication.source !== offered(host, ConfigurationSource)) return
    const returning = active !== publication.source
    active = publication.source
    current = publication.source === undefined ? undefined : publication.value
    if (current !== undefined) processChanged(current)
    if (current !== undefined || !initialized) {
      const changes = BUNDLE_NAMES.map(id => {
        const row = current?.rows.get(id)
        const config = row?.node === undefined ? bootConfig.get(id) : row.config
        const enabled = row?.on ?? !disabled.get(id)
        return { id,
          ...(returning || !initialized || lastOn.get(id) !== row?.on ? { disabled: !enabled } : {}),
          ...(config === undefined || live.has(id) ? {} : { config }),
        }
      })
      yield* Effect.uninterruptible(patchBundleRows(host, changes))
      for (const id of BUNDLE_NAMES) lastOn.set(id, current?.rows.get(id)?.on)
      initialized = true
    }
    if (publication.source !== undefined) processed.set(publication.source, publication.value.revision)
    observed = publication.source
    yield* SubscriptionRef.update(progress, n => n + 1)
    changed()
    yield* Deferred.succeed(ready, undefined)
  })))
  const awaitRevision = (source: ConfigurationSource, revision: number) => Effect.gen(function*() {
    yield* Stream.runHead(Stream.filter(SubscriptionRef.changes(progress), () =>
      (processed.get(source) ?? -1) >= revision || (observed !== source && offered(host, ConfigurationSource) !== source)))
    if ((processed.get(source) ?? -1) < revision) return yield* Effect.fail(new UsageFailure({ reason: "The configuration reader withdrew before the change settled. The file retains the write." }))
  })
  const set = (id: string, enabled: boolean, session: () => Effect.Effect<boolean>): Effect.Effect<boolean, OpFailure> => presses.withPermit(Effect.gen(function*() {
    if (!BUNDLE_NAMES.includes(id)) return false
    const source = offered(host, ConfigurationSource)
    if (source === undefined || !persistent(id)) return yield* session()
    const at = source.current()
    if (at.broken !== undefined) return yield* Effect.fail(new UsageFailure({ reason: `Repair ${at.file} before changing which tools run.` }))
    const row = at.rows.get(id)
    if (row?.on === enabled) { yield* awaitRevision(source, at.revision); return true }
    const door = offered(host, WriteDoor)
    if (door === undefined) return yield* Effect.fail(new UsageFailure({ reason: "The directory's write door is unavailable." }))
    const seed = { title: id, props: { on: enabled ? "yes" : "no" } }
    const request: WriteRequest = row?.node !== undefined
      ? { op: "prop", id: row.node.id, key: "on", value: seed.props.on }
      : at.file === undefined ? { op: "create", file: CONFIGURATION_FILE, seed }
      : { op: "add", file: at.file, ...seed }
    const written = yield* (door.gate as Ops).run(request, "web")
    yield* awaitRevision(source, written.rev)
    return true
  }))
  return { defaults, environment, persistent, set, close: Effect.andThen(Fiber.interrupt(subscriptions), Fiber.interrupt(patches)), ready: Deferred.await(ready), current: () => active === offered(host, ConfigurationSource) ? current : undefined }
})

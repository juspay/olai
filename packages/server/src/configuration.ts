/** Serve-owned serialization of live policy publications and loader updates.
 * The provider only publishes. Losing it cancels the subscription, never a
 * patch already accepted by this worker, and never rolls row options back. */
import { BUNDLE_NAMES, configsOf, offered, patchBundleRow, reportBundle, serviceChanges } from "@olai/bundle/bundle"
import { BundleModules, ConfigurationSource } from "@olai/plugin-api/services"
import { decodePolicy, type Configuration, type PolicyRow } from "@olai/plugin-api/configuration"
import type { Plugin } from "@olai/plugin-api"
import { Deferred, Effect, Fiber, Queue, Stream } from "effect"

export const followConfiguration = (host: Parameters<typeof patchBundleRow>[0], changed: () => void) => Effect.gen(function*() {
  type Publication = { source: ConfigurationSource; value: Configuration } | { source: undefined }
  const work = yield* Queue.unbounded<Publication>()
  yield* Effect.addFinalizer(() => Queue.shutdown(work))
  const ready = yield* Deferred.make<void>()
  const modules = yield* offered(host, BundleModules)!.read
  const defaults = new Map<string, PolicyRow>(modules.map(one => {
    const schema = (one.exports as { default: Plugin }).default.config
    return [one.name, schema === undefined ? { config: {}, values: [] } : decodePolicy(schema, [], undefined, () => {})]
  }))
  const bootConfig = configsOf(host)
  const bootReport = yield* reportBundle(host)
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
    if (publication.source === undefined) {
      current = undefined
    } else {
      current = publication.value
      for (const id of BUNDLE_NAMES) {
        const row = current.rows.get(id)
        // Legacy flags remain boot inputs until step 4. With those retired,
        // these are precisely the schema and profile/build defaults.
        const config = row?.node === undefined ? bootConfig.get(id) : row.config
        const enabled = row?.on ?? (bootReport.get(id)?.state !== "off")
        yield* Effect.uninterruptible(patchBundleRow(host, id, {
          ...(returning || lastOn.get(id) !== row?.on ? { disabled: !enabled } : {}),
          ...(config === undefined ? {} : { config }),
        }))
        lastOn.set(id, row?.on)
      }
    }
    changed()
    yield* Deferred.succeed(ready, undefined)
  })))
  return { defaults, close: Effect.andThen(Fiber.interrupt(subscriptions), Fiber.interrupt(patches)), ready: Deferred.await(ready), current: () => active === offered(host, ConfigurationSource) ? current : undefined }
})

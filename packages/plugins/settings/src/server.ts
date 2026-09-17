import { BundleModules, definePlugin, Offers, ConfigurationSource, Vault } from "@olai/plugin-api/services"
import { CONFIGURATION_FILE, type Configuration } from "@olai/plugin-api/configuration"
import type { Plugin } from "@olai/plugin-api"
import { claimedOf, type Reading } from "@olai/format"
import { Effect, Exit, Scope, Semaphore, SubscriptionRef } from "effect"
import { name } from "./index.ts"
import { readConfiguration, warningsOnce, type Declarations } from "./config.ts"
export { name } from "./index.ts"

export default definePlugin({
  name,
  needs: [Vault, BundleModules, Offers],
  apply: Effect.gen(function*() {
    const vault = yield* Vault
    const modules = yield* (yield* BundleModules).read
    const offers = yield* Offers
    const declarations: Declarations = new Map(modules.map((one) => [one.name,
      (one.exports as { default: Plugin }).default.config]))
    let current: Configuration = { revision: 0, rows: new Map() }
    const readings = yield* SubscriptionRef.make(current)
    const warnings: string[] = []
    const warn = warningsOnce((line) => warnings.push(line))
    let selected = CONFIGURATION_FILE
    let readingScope: Scope.Closeable | undefined
    const updates = yield* Semaphore.make(1)
    const withdraw = Effect.suspend(() => {
      const scope = readingScope
      readingScope = undefined
      return scope === undefined ? Effect.void : Scope.close(scope, Exit.void)
    })
    yield* Effect.addFinalizer(() => withdraw)
    yield* vault.revision((revision: { value: Reading; rev: number }) => updates.withPermit(Effect.gen(function*() {
      const next = readConfiguration(revision.value, declarations, revision.rev, warn)
      if (next.file !== undefined) selected = next.file
      if (claimedOf(revision.value.claims, selected) === null) {
        // An unavailable storage reader is absence, not a defaults publication.
        // The host consequently retains patches it already applied to other rows.
        yield* withdraw
        return
      }
      current = next
      for (const line of warnings.splice(0)) yield* Effect.logWarning(line)
      yield* SubscriptionRef.set(readings, current)
      if (readingScope === undefined) {
        const scope = yield* Scope.make()
        readingScope = scope
        const door: ConfigurationSource = { current: () => current, changes: SubscriptionRef.changes(readings) }
        yield* Scope.provide(offers.offer(ConfigurationSource, () => door), scope)
      }
    })))
  }),
})

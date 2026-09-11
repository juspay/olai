import { BundleModules, definePlugin, Offers, ConfigurationSource, Vault } from "@olai/plugin-api/services"
import type { Configuration } from "@olai/plugin-api/configuration"
import type { Plugin } from "@olai/plugin-api"
import type { Reading } from "@olai/format"
import { Effect, SubscriptionRef } from "effect"
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
    yield* vault.revision((revision: { value: Reading; rev: number }) => Effect.gen(function*() {
      current = readConfiguration(revision.value, declarations, revision.rev, warn)
      for (const line of warnings.splice(0)) yield* Effect.logWarning(line)
      yield* SubscriptionRef.set(readings, current)
    }))
    const door: ConfigurationSource = { current: () => current, changes: SubscriptionRef.changes(readings) }
    yield* offers.offer(ConfigurationSource, () => door)
  }),
})

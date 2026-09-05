/** Unit fixtures explicitly supply a vault. Product openPlugins leaves Vault
 * absent until a provider row finishes acquiring its directory. */
import { provide } from "@olai/effect-cordis"
import { Effect } from "effect"
import { openPlugins, Vault, vaultEvents, type PluginsConfig } from "./services.ts"

export const openTestPlugins = (config: PluginsConfig) => Effect.gen(function*() {
  const plugins = yield* openPlugins(config)
  const events = vaultEvents(config.served)
  yield* provide(plugins.host, Vault, events.door)
  return { ...plugins, published: events.published, quiet: events.quiet }
})

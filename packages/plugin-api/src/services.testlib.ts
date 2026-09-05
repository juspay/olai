/** Unit fixtures explicitly supply a vault. Product openPlugins leaves Vault
 * absent until a provider row finishes acquiring its directory. */
import { provide } from "@olai/effect-cordis"
import { Effect } from "effect"
import { openPlugins, Ops, opsEvents, NOWHERE_TO_WRITE, Vault, vaultEvents, type PluginsConfig } from "./services.ts"

export const openTestPlugins = (config: PluginsConfig & { readonly served: string; readonly ops?: Pick<Ops, "reading" | "page" | "prop" | "document"> }) => Effect.gen(function*() {
  const plugins = yield* openPlugins(config)
  const events = vaultEvents(config.served)
  yield* provide(plugins.host, Vault, events.door)
  const refusals = opsEvents()
  yield* provide(plugins.host, Ops, (plugin) => ({
    gate: undefined,
    reading: config.ops?.reading ?? Effect.succeed(null),
    page: (request) => config.ops?.page(request) ?? Effect.fail(NOWHERE_TO_WRITE),
    prop: (write) => config.ops?.prop(write) ?? Effect.fail(NOWHERE_TO_WRITE),
    document: (file) => config.ops?.document(file) ?? Effect.fail(NOWHERE_TO_WRITE),
    refused: refusals.listen(plugin),
  }))
  return { ...plugins, refused: refusals.tell, published: events.published, quiet: events.quiet }
})

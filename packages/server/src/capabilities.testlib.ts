/** Real capability rows over an explicitly supplied test vault. Store fault
 * injection stays below the rows; their handlers and subscriptions are real. */
import { mountBundle, provide, settled } from "@olai/bundle/bundle"
import { openPlugins, Directory, Ops, Vault, vaultEvents, opsEvents, mountPlugin, rowReport, openLoading } from "@olai/plugin-api/services"
import type { Plugins } from "@olai/plugin-api/services"
import type { Ops as Gate, Store } from "@olai/ops"
import { Deferred, Effect, Stream } from "effect"
import { fileAccess } from "olai-plugin-vault/testlib"
import type { PluginRuntime } from "./runtime.ts"

export const CONTENT_ROWS = ["outlines", "markdown", "files", "pins", "capture", "trash"] as const
export const runtimeFor = (plugins: Plugins, built: ReadonlyArray<string>, onChange = {run: () => {}}) => Effect.gen(function*() {
  const reports = yield* rowReport(plugins.host,built)
  return {
    plugins: {...plugins, changes: Stream.empty}, onChange, built,
    pin: {kind:"exact",names:built}, report: () => reports,
    names: () => new Map(), configs: () => new Map(), set: () => Effect.succeed(false),
    reread: Effect.void, switched: () => new Set(),
  } satisfies PluginRuntime
})

export const capabilitiesOver = (store: Store, gate: Gate, root: string, options: {readonly definitions?: boolean; readonly rows?: ReadonlyArray<string>} = {}) => Effect.gen(function*() {
  const onChange = {run: () => {}}
  const plugins = yield* openPlugins({vars:{},now:()=>"",changed:()=>onChange.run()})
  const content = options.rows ?? CONTENT_ROWS
  const rows = options.definitions ? [...content, "vault-plugins"] : content
  yield* openLoading(plugins.host, rows, () => onChange.run(), {services: plugins.serviceKeys, browserServices: plugins.browserKeys})
  const events = vaultEvents(root)
  const refusals = opsEvents()
  const first = yield* Deferred.make<void>()
  yield* Effect.forkScoped(Stream.runForEach(store.reads, ({snapshot}) => Effect.andThen(
    snapshot === null ? events.quiet : events.published(snapshot), Deferred.succeed(first,undefined))))
  yield* Deferred.await(first)
  yield* provide(plugins.host, Directory, () => ({root,store}))
  yield* provide(plugins.host, Ops, plugin => ({
    gate, reading: Effect.catch(gate.read,()=>Effect.succeed(null)),
    page: request => gate.page(request as import("@olai/format").PageRequest),
    prop: write => Effect.asVoid(gate.run({op:"prop",id:write.node,key:write.key,value:write.value},"web")),
    document: file => Effect.asVoid(gate.run({op:"create-doc",file},"web")),
    refused: refusals.listen(plugin),
  }))
  yield* provide(plugins.host, Vault, events.door)
  yield* mountPlugin(plugins.host,fileAccess)
  yield* mountBundle(plugins.host,{kind:"exact",names:rows},[],"surface")
  yield* settled(plugins.host,rows)
  return yield* runtimeFor(plugins,rows,onChange)
})

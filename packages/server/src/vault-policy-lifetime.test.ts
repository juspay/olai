import { expect, test } from "bun:test"
import { Effect } from "effect"
import { readingOfVault } from "@olai/format/testlib/scope"
import { mountBundle, provide, setRow, settled, offered } from "@olai/bundle/bundle"
import { openPlugins, openLoading, Ops, Vault, vaultEvents, serviceTag } from "@olai/plugin-api/services"
import { bind } from "./runtime.ts"
import { runtimeFor } from "./capabilities.testlib.ts"

const value = serviceTag<{ value: number }>("swatch.value")
const chunks = serviceTag<{ chunk: (path: string) => string | null }>("vault-plugins.chunks")
const source = `import {definePlugin} from "@olai/plugin-api"
import {Offers} from "@olai/plugin-api"
import {Effect} from "effect"
export default definePlugin({name:"swatch",needs:[Offers],apply:Effect.gen(function*(){
  yield* (yield* Offers).own("value",()=>({value:1}))
})})`

test("withdrawing vault source policy removes its children, catalog, chunks and retained procedures", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const onChange = {run: () => {}}
  const plugins = yield* openPlugins({vars:{},now:()=>"",changed:()=>onChange.run()})
  const loading = yield* openLoading(plugins.host,["vault-plugins"],()=>onChange.run(),{services:plugins.serviceKeys,browserServices:plugins.browserKeys})
  const read = readingOfVault(new Map([["plugin.olai", [
    JSON.stringify({id:"p",ord:"a0",title:"A plugin",custom:{plugin:"swatch",approved:"always"}}),
    JSON.stringify({id:"s",ord:"a0",parent:"p",title:"server.ts",desc:source}),
  ].join("\n")]]))
  const events = vaultEvents("/test")
  yield* events.published({rev:1,value:read,changed:["plugin.olai"],removed:[]})
  yield* provide(plugins.host,Vault,events.door)
  yield* provide(plugins.host,Ops,()=>({gate:{read:Effect.succeed(read)}} as never))
  yield* mountBundle(plugins.host,{kind:"exact",names:["vault-plugins"]},[])
  yield* settled(plugins.host,["swatch"])
  expect(offered(plugins.host,value)).toEqual({value:1})
  expect(loading.names()).toEqual(["swatch"])
  expect(offered(plugins.host,chunks)).toBeDefined()
  const runtime = yield* runtimeFor(plugins,["vault-plugins"],onChange)
  const wired = yield* bind({hostname:"test",startedAt:"",plugins:{...runtime,catalogs:loading.catalogs}})
  yield* Effect.addFinalizer(()=>Effect.promise(()=>wired.bound.close()))
  const retained = wired.bound.handlers["surface/plugins/inspect"]!
  expect(retained).toBeDefined()
  yield* setRow(plugins.host,"vault-plugins",false)
  expect(offered(plugins.host,value)).toBeUndefined()
  expect(offered(plugins.host,chunks)).toBeUndefined()
  expect(loading.names()).toEqual([])
  expect(wired.bound.handlers["surface/plugins/inspect"]).toBeUndefined()
  expect(yield* Effect.exit(retained({}) as Effect.Effect<unknown>)).toHaveProperty("_tag","Failure")
  yield* setRow(plugins.host,"vault-plugins",true)
  yield* settled(plugins.host,["swatch"])
  expect(offered(plugins.host,value)).toEqual({value:1})
  expect(loading.names()).toEqual(["swatch"])
  expect(wired.bound.handlers["surface/plugins/inspect"]).not.toBe(retained)
}))))

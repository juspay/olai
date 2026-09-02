import Include from "@cordisjs/plugin-include"
import Loader from "@cordisjs/plugin-loader"
import { Context } from "cordis"

const ctx = new Context()
ctx.baseUrl = new URL(".", import.meta.url).href
const loader = ctx.plugin(Loader)
await loader.await()
// The resolver seam: `EntryTree.import` calls `loader.internal.import(name, baseUrl, {})`
// when one is set, and falls back to a bare `import()` from inside the loader's
// own package (which cannot see a workspace member) when it is not.
;(ctx.loader as unknown as { internal: unknown }).internal = {
  version: "v1",
  import: (specifier: string) => import(specifier),
}
const inc = ctx.plugin(Include, { path: "./rows.yml", patches: [{ id: "odu", disabled: true }] })
await inc.await()
await ctx.loader.await()
console.log("registry size:", ctx.registry.size)
for (const runtime of ctx.registry.values()) console.log("  runtime:", runtime.name)

import Include from "@cordisjs/plugin-include"
import Loader from "@cordisjs/plugin-loader"
import { Context, Service } from "cordis"

class Sink extends Service {
  readonly seen: Array<string> = []
  constructor(ctx: Context) { super(ctx, "sink") }
  mark(): void { this.seen.push(this.ctx.fiber.name) }
}
declare module "cordis" { interface Context { sink: Sink } }

const ctx = new Context()
await ctx.plugin(Sink)
const alpha = { name: "alpha", inject: ["sink"], apply(c: Context) { c.sink.mark() } }
const beta = { name: "beta", inject: ["sink"], apply(c: Context) { c.sink.mark() } }

ctx.baseUrl = new URL(".", import.meta.url).href
const loader = ctx.plugin(Loader)
await loader.await()
ctx.loader.builtins["alpha"] = alpha
ctx.loader.builtins["beta"] = beta

const inc = ctx.plugin(Include, {
  path: "./rows.yml",
  patches: [{ id: "beta", disabled: true }],
})
await inc.await()
await ctx.loader.await()
console.log("mounted:", ctx.sink.seen)
console.log("entries:", [...ctx.loader.entries()].map((e) => `${e.id}:${e.options.disabled ?? false}`))

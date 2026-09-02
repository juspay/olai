import { Context, Service } from "cordis"

class Stamp extends Service {
  constructor(ctx: Context) { super(ctx, "stamp") }
  who(): string { return this.ctx.fiber.name }
  effectFor(sink: Array<string>): () => void {
    const name = this.ctx.fiber.name
    return this.ctx.effect(() => {
      sink.push(`+${name}`)
      return () => { sink.push(`-${name}`) }
    })
  }
}
declare module "cordis" {
  interface Context { stamp: Stamp }
}

const sink: Array<string> = []
const ctx = new Context()
const svc = ctx.plugin(Stamp)
await svc.await()

const kolu = { name: "kolu", inject: ["stamp"], apply(c: Context) { console.log("kolu sees", c.stamp.who()); c.stamp.effectFor(sink) } }
const odu = { name: "odu", inject: ["stamp"], apply(c: Context) { console.log("odu sees", c.stamp.who()); c.stamp.effectFor(sink) } }

const f1 = ctx.plugin(kolu)
const f2 = ctx.plugin(odu)
await f1.await()
await f2.await()
console.log("sink after mount:", sink, "states", f1.state, f2.state)
await f1.dispose()
console.log("sink after kolu dispose:", sink, "state", f1.state)

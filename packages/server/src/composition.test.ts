import { expect, test } from "bun:test"
import { defineSurface } from "@kolu/surface/define"
import { Effect, Schema } from "effect"
import { composeCapabilities } from "./composition.ts"

const root = defineSurface({})
const counter = defineSurface({ procedures: { count: { get: { output: Schema.Number } } } })
const answer = (n: number) => ({ procedures: { count: { get: () => Effect.succeed(n) } } })

test("a capability's tags follow its own generation and preserve unrelated handlers", async () => {
  const host = composeCapabilities(root, {}, { browser: {} })
  try {
    const other = host.mount("other", counter, answer(9))
    const otherHandler = host.handlers["surface/other/count/get"]!
    const one = host.mount("one", counter, answer(1), { faces: { browser: { "count.get": "tool" } } })
    const held = host.handlers["surface/one/count/get"]!
    expect(await Effect.runPromise(held(undefined) as Effect.Effect<number>)).toBe(1)
    expect(host.faces.browser!.tags.has("surface/one/count/get")).toBe(true)
    expect(host.faces.browser!.tags.has("surface/count/get")).toBe(false)
    await one.drop()
    expect(host.group.requests.has("surface/one/count/get")).toBe(false)
    expect(host.handlers["surface/other/count/get"]).toBe(otherHandler)
    const stale = await Effect.runPromiseExit(held(undefined) as Effect.Effect<number>)
    expect(stale._tag).toBe("Failure")
    const two = host.mount("one", counter, answer(2))
    expect(await Effect.runPromise(host.handlers["surface/one/count/get"]!(undefined) as Effect.Effect<number>)).toBe(2)
    expect(host.handlers["surface/other/count/get"]).toBe(otherHandler)
    await two.drop()
    await other.drop()
  } finally { await host.close() }
})

test("an invalid exposure acquires no partial surface", async () => {
  const host = composeCapabilities(root, {}, {})
  try {
    const one = host.mount("one", counter, answer(1))
    const two = host.mount("two", counter, answer(2))
    expect(host.roster).toEqual(["one", "two"])
    expect(await Effect.runPromise(host.handlers["surface/two/count/get"]!(undefined) as Effect.Effect<number>)).toBe(2)
    expect(() => host.mount("bad", counter, answer(3), { faces: { browser: { absent: "tool" } as never } })).toThrow()
    expect(host.roster).toEqual(["one", "two"])
    await one.drop()
    await two.drop()
  } finally { await host.close() }
})

test("write attribution is recorded under the owner's tag and leaves with it", async () => {
  const contract = defineSurface({ procedures: { write: { apply: {
    input: Schema.Struct({ kind: Schema.String }), output: Schema.Number,
  } } } })
  const deps = { procedures: { write: { apply: () => Effect.succeed(1) } } }
  const tag = "surface/write/apply"
  const scoped = "surface/one/write/apply"
  const host = composeCapabilities(root, {}, {})
  try {
    const one = host.mount("one", contract, deps, { writes: [tag], faces: { agent: { "write.apply": "tool" } } })
    expect(host.writes).toEqual([scoped])
    expect(host.faces.agent!.tags.has(scoped)).toBe(true)
    expect(host.faces.agent!.tags.has(tag)).toBe(false)
    expect(() => host.mount("bad", contract, deps, { writes: ["surface/missing"] })).toThrow("unknown write")
    expect(host.roster).toEqual(["one"])
    await one.drop()
    expect(host.writes).not.toContain(scoped)
    expect(host.faces.agent?.tags.has(scoped) ?? false).toBe(false)
  } finally { await host.close() }
})

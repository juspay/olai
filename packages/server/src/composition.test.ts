import { expect, test } from "bun:test"
import { defineSurface } from "@kolu/surface/define"
import { Cause, Effect, Schema } from "effect"
import { composeCapabilities } from "./composition.ts"

const root = defineSurface({})
const counter = defineSurface({ procedures: { count: { get: { output: Schema.Number } } } })
const answer = (n: number) => ({ procedures: { count: { get: () => Effect.succeed(n) } } })

test("standalone tags follow independent provider generations and preserve unrelated handlers", async () => {
  const host = composeCapabilities(root, {}, { browser: {} })
  try {
    const other = host.mount("other", counter, answer(9))
    const otherHandler = host.handlers["surface/other/count/get"]!
    const one = host.mount("one", counter, answer(1), { root: true, faces: { browser: { "count.get": "tool" } } })
    const old = host.handlers["surface/count/get"]!
    expect(await Effect.runPromise(old(undefined) as Effect.Effect<number>)).toBe(1)
    expect(host.faces.browser!.tags.has("surface/count/get")).toBe(true)
    expect(host.group.requests.has("surface/one/count/get")).toBe(true)
    await one.drop()
    expect(host.group.requests.has("surface/count/get")).toBe(false)
    expect(host.handlers["surface/other/count/get"]).toBe(otherHandler)
    const stale = await Effect.runPromiseExit(old(undefined) as Effect.Effect<number>)
    expect(stale._tag).toBe("Failure")
    const two = host.mount("one", counter, answer(2), { root: true })
    expect(await Effect.runPromise(host.handlers["surface/count/get"]!(undefined) as Effect.Effect<number>)).toBe(2)
    expect(host.handlers["surface/other/count/get"]).toBe(otherHandler)
    await two.drop()
    await other.drop()
  } finally { await host.close() }
})

test("conflicting root tags and invalid exposures acquire no partial surface", async () => {
  const host = composeCapabilities(root, {}, {})
  try {
    const one = host.mount("one", counter, answer(1), { root: true })
    expect(() => host.mount("two", counter, answer(2), { root: true })).toThrow('"two"')
    expect(host.roster).toEqual(["one"])
    expect(() => host.mount("bad", counter, answer(3), { faces: { browser: { absent: "tool" } as never } })).toThrow()
    expect(host.roster).toEqual(["one"])
    await one.drop()
  } finally { await host.close() }
})

test("disjoint variants share a legacy procedure without bypassing provider withdrawal", async () => {
  const input = Schema.Struct({ kind: Schema.String })
  const contract = defineSurface({ procedures: { write: { apply: { input, output: Schema.Number } } } })
  const deps = (n: number) => ({ procedures: { write: { apply: () => Effect.succeed(n) } } })
  const opts = (kind: string) => ({ root: true, dispatch: { "surface/write/apply": { field: "kind", cases: [kind] } } })
  const host = composeCapabilities(root, {}, {})
  try {
    const outline = host.mount("outline", contract, deps(1), opts("node"))
    const markdown = host.mount("markdown", contract, deps(2), opts("document"))
    const old = host.handlers["surface/write/apply"]!
    expect(await Effect.runPromise(old({kind: "node"}) as Effect.Effect<number>)).toBe(1)
    expect(await Effect.runPromise(old({kind: "document"}) as Effect.Effect<number>)).toBe(2)
    expect(() => host.mount("collision", contract, deps(3), opts("node"))).toThrow("overlap")
    await outline.drop()
    expect(await Effect.runPromiseExit(old({kind: "node"}) as Effect.Effect<number>)).toHaveProperty("_tag", "Failure")
    const absent = await Effect.runPromiseExit(host.handlers["surface/write/apply"]!({kind: "node"}) as Effect.Effect<number>)
    expect(absent._tag).toBe("Failure")
    if (absent._tag === "Failure") expect(Cause.squash(absent.cause)).toHaveProperty("_tag", "SurfaceSiblingDropped")
    expect(await Effect.runPromise(host.handlers["surface/write/apply"]!({kind: "document"}) as Effect.Effect<number>)).toBe(2)
    const fresh = host.mount("outline", contract, deps(4), opts("node"))
    await outline.drop()
    expect(await Effect.runPromise(host.handlers["surface/write/apply"]!({kind: "node"}) as Effect.Effect<number>)).toBe(4)
    await fresh.drop()
    await markdown.drop()
  } finally { await host.close() }
})

test("shared variants cannot widen face access or lose write attribution", async () => {
  const contract = defineSurface({ procedures: { write: { apply: {
    input: Schema.Struct({ kind: Schema.String }), output: Schema.Number,
  } } } })
  const deps = { procedures: { write: { apply: () => Effect.succeed(1) } } }
  const tag = "surface/write/apply"
  const host = composeCapabilities(root, {}, {})
  try {
    host.mount("one", contract, deps, {
      root: true, dispatch: { [tag]: { field: "kind", cases: ["one"] } },
      writes: [tag], faces: { agent: { "write.apply": "tool" } },
    })
    const options = { root: true, dispatch: { [tag]: { field: "kind", cases: ["two"] } }, writes: [tag] }
    expect(() => host.mount("private", contract, deps, options)).toThrow("exposure")
    expect(() => host.mount("unattributed", contract, deps, {
      ...options, writes: [], faces: { agent: { "write.apply": "tool" } },
    })).toThrow("write authority")
    expect(host.roster).toEqual(["one"])
    expect(host.writes).toEqual([tag, "surface/one/write/apply"])
    expect(() => host.mount("bad", contract, deps, { writes: ["surface/missing"] })).toThrow("unknown write")
    expect(() => host.mount("bad", contract, deps, {
      root: true, dispatch: { [tag]: { field: "kind", cases: [] } },
    })).toThrow("invalid dispatch")
    host.mount("scoped", contract, deps, { writes: [tag] })
    expect(host.writes).toContain("surface/scoped/write/apply")
  } finally { await host.close() }
})


test("qualified clients retain provider authority without duplicating agent exposure", async () => {
  const contract = defineSurface({ procedures: { write: { apply: {
    input: Schema.Struct({ kind: Schema.String }), output: Schema.Number,
  } } } })
  const tag = "surface/write/apply"
  const scoped = "surface/one/write/apply"
  const host = composeCapabilities(root, {}, {})
  try {
    const one = host.mount("one", contract, { procedures: { write: { apply: () => Effect.succeed(1) } } }, {
      root: true, writes: [tag], dispatch: { [tag]: { field: "kind", cases: ["one"] } },
      faces: { agent: { "write.apply": "tool" } },
      scopedFaces: { browser: { "write.apply": "tool" } },
    })
    const held = host.handlers[scoped]!
    expect(host.faces.agent!.tags.has(tag)).toBe(true)
    expect(host.faces.agent!.tags.has(scoped)).toBe(false)
    expect(host.faces.browser!.tags.has(scoped)).toBe(true)
    expect(host.writes).toContain(scoped)
    expect(await Effect.runPromise(held({ kind: "one" }) as Effect.Effect<number>)).toBe(1)
    const wrongOwner = await Effect.runPromiseExit(held({ kind: "two" }) as Effect.Effect<number>)
    expect(wrongOwner._tag).toBe("Failure")
    if (wrongOwner._tag === "Failure") expect(Cause.squash(wrongOwner.cause)).toHaveProperty("_tag", "SurfaceSiblingDropped")
    await one.drop()
    expect(host.group.requests.has(scoped)).toBe(false)
    expect(host.writes).not.toContain(scoped)
    expect(host.faces.browser?.tags.has(scoped) ?? false).toBe(false)
    expect(await Effect.runPromiseExit(held({ kind: "one" }) as Effect.Effect<number>)).toHaveProperty("_tag", "Failure")
  } finally { await host.close() }
})

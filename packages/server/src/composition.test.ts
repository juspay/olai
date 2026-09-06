import { expect, test } from "bun:test"
import { defineSurface } from "@kolu/surface/define"
import { Effect, Schema } from "effect"
import { composeCapabilities } from "./composition.ts"

const root = defineSurface({})
const counter = defineSurface({ procedures: { count: { get: { output: Schema.Number } } } })
const answer = (n: number) => ({ procedures: { count: { get: () => Effect.succeed(n) } } })

/**
 * THREE TESTS WHERE THERE WERE FIVE, and the two that went were the whole of
 * the root-mount machinery (#546): "disjoint variants share a legacy procedure"
 * and "qualified clients retain provider authority without duplicating agent
 * exposure". Both were about a member answering under a BARE tag as well as its
 * own — the envelope that picked an owner by payload field, the five mount-time
 * refusals that made the sharing safe, and the pair of face grants a row needed
 * because the two names could be granted separately.
 *
 * Nothing here replaces them, because there is nothing left to replace: a
 * member has one tag, it carries its owner's name, and two capabilities can no
 * longer name one member. What survives is what was always this file's other
 * half — that a generation is isolated, that a grant is scoped, and that a
 * refused mount acquires nothing.
 */

test("a capability's tags follow its own generation and preserve unrelated handlers", async () => {
  const host = composeCapabilities(root, {}, { browser: {} })
  try {
    const other = host.mount("other", counter, answer(9))
    const otherHandler = host.handlers["surface/other/count/get"]!
    const one = host.mount("one", counter, answer(1), { faces: { browser: { "count.get": "tool" } } })
    const held = host.handlers["surface/one/count/get"]!
    expect(await Effect.runPromise(held(undefined) as Effect.Effect<number>)).toBe(1)
    // THE GRANT IS UNDER THE OWNER'S NAME AND NO OTHER. `{ "count.get": "tool" }`
    // is written against this capability's OWN spec, where the member is bare;
    // `surface/one/count/get` is what the composer makes of it.
    expect(host.faces.browser!.tags.has("surface/one/count/get")).toBe(true)
    expect(host.faces.browser!.tags.has("surface/count/get")).toBe(false)
    await one.drop()
    expect(host.group.requests.has("surface/one/count/get")).toBe(false)
    expect(host.handlers["surface/other/count/get"]).toBe(otherHandler)
    const stale = await Effect.runPromiseExit(held(undefined) as Effect.Effect<number>)
    expect(stale._tag).toBe("Failure")
    // The same word returns as a NEW generation, and the survivor is untouched.
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
    // TWO CAPABILITIES CANNOT COLLIDE ON A MEMBER ANY MORE — only on the mount
    // NAME, which is the framework's own refusal one wall down. A second
    // capability declaring the identical spec under a different name is now the
    // ordinary case, and it used to be the thing this test was about.
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
  // A CAPABILITY NAMES THE TAG ITS OWN SURFACE SPELLS. The composer is the one
  // place that becomes `surface/one/write/apply`, which is why four rows of the
  // bundle all declaring `["surface/ops/run"]` is four rows each naming their
  // own member rather than one shared claim.
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

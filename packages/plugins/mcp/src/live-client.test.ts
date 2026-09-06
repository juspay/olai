import { expect, test } from "bun:test"
import { defineSurface } from "@kolu/surface/define"
import { exposeFace } from "@kolu/surface/expose"
import { implementSurface } from "@kolu/surface/server"
import { Effect, Schema } from "effect"
import { RequestAuthority } from "@olai/plugin-api/authority"
import { liveDispatch } from "./live-client.ts"

const surface = defineSurface({ procedures: { counter: { read: { output: Schema.String } } } })
const empty = defineSurface({})
const tag = "surface/counter/read"
test("a retained MCP dispatch uses fresh generations and preserves its credential authority", async () => {
  const called: string[] = []
  const make = (value: string) => implementSurface(surface, { procedures: { counter: { read: () => Effect.gen(function*() {
    called.push(value)
    return `${value}:${(yield* RequestAuthority).writer}`
  }) } } })
  const first = make("first"), second = make("second"), absent = implementSurface(empty, {})
  const activeFace = exposeFace(surface, { "counter.read": "tool" })
  let bound = { ...first, expose: activeFace }
  const held = liveDispatch(() => ({ ...bound, writes: [tag] }), { writer: "node-agent" })
  try {
    expect(await Effect.runPromise(held.unary(tag, undefined))).toBe("first:node-agent")
    bound = { ...absent, expose: exposeFace(empty, {}) }
    await first.close()
    await expect(Effect.runPromise(held.unary(tag, undefined))).rejects.toThrow("capability")
    bound = { ...second, expose: activeFace }
    expect(await Effect.runPromise(held.unary(tag, undefined))).toBe("second:node-agent")
    expect(called).toEqual(["first", "second"])
  } finally { await Promise.all([first.close(), second.close(), absent.close()]) }
})

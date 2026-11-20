import { expect, test } from "bun:test"
import { defineSurface } from "@kolu/surface/define"
import { exposeRootedFaces } from "@kolu/surface/expose"
import { implementRootedSurfaces } from "@kolu/surface/server"
import { Effect, Schema } from "effect"
import { RequestAuthority } from "@olai/plugin-api/authority"
import { scopedTo } from "./live-client.ts"

const row = defineSurface({ procedures: { counter: { read: { output: Schema.String } } } })
const core = defineSurface({})

const bare = "surface/counter/read"
const at = (key: string) => `surface/${key}/counter/read`

const generation = (name: string, keys: ReadonlyArray<string>) => {
  const called: string[] = []
  const runtime = implementRootedSurfaces(core, {}, {})
  for (const key of keys) {
    runtime.mount(key, row, {
      procedures: { counter: { read: () => Effect.gen(function*() {
        called.push(`${name}:${key}`)
        return `${name}:${key}:${(yield* RequestAuthority).writer}`
      }) } },
    })
  }
  return {
    called,
    close: () => runtime.close(),
    bound: () => ({
      group: runtime.group,
      handlers: runtime.handlers,
      writes: keys.map(at),
      // `as const` because `Object.fromEntries` widens `"tool"` to `string` and
      // `ExposeMap` is a union of literals.
      expose: exposeRootedFaces(core, {}, Object.fromEntries(keys.map(key => [key, row])), Object.fromEntries(keys.map(key => [key, { "counter.read": "tool" } as const]))),
    }),
  }
}

test("a dispatch scoped to one row reaches that row, keeps its credential across generations, and refuses when the row is gone", async () => {
  const first = generation("first", ["outlines", "markdown"])
  const second = generation("second", ["outlines", "markdown"])
  const without = generation("without", ["markdown"])
  let live = first
  const held = scopedTo(() => live.bound(), { writer: "node-agent" }, "outlines")
  try {
    expect(await Effect.runPromise(held.unary(bare, undefined))).toBe("first:outlines:node-agent")
    expect(first.called).toEqual(["first:outlines"])

    live = without
    await first.close()
    await expect(Effect.runPromise(held.unary(bare, undefined))).rejects.toThrow("capability")
    expect(without.called).toEqual([])

    live = second
    expect(await Effect.runPromise(held.unary(bare, undefined))).toBe("second:outlines:node-agent")
    expect(second.called).toEqual(["second:outlines"])
  } finally {
    await Promise.all([first.close(), second.close(), without.close()])
  }
})

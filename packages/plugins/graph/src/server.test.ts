/**
 * The server half, driven through a mounted plugin and one doubled `Ops` —
 * never a human's directory.
 *
 * The half holds nothing of its own, so the two things a case can observe
 * are the two it must keep: a `graph` read is core's standing page read
 * `ops.page` forwarded UNCHANGED (the gated read — one snapshot for a
 * keystroke, an agent and this page), and the one pulse a subscriber hangs
 * off rings exactly when the directory changes — once per landed revision
 * and once on unload, never otherwise.
 */

import { readingOf, setOf } from "@olai/format/testlib"
import { mountPlugin, standing } from "@olai/plugin-api/services"
import type { Refusal, Registered } from "@olai/plugin-api/services"
import { openTestPlugins as openPlugins } from "@olai/plugin-api/testlib"
import { expect, test } from "bun:test"
import { Effect } from "effect"

import graph from "./server.ts"

interface GraphDeps {
  readonly streams: {
    readonly graph: {
      readonly read: (input: unknown) => Promise<unknown>
      readonly install: (input: unknown, onEvent: () => void) => () => void
    }
  }
}

const mounted = async (page: (input: unknown) => Effect.Effect<unknown, never>) => {
  const half: { seen: unknown[] } = { seen: [] }
  /** The runtime this case owns: a scope that outlives a call, so every
   *  registration the plugin makes hangs off its own scope and unwinds on
   *  `dispose` — the same shape a serve's boot crosses. */
  const run = standing()
  const niche: Refusal = { _tag: "Refusal", reason: "not this case's door" } as Refusal
  const plugins = await run(openPlugins({
    served: "/tmp/graph-served",
    vars: {},
    now: () => "2026-09-08T12:00:00Z",
    ops: {
      reading: Effect.succeed(null),
      page: (input) =>
        Effect.suspend(() => {
          half.seen.push(input)
          return page(input)
        }),
      prop: () => Effect.fail(niche),
      document: () => Effect.fail(niche),
    },
  }))
  const plugin = await run(mountPlugin(plugins.host, graph))
  const sibling = (): Registered => {
    const one = plugins.composed()[0]
    if (one === undefined) throw new Error("the graph plugin registered no sibling")
    return one
  }
  return {
    seen: half.seen,
    stream: (): GraphDeps["streams"]["graph"] => (sibling().deps as GraphDeps).streams.graph,
    published: (snapshot?: unknown): Promise<void> => {
      if (snapshot !== undefined) return run(plugins.published(snapshot))
      return run(plugins.published({ value: readingOf(setOf({})) }))
    },
    quieted: (): Promise<void> => run(plugins.quiet),
    dispose: (): Promise<void> => run(plugin.dispose),
  }
}

test("a graph read is core's page read, forwarded unchanged", async () => {
  const answer = { tag: "the answer the page cache kept" }
  const half = await mounted(() => Effect.succeed(answer))
  const request = { kind: "graph", around: null, hops: 2 }
  expect(await half.stream().read(request)).toBe(answer)
  expect(half.seen).toEqual([request])
  await half.dispose()
})

test("a landed revision and the vault going quiet each ring the one pulse", async () => {
  const half = await mounted(() => Effect.succeed(null))
  let rang = 0
  const off = half.stream().install(null, () => rang += 1)
  await half.published()
  expect(rang).toBe(1)
  await half.published()
  expect(rang).toBe(2)
  await half.quieted()
  expect(rang).toBe(3)
  off()
  await half.published()
  expect(rang).toBe(3)
  await half.dispose()
})

test("dropping the plugin closes its subscription and the pulse goes quiet", async () => {
  const half = await mounted(() => Effect.succeed(null))
  let rang = 0
  half.stream().install(null, () => rang += 1)
  await half.dispose()
  await half.published()
  expect(rang).toBe(0)
})

/**
 * ONE ROW'S DISPATCH, over a real rooted composition.
 *
 * ## What this case used to be
 *
 * `liveDispatch(read, caller, route)` with `(at) => at` for the route: a flat
 * dispatch over the composed handlers, addressed by BARE tags, with the routing
 * question deliberately stubbed out so the case could be about generations
 * alone. Neither half of that shape exists any more. There is no flat client to
 * retain — juspay/kolu#2234 gave the adapter a rooted bundle and
 * `olai-plugin-mcp`'s `bundle.ts` builds ONE CLIENT PER STANDING ROW — and there
 * is no route to hand in, because a member's owner is settled by which client
 * the caller picked rather than by a table consulted per tag.
 *
 * So the identity route is gone and the sibling KEY is what replaces it. Every
 * claim the old case made is still made here, on `scopedTo`: a retained dispatch
 * reaches the CURRENT generation's handlers, carries its credential authority
 * across a swap, and refuses when the member it addresses is not being served.
 *
 * ## ...and the claim it could not make
 *
 * Two rows declaring the same member is the ordinary case on this face — four of
 * them declare `ops.run` — and under bare tags that was a collision the flat
 * contract hid by copying one of them into a curated spec. Here it is two
 * siblings with the same member key, and each client reaching its OWN row is a
 * property of the tag algebra rather than of anybody's table.
 */
import { expect, test } from "bun:test"
import { defineSurface } from "@kolu/surface/define"
import { exposeRootedFaces } from "@kolu/surface/expose"
import { implementRootedSurfaces } from "@kolu/surface/server"
import { Effect, Schema } from "effect"
import { RequestAuthority } from "@olai/plugin-api/authority"
import { scopedTo } from "./live-client.ts"

/** One row's STANDALONE spec — the shape a per-sibling client face is built
 *  against, which is why the tag below is the bare one. */
const row = defineSurface({ procedures: { counter: { read: { output: Schema.String } } } })
/** No core: core's members are on no agent face, so the served bundle is
 *  siblings alone (`./bundle.ts`'s `clientsFor`). */
const core = defineSurface({})

/** What the CLIENT asks for — bare, because the face never learns it is
 *  scoped — and what the composition actually serves it as. */
const bare = "surface/counter/read"
const at = (key: string) => `surface/${key}/counter/read`

/** A generation serving `counter.read` under each of `keys`, answering with its
 *  own name, the key it was mounted under, and the writer the credential
 *  carried — so a call landing on the wrong row is a wrong STRING rather than a
 *  silent success. */
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
      // SCOPED, because the composition root puts a row's declared writes under
      // its own name (`@olai/server`'s `composition.ts`). A bare tag here would
      // bind no credential and the reads below would see the default writer.
      writes: keys.map(at),
      // `as const` on the grant because `Object.fromEntries` widens `"tool"` to
      // `string`, and `ExposeMap` is a union of literals: without it the map
      // that gates the row does not typecheck against the row's own spec, which
      // is exactly the per-sibling check kolu's mapped type exists to keep.
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
    // THE MEMBER LANDS ON ITS OWN ROW. `markdown` declares the identical member
    // in the same generation, so an unscoped dispatch would have two handlers to
    // choose between and this assertion could not tell them apart.
    expect(await Effect.runPromise(held.unary(bare, undefined))).toBe("first:outlines:node-agent")
    expect(first.called).toEqual(["first:outlines"])

    // ...AND THE ROW LEAVES. `outlines` is not mounted in this generation, so
    // the scoped tag names nothing served — refused in the same words an
    // unexposed member gets, and NOT routed to the `markdown` row that is still
    // answering the same bare tag.
    live = without
    await first.close()
    await expect(Effect.runPromise(held.unary(bare, undefined))).rejects.toThrow("capability")
    expect(without.called).toEqual([])

    // ...AND COMES BACK, to a generation the dispatch was never told about,
    // still carrying the writer it was minted with. Reading the generation per
    // call rather than closing over one is the whole of this line.
    live = second
    expect(await Effect.runPromise(held.unary(bare, undefined))).toBe("second:outlines:node-agent")
    expect(second.called).toEqual(["second:outlines"])
  } finally {
    await Promise.all([first.close(), second.close(), without.close()])
  }
})

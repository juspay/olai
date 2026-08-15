/**
 * Three allowlists, as fences rather than as claims.
 *
 * The last test in this file is the one that matters and the rest hold it up: a
 * real olai server, a real browser websocket, and a write verb that the surface
 * genuinely declares being REFUSED there — while the same connection goes on
 * answering everything a page actually asks. That property is what let the ops
 * request vocabulary onto the surface at all, and it is not a property of any
 * map read on its own.
 *
 * Two things are being held still about the maps themselves, and neither is
 * "the map has the entries we typed" — that is a tautology. What is worth a
 * test is what a FUTURE editor would break without noticing:
 *
 *   - that the projection is what {@link ./faces.ts} says it is, member by
 *     member, so an upstream change to how a collection is addressed is caught
 *     here and not by an agent whose URIs stopped resolving;
 *   - that nothing reaches the wire that was not named, which is the difference
 *     between default-deny being the framework's behaviour and being ours. The
 *     assertion is written as an EXACT set for that reason: adding a member to
 *     the surface must not quietly widen what agents can see.
 *
 * The wire-COST half of the rule in `./faces.ts` — that reading the collection
 * resource yields paths and not the corpus — cannot be seen from the expose map
 * alone, because it is a property of the adapter's verb choice. That fence lives
 * where a real server can be read: `face.test.ts`.
 */

import { createSurfaceSocket } from "@kolu/surface-app/connect"
import { resolveExpose } from "@kolu/surface-mcp"
import { collector, findSaid } from "@olai/log/testlib"
import { surface } from "@olai/surface"
import { expect, test } from "bun:test"
import { Cause, Effect, Exit } from "effect"
import { WebSocket as WsClient } from "ws"

import { AGENT, BROWSER, EXPOSE } from "./faces.ts"
import { serve } from "./serve.ts"
import { served, SERVER_LAYERS } from "./serve.testlib.ts"

const resolved = () => resolveExpose(surface.spec, EXPOSE)

test("the outlines collection is a key-set resource plus an item template", () => {
  const { resources, resourceTemplates } = resolved()

  // The key set: one URI, read through the collection's `keys` verb.
  expect(resources).toContainEqual(
    expect.objectContaining({
      uri: "surface://collections/outlines",
      kind: "collection",
      key: "outlines",
    }),
  )
  // And one file at a time. The `{id}` is a root-relative, `/`-spelled path —
  // the same spelling the store's keys and every `file:line` use — which the
  // adapter parses by splitting on the FIRST `/` after the collection name, so
  // a nested `notes/todo.jsonl` addresses without escaping.
  expect(resourceTemplates).toContainEqual(
    expect.objectContaining({
      uriTemplate: "surface://collections/outlines/{id}",
      key: "outlines",
    }),
  )
})

test("the documents collection is addressed the same way", () => {
  const { resources, resourceTemplates } = resolved()

  // The `.md` half of the directory, and the reason it is exposable at all: a
  // COLLECTION, so the key set costs the paths and a body travels only when an
  // agent asks for that one document. This is the member `manifest` used to
  // carry whole, which is why that cell is not here.
  expect(resources).toContainEqual(
    expect.objectContaining({
      uri: "surface://collections/documents",
      kind: "collection",
      key: "documents",
    }),
  )
  expect(resourceTemplates).toContainEqual(
    expect.objectContaining({
      uriTemplate: "surface://collections/documents/{id}",
      key: "documents",
    }),
  )
})

test("errors is a cell resource", () => {
  expect(resolved().resources).toContainEqual(
    expect.objectContaining({ uri: "surface://cells/errors", kind: "cell", key: "errors" }),
  )
})

test("git is a cell resource", () => {
  // Whether the writes this agent makes are reaching a history. One status and
  // at most a sentence, so it passes the cost rule twice over — and an agent
  // that can ask before writing is one that can say so instead of committing
  // nothing quietly.
  expect(resolved().resources).toContainEqual(
    expect.objectContaining({ uri: "surface://cells/git", kind: "cell", key: "git" }),
  )
})

test("pending is a cell resource, and it is the `commit` tool's other half", () => {
  // How an agent knows there is work to record and what the record will say —
  // and, through `last`, whether this directory has ever been recorded in at
  // all. Without it an agent under the default mode commits blind or shells out
  // to `git status`, which is the file access this surface exists not to have.
  // Its cost bound is argued in `./faces.ts`: O(what is dirty), not O(corpus).
  expect(resolved().resources).toContainEqual(
    expect.objectContaining({
      uri: "surface://cells/pending",
      kind: "cell",
      key: "pending",
    }),
  )
})

test("nothing else is exposed, and the set is exact", () => {
  const { resources, resourceTemplates, tools } = resolved()

  expect(resources.map((r) => r.uri).sort()).toEqual([
    "surface://cells/errors",
    "surface://cells/git",
    "surface://cells/pending",
    "surface://collections/documents",
    "surface://collections/outlines",
  ])
  expect(resourceTemplates.map((t) => t.uriTemplate).sort()).toEqual([
    "surface://collections/documents/{id}",
    "surface://collections/outlines/{id}",
  ])
  // No procedure is exposed at all: the only ones declared are the chat's, and
  // an agent does not drive the human's conversation. The tool surface arrives
  // separately, as bespoke tools over @olai/ops' own table.
  expect(tools).toEqual([])
})

test("the manifest cell is not exposed, and never was", () => {
  // Not a restatement of the test above. This one names the member and the
  // reason, so re-adding it trips a failure that explains itself rather than a
  // diff on a URI list. It used to be `NullOr({ documents: Array({file, text}) })`
  // — exposing it would have shipped every document body on every read — and
  // `snapshot-scale` has since cut those out into the collection above, leaving
  // a fact with no fields. It was never exposed and now has nothing to expose.
  expect(Object.keys(EXPOSE)).not.toContain("manifest")
  expect(resolved().resources.map((r) => r.key)).not.toContain("manifest")
})

test("the chat's state and transcript are not exposed", () => {
  const keys = resolved().resources.map((r) => r.key)
  expect(keys).not.toContain("chat")
  expect(keys).not.toContain("transcript")
})

test("every exposed key names something the spec actually declares", () => {
  // `resolveExpose` throws on a key that names no member, so this is the boot
  // check run early: a typo in the map is a failing test here rather than a
  // server that will not start on somebody's machine.
  expect(() => resolved()).not.toThrow()
})

// ── The two WIRE faces ──────────────────────────────────────────────────

/** Every member the surface declares, as the expose grammar spells them —
 *  primitives by key, procedures as `<ns>.<verb>`. Derived from the SPEC so a
 *  new member is a failure in the two tests below rather than a silent widening
 *  or a silent gap: a face's map is a decision about every member there is, and
 *  the way to keep that true is to enumerate from the surface. */
const DECLARED = (): ReadonlyArray<string> => [
  ...Object.keys(surface.spec.cells ?? {}),
  ...Object.keys(surface.spec.collections ?? {}),
  ...Object.entries(surface.spec.procedures ?? {}).flatMap(([ns, verbs]) =>
    Object.keys(verbs).map((verb) => `${ns}.${verb}`)
  ),
]

test("the browser's face is every member a page uses, and the ops door is not one", () => {
  // Exact, in both directions. A member added to the surface and forgotten here
  // is a page that cannot call it; a member added here by reflex is the widening
  // this map exists to prevent. `ops.*` is the whole reason the map exists.
  expect([...Object.keys(BROWSER)].sort()).toEqual(
    DECLARED().filter((member) => !member.startsWith("ops.")).sort(),
  )
})

test("the agent's face is what it can SEE plus the doors its tools land through", () => {
  // Derived from EXPOSE in the module, so this asserts the derivation rather
  // than restating a list: what a bridged `olai mcp` may call is exactly what
  // it serves as resources, plus the members `@olai/ops`' three tool arms reach.
  expect([...Object.keys(AGENT)].sort()).toEqual(
    [
      ...Object.keys(EXPOSE),
      "ops.run",
      "ops.commit",
      "ops.outlines",
      "ops.node",
      "ops.subtree",
      "search.nodes",
      "git.push",
    ].sort(),
  )
  // The keyboard's door is the browser's, and the agent has its own spelling of
  // both of these. Named rather than implied by the set above, so removing one
  // trips a failure that says which and why.
  expect(Object.keys(AGENT)).not.toContain("edit.apply")
  expect(Object.keys(AGENT)).not.toContain("git.commit")
  // And the human's session is the human's, on this face as on the MCP one.
  expect(Object.keys(AGENT)).not.toContain("chat")
  expect(Object.keys(AGENT)).not.toContain("transcript")
})

// ── The property, over a real browser socket ────────────────────────────

/** How long a dial or a call may take before it is a hang rather than a slow
 *  answer. Generous on purpose: what is being told apart is "refused" from
 *  "never". */
const BOUND_MS = 10_000

/** Where the listener serves the surface — its own copy, deliberately, exactly
 *  as `listener.test.ts` keeps one: a test that imported the path would agree
 *  with the server by construction, and this one speaks to it as a browser. */
const WS_PATH = "/rpc/ws"

/**
 * A real olai server, and a real websocket dialled at it the way a tab does.
 *
 * The whole stack: `serve` binds the listener, which is where `BROWSER_FACE` is
 * applied, and `createSurfaceSocket` is the same dial `@olai/web` makes — `ws`
 * standing in for the browser's `WebSocket`, which is the only substitution.
 * So what is under test is the gate as DEPLOYED, not a map compared with
 * itself.
 */
const withBrowserSocket = (
  body: (dispatch: {
    unary: (tag: string, payload: unknown) => Effect.Effect<unknown, unknown>
  }) => Promise<void>,
): Promise<void> => {
  const { layer, said } = collector()

  return Effect.gen(function*() {
    yield* serve({
      root: served(),
      port: 0,
      host: "127.0.0.1",
      clientDist: served(),
      allowedOrigins: [],
      commits: "off",
    })
    const url = String(findSaid(said, "serving")?.annotations.url)
    const socket = yield* Effect.promise(() =>
      createSurfaceSocket({
        group: surface.group,
        url: `${url.replace("http://", "ws://")}${WS_PATH}`,
        retired: () => {},
        connect: (target) => new WsClient(target) as unknown as WebSocket,
      })
    )
    yield* Effect.promise(() => body(socket.link.dispatch)).pipe(
      Effect.ensuring(Effect.promise(() => socket.dispose())),
    )
  }).pipe(
    Effect.scoped,
    Effect.provide(SERVER_LAYERS),
    Effect.provide(layer),
    Effect.timeout(BOUND_MS),
    Effect.orDie,
    Effect.runPromise,
  )
}

test("a browser calling a write verb is refused, and the same socket keeps serving", async () => {
  await withBrowserSocket(async (dispatch) => {
    // The member EXISTS on this surface and is bound on this face — that is the
    // point. A page that asks for it gets a per-request refusal naming the tag,
    // not a transport-level "no such method" it could not tell from a server
    // that is simply older than it is.
    const refused = await Effect.runPromise(
      Effect.exit(dispatch.unary("surface/ops/run", {
        request: { op: "title", id: "a", title: "renamed by a tab" },
        writer: "web",
      })),
    )
    expect(Exit.isFailure(refused)).toBe(true)
    if (Exit.isFailure(refused)) {
      expect(Cause.pretty(refused.cause)).toContain(
        `"surface/ops/run" is not exposed on this face`,
      )
    }

    // And the refusal was ONE request's answer. A gate that took the connection
    // down with it would be indistinguishable from a working gate in a test
    // that stopped at the line above, and catastrophic in a tab.
    const answered = await Effect.runPromise(
      dispatch.unary("surface/search/nodes", { text: "a" }) as Effect.Effect<
        { hits: ReadonlyArray<unknown> }
      >,
    )
    expect(answered.hits).toHaveLength(1)
  })
})

test("the keyboard's door is untouched by the gate", async () => {
  await withBrowserSocket(async (dispatch) => {
    // `edit.apply` is the browser's ONE write door and it stays open: this PR
    // adds a second vocabulary beside it rather than replacing it, and a gate
    // that shut the keyboard would be the change nobody asked for.
    const applied = await Effect.runPromise(
      dispatch.unary("surface/edit/apply", {
        verb: "title",
        id: "a",
        title: "typed by a person",
      }) as Effect.Effect<{ title: string }>,
    )
    expect(applied.title).toBe("typed by a person")
  })
})

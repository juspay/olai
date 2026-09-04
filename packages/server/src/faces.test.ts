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
import { findSaid } from "@olai/log/testlib"
import { surface } from "@olai/surface"
import { expect, test } from "bun:test"
import { Cause, Effect, Exit } from "effect"
import { WebSocket as WsClient } from "ws"

import { AGENT, BROWSER, MCP } from "./faces.ts"
import { served, withServe } from "./serve.testlib.ts"

const resolved = () => resolveExpose(surface.spec, MCP)

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
  // a nested `notes/todo.olai` addresses without escaping.
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

test("nothing else is exposed, and the set is exact", () => {
  const { resources, resourceTemplates, tools } = resolved()

  expect(resources.map((r) => r.uri).sort()).toEqual([
    "surface://cells/errors",
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
  expect(Object.keys(MCP)).not.toContain("manifest")
  expect(resolved().resources.map((r) => r.key)).not.toContain("manifest")
})

test("the heads collection is the browser's alone", () => {
  // Not a restatement of the exactness test above. This one names the member
  // and the reason, so exposing it later trips a failure that explains itself.
  // A head is "this file is at revision N" with no body on it — the question a
  // tab asks because it is KEEPING a `.html` on screen and must notice the file
  // moving under it without wanting what it now says. An agent reads a body
  // when it wants one and is told about the change on the key it already holds,
  // so a second resource carrying the revision it would then read anyway is a
  // URI published for nobody.
  expect(BROWSER["heads"]).toBe("resource")
  expect(Object.keys(MCP)).not.toContain("heads")
  expect(resolved().resources.map((r) => r.key)).not.toContain("heads")
})

test("the inbox count cell is the browser's alone", () => {
  // A badge is a paint instruction for a door somebody is looking at. An agent
  // asking what the inbox holds asks `list_outlines` and is answered with the
  // nodes.
  expect(BROWSER["inbox"]).toBe("resource")
  expect(Object.keys(MCP)).not.toContain("inbox")
  expect(resolved().resources.map((r) => r.key)).not.toContain("inbox")
})

test("the page and moving streams are the browser's alone", () => {
  // The same fence one more time, and the sharpest instance of it: what `page`
  // answers is a SCREEN — rows carrying the fold keys of the places they are
  // drawn at, a rollup beside a checkbox, the titles of the ids those rows
  // point at. An agent asking what an outline holds asks `list_outlines` and
  // `read_subtree` and is answered in NODES, which is what it can act on.
  expect(BROWSER["page"]).toBe("resource")
  expect(BROWSER["moving"]).toBe("resource")
  expect(Object.keys(MCP)).not.toContain("page")
  expect(Object.keys(MCP)).not.toContain("moving")
  const keys = resolved().resources.map((r) => r.key)
  expect(keys).not.toContain("page")
  expect(keys).not.toContain("moving")
})

test("the outlines collection is the AGENT's, and no browser reads it", () => {
  // The whole of `vault-in-browser`: a tab held every record of every file and
  // answered every page out of that copy, which is the ruling that arc
  // reversed. What a tab reads is `heads` for the directory and `page` for the
  // page it is drawing; the member is untouched for a request-shaped reader,
  // where watching one outline's records is exactly what is wanted.
  expect(Object.keys(BROWSER)).not.toContain("outlines")
  expect(MCP["outlines"]).toBe("resource")
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
  ...Object.keys(surface.spec.streams ?? {}),
  ...Object.entries(surface.spec.procedures ?? {}).flatMap(([ns, verbs]) =>
    Object.keys(verbs).map((verb) => `${ns}.${verb}`)
  ),
]

test("every member the surface declares is DECIDED by one of the faces", () => {
  // Not "the browser has everything but `ops.*`", which would make the only way
  // to pass adding a new member to the browser's map — the exact reflex a
  // default-deny gate exists to interrupt. What is asserted is that somebody
  // decided: a member no face names is served to nobody, which is either a
  // mistake or a deliberate omission, and both deserve to be noticed once.
  expect([...new Set([...Object.keys(BROWSER), ...Object.keys(AGENT)])].sort())
    .toEqual([...DECLARED()].sort())
})

test("no browser may reach the ops door, and only the agent face may", () => {
  // The one rule this whole arrangement exists for, as a rule rather than as a
  // list: whatever `ops.*` grows to, a tab gets none of it.
  const ops = DECLARED().filter((member) => member.startsWith("ops."))
  expect(ops.length).toBeGreaterThan(0)
  expect(ops.filter((member) => member in BROWSER)).toEqual([])
  expect(ops.filter((member) => !(member in AGENT))).toEqual([])
})

test("the browser's face names nothing the surface does not declare", () => {
  // `exposeFace` would refuse a stray key at boot; this says so at the moment
  // somebody types one, and names it.
  expect(Object.keys(BROWSER).filter((member) => !DECLARED().includes(member)))
    .toEqual([])
})

test("the agent's face is what it can SEE plus the doors its tools land through", () => {
  // Derived from MCP in the module, so this asserts the derivation rather
  // than restating a list: what `/mcp` may call is exactly what
  // it serves as resources, plus the members `@olai/ops`' three tool arms reach.
  expect([...Object.keys(AGENT)].sort()).toEqual(
    [
      ...Object.keys(MCP),
      "ops.run",
      "ops.outlines",
      // Not a tool of its own: the reading the `capture` tool's plan arm
      // resolves against (`perf-capture-paths`), which is a door its tools land
      // through exactly as `ops.run` is.
      "ops.paths",
      "ops.node",
      "ops.subtree",
      "ops.documents",
      "ops.document",
      "search.nodes",
      // PHASE 12's THREE, and they are the agent as AUTHOR rather than as
      // reader: what may I name, what became of what I wrote, stop the one I
      // wrote. Every one of them is about a plugin the VAULT defines; none of
      // them can define one (a definition is two notes, written with the
      // ordinary write door) and none of them can approve one.
      "plugins.inspect",
      "plugins.run",
      "plugins.stop",
    ].sort(),
  )
  // ...AND THE TWO THAT ARE A PERSON'S, asserted here because this face is
  // pinned as an exact set and an absence is only proved by the pinning. An
  // agent that could approve a plugin could approve the plugin it just wrote,
  // which is the whole boundary phase 12 has; one that could flip a row could
  // turn off the row that seats it and then not reach the face to turn it back
  // on.
  expect(Object.keys(AGENT)).not.toContain("plugins.approve")
  expect(Object.keys(AGENT)).not.toContain("plugins.set")
  expect(Object.keys(BROWSER)).toContain("plugins.approve")
  // Git's verbs left this map with the plugin. `search.nodes` is SHARED with
  // the browser and not twinned: once the writer stopped travelling with a
  // call, an agent's search and a person's are the same act through the same
  // member.
  expect(Object.keys(BROWSER)).not.toContain("git.commit")
  // The keyboard's door, though, is the browser's alone — an agent sending
  // intents about a screen it cannot see would be the one thing this whole
  // split exists to prevent.
  expect(Object.keys(AGENT)).not.toContain("edit.apply")
  // ...and so is the page filter's reading, for its own reason: it answers with
  // a set of ids and why, which is useful only to somebody already looking at
  // the rows those ids name. An agent asking which nodes match asks
  // `search_nodes` and is answered with the nodes (`./faces.ts`).
  expect(Object.keys(BROWSER)).toContain("narrowing")
  expect(Object.keys(AGENT)).not.toContain("narrowing")
  // ...and so is the transcript's id lookup, for a reason of the same shape: it
  // answers a dozen ids with the node each names, which is what a panel drawing
  // an agent's own backticks needs. An agent asking whether an id is real asks
  // `read_node` and is told everything about it.
  expect(Object.keys(BROWSER)).toContain("nodes.named")
  expect(Object.keys(AGENT)).not.toContain("nodes.named")
  // ...and so is the fold memory's, one door along: a file per id and a list of
  // paths is what a browser reconciling what it had collapsed needs, and an
  // agent that wants to know where a node lives reads it.
  expect(Object.keys(BROWSER)).toContain("nodes.homes")
  expect(Object.keys(AGENT)).not.toContain("nodes.homes")

  // ...and so is the tag completion's vocabulary, a whole group of it: what it
  // answers is a POPUP's worth of rows, as many as the widget that asked has
  // room for. An agent writing `#home` writes the word (`./faces.ts`).
  expect(Object.keys(BROWSER)).toContain("vocabulary.tags")
  expect(Object.keys(AGENT)).not.toContain("vocabulary.tags")
  // Who is looking is a fact about THIS TAB, stamped on the upgrade. An
  // agent arrives on HTTP `/mcp` and has no login header on that face.
  expect(Object.keys(BROWSER)).toContain("who.get")
  expect(Object.keys(AGENT)).not.toContain("who.get")
  // ...and so is what this deployment is CALLED, one fact over: the box's
  // name is what the tab, the wordmark and the manifest draw — a paint
  // instruction, not a fact an agent would ever act on.
  expect(Object.keys(BROWSER)).toContain("app.get")
  expect(Object.keys(AGENT)).not.toContain("app.get")
  // And the human's session is the human's, on this face as on the MCP one.
  expect(Object.keys(AGENT)).not.toContain("chat")
  expect(Object.keys(AGENT)).not.toContain("transcript")
  // ...AND SO IS THE SWITCH, which is the sharpest of the lot and the reason the
  // exact-set assertion above is worth having. An agent that could turn a plugin
  // off could turn off the row that seats it, the row that watches its writes,
  // or the row whose tools it is holding — and could not turn any of them back
  // on, because the face it was calling through went with them. The READOUT is
  // not on this face either, for the reason `./faces.ts` gives: an agent learns
  // that kolu is not running by there being no `surface/kolu/` to call.
  expect(Object.keys(BROWSER)).toContain("plugins.set")
  expect(Object.keys(AGENT)).not.toContain("plugins.set")
  expect(Object.keys(AGENT)).not.toContain("plugins")
})

// ── The property, over a real browser socket ────────────────────────────

/** Where the listener serves the surface — its own copy, deliberately, exactly
 *  as `listener.test.ts` keeps one: a test that imported the path would agree
 *  with the server by construction, and this one speaks to it as a browser. */
const WS_PATH = "/rpc/ws"

/**
 * A real olai server, and a real websocket dialled at it the way a tab does.
 *
 * The whole stack: `serve` binds the listener, which is where the browser face is
 * applied, and `createSurfaceSocket` is the same dial `@olai/web` makes — `ws`
 * standing in for the browser's `WebSocket`, which is the only substitution.
 * So what is under test is the gate as DEPLOYED, not a map compared with
 * itself.
 */
const withBrowserSocket = (
  body: (dispatch: {
    unary: (tag: string, payload: unknown) => Effect.Effect<unknown, unknown>
  }) => Promise<void>,
): Promise<void> =>
  withServe({ root: served() }, async (said) => {
    const url = String(findSaid(said, "serving")?.annotations.url)
    const socket = await createSurfaceSocket({
      group: surface.group,
      url: `${url.replace("http://", "ws://")}${WS_PATH}`,
      retired: () => {},
      connect: (target) => new WsClient(target) as unknown as WebSocket,
    })
    try {
      await body(socket.link.dispatch)
    } finally {
      await socket.dispose()
    }
  })

test("git.setPolicy is gone — not on the surface, a call cannot land", async () => {
  expect(DECLARED()).not.toContain("git.setPolicy")
  expect(Object.keys(BROWSER)).not.toContain("git.setPolicy")
  expect(surface.group.requests.has("surface/git/setPolicy")).toBe(false)

  await withBrowserSocket(async (dispatch) => {
    const refused = await Effect.runPromise(
      Effect.exit(dispatch.unary("surface/git/setPolicy", { commit: "auto" })),
    )
    expect(Exit.isFailure(refused)).toBe(true)
    if (Exit.isFailure(refused)) {
      const said = Cause.pretty(refused.cause)
      // The typed client has no schema for it. That is not a usage refusal of
      // a live procedure — those name the tag as not-exposed-on-this-face.
      expect(said).not.toContain("is not exposed on this face")
    }
  })
})

test("a browser calling a write verb is refused, and the same socket keeps serving", async () => {
  await withBrowserSocket(async (dispatch) => {
    // The member EXISTS on this surface and is bound on this face — that is the
    // point. A page that asks for it gets a per-request refusal naming the tag,
    // not a transport-level "no such method" it could not tell from a server
    // that is simply older than it is.
    const refused = await Effect.runPromise(
      Effect.exit(dispatch.unary("surface/ops/run", { op: "title", id: "a", title: "renamed by a tab" })),
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

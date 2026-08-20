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

test("the two date streams are the browser's alone", () => {
  // Not a restatement of the exactness test above — same shape as the `heads`
  // fence beside it, and the same job: exposing one later trips a failure that
  // explains itself. A month of dots and two integers about the READER's own
  // today are questions only something with a screen asks; an agent asking what
  // is late asks `search_nodes` with a date clause and is answered with the
  // nodes. They also take an input, and the `surface://` resource vocabulary
  // has nowhere to put one.
  expect(BROWSER["dated"]).toBe("resource")
  expect(BROWSER["owed"]).toBe("resource")
  expect(Object.keys(MCP)).not.toContain("dated")
  expect(Object.keys(MCP)).not.toContain("owed")
  const keys = resolved().resources.map((r) => r.key)
  expect(keys).not.toContain("dated")
  expect(keys).not.toContain("owed")
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
      "ops.node",
      "ops.subtree",
      "ops.documents",
      "ops.document",
      "search.nodes",
      "git.commit",
      "git.push",
    ].sort(),
  )
  // `git.commit` and `search.nodes` are SHARED with the browser and not twinned:
  // once the writer stopped travelling with a call, an agent's commit and a
  // person's are the same act through the same member, and only the face they
  // arrive on decides the trailer.
  expect(Object.keys(BROWSER)).toContain("git.commit")
  // The keyboard's door, though, is the browser's alone — an agent sending
  // intents about a screen it cannot see would be the one thing this whole
  // split exists to prevent.
  expect(Object.keys(AGENT)).not.toContain("edit.apply")
  // ...and so is the page filter's half of the search, for its own reason: it
  // answers with a set of ids and why, which is useful only to somebody already
  // looking at the rows those ids name. An agent asking which nodes match asks
  // `search_nodes` and is answered with the nodes (`./faces.ts`).
  expect(Object.keys(BROWSER)).toContain("search.matching")
  expect(Object.keys(AGENT)).not.toContain("search.matching")
  // ...and so is the transcript's id lookup, for a reason of the same shape: it
  // answers a dozen ids with the node each names, which is what a panel drawing
  // an agent's own backticks needs. An agent asking whether an id is real asks
  // `read_node` and is told everything about it.
  expect(Object.keys(BROWSER)).toContain("nodes.named")
  expect(Object.keys(AGENT)).not.toContain("nodes.named")

  // ...and so is the tag completion's vocabulary, a whole group of it: what it
  // answers is a POPUP's worth of rows, as many as the widget that asked has
  // room for. An agent writing `#home` writes the word (`./faces.ts`).
  expect(Object.keys(BROWSER)).toContain("vocabulary.tags")
  expect(Object.keys(AGENT)).not.toContain("vocabulary.tags")
  // And the human's session is the human's, on this face as on the MCP one.
  expect(Object.keys(AGENT)).not.toContain("chat")
  expect(Object.keys(AGENT)).not.toContain("transcript")
})

// ── The property, over a real browser socket ────────────────────────────

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

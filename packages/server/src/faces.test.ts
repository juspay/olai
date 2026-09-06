/**
 * EACH ROW'S FACE, AS THAT ROW'S EXACT SET — and, over a real socket, the
 * property the whole arrangement exists for.
 *
 * ## What this file used to be, and why none of that shape survived
 *
 * It held three hand-written allowlists — `@olai/bundle`'s `MCP`, `BROWSER` and
 * `AGENT` — and asserted the whole app's grant as ONE list: the union of the two
 * wire faces equalled every member the flat aggregate declared, and the agent's
 * face was pinned as an exact set of thirty-odd bare member names. Both claims
 * described a wire that no longer exists. #546 deleted the bare tags: a member
 * answers under `surface/<owner>/<member>/<verb>` and no other name, a row's
 * grant is that row's own `faces` map, and there is no aggregate left to take
 * the union of. A list spanning nine rows would be the second place a permission
 * is typed, which is the duplication the issue is about.
 *
 * So the questions are asked PER ROW, off the rows a real bind composed:
 *
 *   - every member a row declares is DECIDED by one of that row's faces — a
 *     member no face names is served to nobody, which is either a mistake or a
 *     deliberate omission and both deserve to be noticed once;
 *   - what each face grants on the wire is exactly that row's own map, under
 *     that row's name and nowhere else. Not a restatement of the map: it is the
 *     map compared with the tags the COMPOSER published, so a row that is built
 *     and not standing, a grant that landed under the wrong prefix, or a bare
 *     alias that came back all fail here;
 *   - and the gate as a whole is PARTITIONED by owner, with core's members the
 *     only bare ones. That is #546's regression written as a fence: a tag
 *     granted under no standing row's name is the monolith's alias returning.
 *
 * ## What is still asserted about the WHOLE app, and why it is not a list
 *
 * The named boundaries below — the switch, the approval, the keyboard's door,
 * the screen-shaped readings — are RULES over the composed gates rather than
 * entries in one. Each names a member and the reason it is on the face it is on,
 * so re-granting it trips a failure that explains itself.
 *
 * The wire-COST half of the agent's rule — that reading the collection resource
 * yields paths and not the corpus — cannot be seen from an expose map at all,
 * because it is a property of the adapter's verb choice. That fence lives where
 * a real server can be read: `./mcp/face.test.ts`.
 */

import { createSurfaceSocket } from "@kolu/surface-app/connect"
import { composeSurfaceContracts, scopeSiblingTag, type Surface, type SurfaceSpec } from "@kolu/surface/define"
import { exposeFace } from "@kolu/surface/expose"
import { resolveExpose } from "@kolu/surface-mcp"
import { AGENT_SIBLINGS } from "@olai/bundle/agent-face"
import { findSaid } from "@olai/log/testlib"
import { hostFaces, hostSurface } from "@olai/surface/host"
import { openLoading, openPlugins } from "@olai/plugin-api/services"
import { mountBundle, provide, settled } from "@olai/bundle/bundle"
import { VaultBoot } from "olai-plugin-vault/boot"
import { expect, test } from "bun:test"
import { Cause, Effect, Exit } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { WebSocket as WsClient } from "ws"

import { CONTENT_ROWS, runtimeFor } from "./capabilities.testlib.ts"
import { watchFault } from "./fault.ts"
import { hostname } from "./hostname.ts"
import { bind } from "./runtime.ts"
import { runtimePaths } from "./runtime-paths.ts"
import { served, SERVER_LAYERS, withServe } from "./serve.testlib.ts"

/**
 * THE ROWS THIS FILE IS ABOUT — the nine that registered `root: true` until
 * #546, which is to say every row whose members used to answer under a bare tag
 * as well as their own.
 *
 * `git` is deliberately not here even though a real serve composes it: its half
 * probes a repository at mount and costs this suite seven seconds for a face
 * that never had a bare alias. Its two claims are asserted where they are cheap
 * — the surface declares no `setPolicy` (below, over the socket) and its verbs
 * are its own row's (`olai-plugin-git`).
 */
const ROWS = ["vault", "vault-plugins", "search", ...CONTENT_ROWS] as const

/** One standing row, as the composer holds it: its name, the surface it
 *  registered and the face maps it registered beside it. Read off the live
 *  registration rather than imported from each package — `@olai/server` is a
 *  general package and may not name a row (`@olai/bundle`'s `fence.test.ts`),
 *  and a reading of what the row actually HANDED the host is the stronger claim
 *  anyway. */
interface Standing {
  readonly name: string
  readonly surface: Surface<SurfaceSpec>
  readonly faces: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

interface Composed {
  readonly rows: ReadonlyArray<Standing>
  /** The two gates `./serve.ts` hands its transports, from the same `bind`. */
  readonly gates: Readonly<Record<"browser" | "agent", { readonly tags: ReadonlySet<string> }>>
  /** Every tag the composed generation serves — so "granted" can be checked
   *  against "bound", which are two different tables. */
  readonly served: ReadonlyArray<string>
  /**
   * A client group over these rows, for a browser dial — the framework's own
   * per-sibling walk, and nothing fused onto it.
   *
   * It was `@olai/bundle`'s flat `surface.group` until #546 deleted that door,
   * and the aggregate was never the shape a browser's wire has: a tab dials a
   * ROOT with siblings under it. What is NOT here is core's half, and that is
   * deliberate — fusing two groups is a mechanic the framework performs and
   * olai may not spell (`@olai/bundle`'s `mechanics.test.ts`). The dial names a
   * `siblingKey` instead, which is the supported way to probe a
   * sibling-carrying wire's identity, and no case below calls a core member.
   */
  readonly group: ReturnType<typeof composeSurfaceContracts>["group"]
  /** Which sibling the dial's identity probe reads. Any key answers with the
   *  same per-process id, so this is the first one by name — a value rather
   *  than a spelling, so a row leaving the fixture cannot leave it dangling. */
  readonly siblingKey: string
}

/**
 * A REAL COMPOSITION OF THE REAL ROWS — the same `bind` `./serve.ts` calls, so
 * the gates read here are the values a transport is handed and not a second
 * derivation of them.
 *
 * In process rather than through a `serve` for one reason: a serve keeps its
 * gates to itself (they go to the ws and `/mcp` doors and nowhere a test can
 * reach), and what is under test here is the CONTENT of the grant. What a
 * socket can see is asserted over a socket, further down.
 */
const withRows = <A>(use: (composed: Composed) => Promise<A>): Promise<A> => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-faces-"))
  fs.writeFileSync(path.join(root, "a.olai"), `{"id":"a","ord":"a0","title":"a"}\n`)
  return Effect.gen(function*() {
    const plugins = yield* openPlugins({ vars: {}, now: () => "" })
    // The definitions row reads its plugins out of the vault through the
    // loader, so a serve that composes it opens one; without this the row
    // waits forever and its three verbs are absent for a reason that has
    // nothing to do with faces.
    yield* openLoading(plugins.host, [...ROWS], () => {}, {
      services: plugins.serviceKeys,
      browserServices: plugins.browserKeys,
    })
    yield* mountBundle(plugins.host, { kind: "exact", names: [...ROWS] })
    yield* provide(plugins.host, VaultBoot, () => ({ root, runtime: runtimePaths }))
    yield* settled(plugins.host, [...ROWS])
    const wired = yield* bind({
      hostname: hostname(),
      startedAt: "2026-08-29T09:31:00.000Z",
      plugins: yield* runtimeFor(plugins, [...ROWS]),
    })
    // The runtime's `done` REJECTS when it is closed, so something has to hold
    // that catch or the teardown is an unhandled rejection the runner charges
    // to whichever test happened to be running.
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))
    yield* Effect.addFinalizer(() => runtime.stopped)
    const rows = wired.bound.rows.map((row) => ({
      name: row.name,
      surface: row.surface as Surface<SurfaceSpec>,
      faces: row.faces,
    }))
    return yield* Effect.promise(() =>
      use({
        rows,
        gates: wired.faces,
        served: Object.keys(wired.bound.handlers),
        group: composeSurfaceContracts(
          Object.fromEntries(rows.map((row) => [row.name, row.surface])),
        ).group,
        siblingKey: rows.map((row) => row.name).sort()[0]!,
      })
    )
  }).pipe(Effect.scoped, Effect.provide(SERVER_LAYERS), Effect.runPromise).finally(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })
}

/** Every member a spec declares, as the expose grammar spells them —
 *  primitives by key, procedures as `<ns>.<verb>`. Derived from the SPEC so a
 *  new member is a failure below rather than a silent widening or a silent gap:
 *  a face's map is a decision about every member there is, and enumerating from
 *  the surface is what keeps that true. */
const declaredIn = (surface: Surface<SurfaceSpec>): ReadonlyArray<string> => {
  const spec = surface.spec as {
    readonly cells?: Readonly<Record<string, unknown>>
    readonly collections?: Readonly<Record<string, unknown>>
    readonly streams?: Readonly<Record<string, unknown>>
    readonly procedures?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  }
  return [
    ...Object.keys(spec.cells ?? {}),
    ...Object.keys(spec.collections ?? {}),
    ...Object.keys(spec.streams ?? {}),
    ...Object.entries(spec.procedures ?? {}).flatMap(([ns, verbs]) =>
      Object.keys(verbs).map((verb) => `${ns}.${verb}`)
    ),
  ]
}

/** What one face's map on one surface comes to as WIRE TAGS, under the owner's
 *  name — the two moves `./composition.ts` makes, in the order it makes them.
 *
 *  A `name` of `null` is the HOST ROOT, whose members keep their bare
 *  `surface/<member>/<verb>`: a root is not a sibling and has no owner segment,
 *  which is the whole difference between core's grant and a row's. */
const grantOf = (
  surface: Surface<SurfaceSpec>,
  name: string | null,
  map: Readonly<Record<string, unknown>> | undefined,
): ReadonlyArray<string> =>
  map === undefined ? [] : [...exposeFace(surface, map as never).tags]
    .map((tag) => name === null ? tag : scopeSiblingTag(tag, name)).sort()

/** The tags a composed gate grants under one row's prefix. */
const under = (
  gate: { readonly tags: ReadonlySet<string> },
  name: string,
): ReadonlyArray<string> =>
  [...gate.tags].filter((tag) => tag.startsWith(`surface/${name}/`)).sort()

// ── each row's face, as that row's exact set ────────────────────────────

test("every row this build composes is standing, so the claims below are about something", async () => {
  await withRows(async ({ rows }) => {
    // The list is the fixture's, and it is asserted because every case below is
    // a `for` over what actually mounted: a row that quietly failed to settle
    // would make its own claims vacuous rather than red.
    expect(rows.map((row) => row.name).sort()).toEqual([...ROWS].sort())
  })
})

test("every member a row declares is DECIDED by one of that row's faces", async () => {
  await withRows(async ({ rows }) => {
    // Not "the browser has everything but `ops.*`", which would make the only
    // way to pass adding a new member to the browser's map — the exact reflex a
    // default-deny gate exists to interrupt. What is asserted is that somebody
    // decided.
    //
    // PER ROW, because there is nothing else left to ask it of: this was one
    // assertion over `@olai/bundle`'s flat aggregate, and the aggregate went
    // with the bare tags it described.
    for (const row of [...rows, { name: "core", surface: hostSurface as Surface<SurfaceSpec>, faces: hostFaces as Standing["faces"] }]) {
      const decided = [...new Set(Object.values(row.faces).flatMap((map) => Object.keys(map)))].sort()
      expect({ row: row.name, decided }).toEqual({ row: row.name, decided: [...declaredIn(row.surface)].sort() })
    }
  })
})

test("what a row grants on the wire is its own map, under its own name", async () => {
  await withRows(async ({ rows, gates, served }) => {
    for (const row of rows) {
      for (const face of ["browser", "agent"] as const) {
        // THE COMPOSER'S OUTPUT AGAINST THE ROW'S OWN DECLARATION, which is not
        // a restatement of either: a row that registered a different map than it
        // exports, a grant that landed under the wrong prefix, or a second
        // grant reaching this row's members from somewhere else all fail here.
        expect({ row: row.name, face, tags: under(gates[face], row.name) })
          .toEqual({ row: row.name, face, tags: grantOf(row.surface, row.name, row.faces[face]) })
      }
    }
    // ...and a granted tag is a BOUND tag. An exposure describes a group as a
    // set equality, so a grant naming something the generation does not serve
    // is not a member refused — it is `restrictHandlers` refusing the socket.
    const bound = new Set(served)
    for (const face of ["browser", "agent"] as const) {
      expect({ face, unserved: [...gates[face].tags].filter((tag) => !bound.has(tag)) })
        .toEqual({ face, unserved: [] })
    }
  })
})

test("the gate is partitioned by owner, and only core's members are bare", async () => {
  await withRows(async ({ rows, gates }) => {
    // THIS IS #546 WRITTEN AS A FENCE. Nine rows registered `root: true`, which
    // kept every member of theirs answering under a BARE tag as well as its own
    // — `surface/edit/apply` beside `surface/outlines/edit/apply` — and granted
    // both. A bare tag that is not core's is that alias returning, and it is the
    // one failure this whole change is guarding against.
    const owners = rows.map((row) => `surface/${row.name}/`)
    const core = new Set(
      Object.values(hostFaces as Standing["faces"])
        .flatMap((map) => grantOf(hostSurface as Surface<SurfaceSpec>, null, map)),
    )
    for (const face of ["browser", "agent"] as const) {
      const stray = [...gates[face].tags].filter((tag) =>
        !owners.some((prefix) => tag.startsWith(prefix)) && !core.has(tag)
      )
      expect({ face, stray }).toEqual({ face, stray: [] })
    }
    // ...and core's own grant is the bare one, which is the other half: the
    // HOST ROOT is not a sibling and its members have no owner segment.
    expect([...gates.browser.tags]).toContain("surface/plugins/set")
    expect([...gates.browser.tags]).toContain("surface/who/get")
    expect([...gates.browser.tags]).toContain("surface/app/get")
  })
})

test("no browser reaches an ops door, and only the agent face may", async () => {
  await withRows(async ({ rows, gates }) => {
    // The one rule this whole arrangement exists for, as a rule rather than as a
    // list: whatever `ops.*` grows to, on whichever row grows it, a tab gets
    // none of it.
    const ops = rows.flatMap((row) =>
      declaredIn(row.surface).filter((member) => member.startsWith("ops."))
        .map((member) => scopeSiblingTag(`surface/${member.replace(".", "/")}`, row.name))
    )
    expect(ops.length).toBeGreaterThan(0)
    expect(ops.filter((tag) => gates.browser.tags.has(tag))).toEqual([])
    expect(ops.filter((tag) => !gates.agent.tags.has(tag))).toEqual([])
  })
})

// ── the named boundaries ────────────────────────────────────────────────

test("the plugin switch and the approval are a person's, and the three author verbs are an agent's", async () => {
  await withRows(async ({ gates }) => {
    // THE SWITCH is the sharpest of the lot. An agent that could turn a plugin
    // off could turn off the row that seats it, the row that watches its writes,
    // or the row whose tools it is holding — and could not turn any of them back
    // on, because the face it was calling through went with them. The READOUT is
    // not on the agent face either: an agent learns that kolu is not running by
    // there being no `surface/kolu/` to call.
    expect(gates.browser.tags.has("surface/plugins/set")).toBe(true)
    expect(gates.agent.tags.has("surface/plugins/set")).toBe(false)
    expect(gates.agent.tags.has("surface/plugins/get")).toBe(false)

    // ...AND THE APPROVAL, one narrowing over. An agent that could approve a
    // plugin could approve the plugin it just wrote, which is the whole boundary
    // phase 12 has.
    //
    // `surface/vault-plugins/plugins/…` doubles the word on purpose: the ROW is
    // `vault-plugins` and the MEMBER it declares is `plugins`. It is the one
    // member name in the tree with two owners — core's cell and switch are the
    // BARE `surface/plugins/…` asserted above — and keeping both spellings in
    // one test is what makes the collision impossible to read past.
    expect(gates.browser.tags.has("surface/vault-plugins/plugins/approve")).toBe(true)
    expect(gates.agent.tags.has("surface/vault-plugins/plugins/approve")).toBe(false)

    // PHASE 12's THREE, and they are the agent as AUTHOR rather than as reader:
    // what may I name, what became of what I wrote, stop the one I wrote. Every
    // one of them is about a plugin the VAULT defines; none of them can define
    // one (a definition is two notes, written with the ordinary write door).
    for (const verb of ["inspect", "run", "stop"]) {
      expect(gates.agent.tags.has(`surface/vault-plugins/plugins/${verb}`)).toBe(true)
    }
  })
})

test("the keyboard's door is nobody's but the browser's, on every row that has one", async () => {
  await withRows(async ({ rows, gates }) => {
    // `edit.apply` is the browser's ONE write door and six rows carry their own.
    // An agent sending intents about a screen it cannot see would be the one
    // thing this whole split exists to prevent — so this is asked of every row
    // that declares the member rather than of a list somebody keeps up to date.
    const doors = rows.filter((row) => declaredIn(row.surface).includes("edit.apply"))
      .map((row) => `surface/${row.name}/edit/apply`)
    expect(doors.length).toBeGreaterThan(0)
    expect(doors.filter((tag) => !gates.browser.tags.has(tag))).toEqual([])
    expect(doors.filter((tag) => gates.agent.tags.has(tag))).toEqual([])
  })
})

test("the screen-shaped readings are the browser's, and the agent is answered in nodes", async () => {
  await withRows(async ({ gates }) => {
    // Each of these answers a SCREEN rather than a fact, and the agent has the
    // node-shaped question instead. `page` is the sharpest: rows carrying the
    // fold keys of the places they are drawn at, a rollup beside a checkbox, the
    // titles of the ids those rows point at — an agent asks `outlines_map` and
    // `outlines_subtree` and is answered in NODES, which is what it can act on.
    // `narrowing` and `searchResults` answer a set of ids and why, useful only to
    // somebody already looking at the rows those ids name; `tagCompletions` and
    // `vocabulary.tags` answer a POPUP's worth of rows, and an agent writing
    // `#home` writes the word; `nodes.named` answers a dozen ids for a panel
    // drawing an agent's own backticks, and `nodes.homes` is the fold memory's.
    // `inbox` is a badge — a paint instruction for a door somebody is looking
    // at. `heads` is "this file is at revision N" with no body on it, which is
    // what a tab KEEPING a `.html` on screen needs and what an agent gets for
    // free on the key it already holds. `manifest` is the never-loaded bit.
    for (
      const tag of [
        "surface/outlines/page/get",
        "surface/outlines/moving/get",
        "surface/outlines/narrowing/get",
        "surface/outlines/tagCompletions/get",
        "surface/outlines/vocabulary/tags",
        "surface/outlines/nodes/named",
        "surface/outlines/nodes/homes",
        "surface/search/searchResults/get",
        "surface/capture/inbox/get",
        "surface/pins/pins/get",
        "surface/markdown/documentPage/get",
        "surface/vault/heads/get",
        "surface/vault/manifest/get",
        // Who is looking is a fact about THIS TAB, stamped on the upgrade; an
        // agent arrives on HTTP `/mcp` with no login header on that face. And
        // what this deployment is CALLED is a paint instruction — the tab, the
        // wordmark, the manifest — never a fact an agent would act on.
        "surface/who/get",
        "surface/app/get",
      ]
    ) {
      expect({ tag, browser: gates.browser.tags.has(tag), agent: gates.agent.tags.has(tag) })
        .toEqual({ tag, browser: true, agent: false })
    }
  })
})

test("the outlines collection is the AGENT's, and the two shared members are shared", async () => {
  await withRows(async ({ gates }) => {
    // The whole of `vault-in-browser`: a tab held every record of every file and
    // answered every page out of that copy, which is the ruling that arc
    // reversed. What a tab reads is `heads` for the directory and `page` for the
    // page it is drawing; the member is untouched for a request-shaped reader,
    // where watching one outline's records is exactly what is wanted.
    expect(gates.agent.tags.has("surface/outlines/outlines/keys")).toBe(true)
    expect(gates.browser.tags.has("surface/outlines/outlines/keys")).toBe(false)

    // ...and the two that genuinely are one member with two readers. `errors` is
    // what is wrong across the set right now — the browser draws it as a banner
    // over its last-good tree and an agent reads the identical rows off
    // `surface://cells/vault/errors`, which is what makes "MCP and Web ops must be
    // consistent" a property of one line. `search.nodes` stopped being twinned
    // once the writer stopped travelling with a call: an agent's search and a
    // person's are the same act through the same member.
    for (const tag of ["surface/vault/errors/get", "surface/search/search/nodes", "surface/markdown/documents/keys"]) {
      expect({ tag, browser: gates.browser.tags.has(tag), agent: gates.agent.tags.has(tag) })
        .toEqual({ tag, browser: true, agent: true })
    }
  })
})

// ── what an agent is PUBLISHED as resources ─────────────────────────────
//
// The other axis, and the one the `ExposeMap` alone decides: which members are
// offered as `surface://` URIs at all. What the rows' `faces.agent` maps above
// decide is whether an agent may REACH a member; this decides whether it is
// published.
//
// IT WAS ONE MAP OVER ONE SPEC — `@olai/bundle`'s `MCP`, then
// `olai-plugin-mcp`'s `AGENT_EXPOSE` over that row's flat contract — because
// `serveSurfaceAsMcp` built every URI out of ONE spec's member keys.
// juspay/kolu#2234 takes a rooted bundle instead, so each row's OWN `resources`
// map is resolved against that ROW's spec, WITH the row's key, and every URI
// below carries it. Two rows publishing the same member key are disjoint by
// construction rather than by a curator picking one.

/** Each row's half of the published set, resolved as the served face resolves
 *  it and as `../dial.ts` resolves it on the CLI side — same function, same
 *  maps, same keys, which is what keeps a URI the CLI names one the server
 *  answers. */
const perRow = () =>
  Object.entries(AGENT_SIBLINGS).map(([key, sibling]) =>
    resolveExpose(sibling.surface.spec as never, sibling.expose as never, key)
  )

/** ...and the whole set, as one face publishes it. */
const resolved = () => ({
  resources: perRow().flatMap((one) => one.resources),
  resourceTemplates: perRow().flatMap((one) => one.resourceTemplates),
  tools: perRow().flatMap((one) => one.tools),
})

test("each published member is addressed by the kind it actually is", () => {
  const { resources, resourceTemplates } = resolved()

  // A COLLECTION, not a cell, and that is the whole rule rather than a detail:
  // the key set costs the paths and a body travels only when an agent asks for
  // that one entry. The `{id}` is a root-relative, `/`-spelled path — the same
  // spelling the store's keys and every `file:line` use — which the adapter
  // parses by splitting on the FIRST `/` after the collection name, so a nested
  // `notes/todo.olai` addresses without escaping.
  //
  // THE ROW IS THE FIRST SEGMENT after the kind, and the member follows it —
  // `outlines/outlines` reads like a repetition because the row and its member
  // are both called `outlines`, not because a segment is doubled.
  for (const [row, key] of [["outlines", "outlines"], ["markdown", "documents"]] as const) {
    expect(resources).toContainEqual(
      expect.objectContaining({ uri: `surface://collections/${row}/${key}`, kind: "collection", key }),
    )
    expect(resourceTemplates).toContainEqual(
      expect.objectContaining({ uriTemplate: `surface://collections/${row}/${key}/{id}`, key }),
    )
  }
  expect(resources).toContainEqual(
    expect.objectContaining({ uri: "surface://cells/vault/errors", kind: "cell", key: "errors" }),
  )
})

test("nothing else is published, and the set is exact", () => {
  const { resources, resourceTemplates, tools } = resolved()

  expect(resources.map((r) => r.uri).sort()).toEqual([
    "surface://cells/vault/errors",
    "surface://collections/markdown/documents",
    "surface://collections/outlines/outlines",
  ])
  expect(resourceTemplates.map((t) => t.uriTemplate).sort()).toEqual([
    "surface://collections/markdown/documents/{id}",
    "surface://collections/outlines/outlines/{id}",
  ])
  // No procedure is published as a resource: the call-shaped half of this face
  // arrives separately, as the rows' own bespoke tools.
  expect(tools).toEqual([])
  // `manifest` is the member the cost rule was written about, and it is not on
  // this contract at all. It used to be `NullOr({ documents: Array({file,
  // text}) })` — publishing it would have shipped every document body on every
  // read — and `snapshot-scale` cut those into the collection above, leaving a
  // fact with no fields. It was never published and now has nothing to publish.
  // Asked of the row that DECLARES it — vault's own `resources` map, which is
  // where the decision lives now that there is no flat contract to keep it out
  // of. A member absent from the row's map is absent from the bundle.
  expect(Object.keys(AGENT_SIBLINGS.vault.expose)).not.toContain("manifest")
  expect(resolved().resources.map((r) => r.key)).not.toContain("manifest")
})

test("every published key names something the contract actually declares", () => {
  // `resolveExpose` throws on a key that names no member, so this is the boot
  // check run early: a typo in the map is a failing test here rather than a
  // server that will not start on somebody's machine.
  expect(() => resolved()).not.toThrow()
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
 *
 * THE CLIENT'S GROUP IS COMPOSED, not aggregated. It was `@olai/bundle`'s flat
 * `surface.group` — one spec holding every row's members under bare names —
 * until #546 deleted that door, and a browser's wire was never that shape: it is
 * a ROOT plus siblings, which is what `connectSurfaces` builds for the real tab
 * and what {@link withRows} hands over here. Standing the rows up in process to
 * learn their specs costs half a second and keeps this file free of any row's
 * name, which `@olai/bundle`'s `fence.test.ts` requires of a general package.
 */
const withBrowserSocket = (
  body: (dispatch: {
    unary: (tag: string, payload: unknown) => Effect.Effect<unknown, unknown>
  }, group: Composed["group"]) => Promise<void>,
): Promise<void> =>
  withRows(({ group, siblingKey }) =>
    withServe({ root: served() }, async (said) => {
      const url = String(findSaid(said, "serving")?.annotations.url)
      const socket = await createSurfaceSocket({
        group,
        siblingKey,
        url: `${url.replace("http://", "ws://")}${WS_PATH}`,
        retired: () => {},
        connect: (target) => new WsClient(target) as unknown as WebSocket,
      })
      try {
        await body(socket.link.dispatch, group)
      } finally {
        await socket.dispose()
      }
    })
  )

test("git.setPolicy is gone — not on the surface, a call cannot land", async () => {
  await withBrowserSocket(async (dispatch, group) => {
    expect(group.requests.has("surface/git/setPolicy")).toBe(false)

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
    //
    // `surface/outlines/ops/run` and not the bare `surface/ops/run` this named
    // until #546: the bare tag was the root mount's alias, nothing serves it,
    // and a refusal for a tag that does not exist would be the WRONG refusal —
    // it would pass this test while proving the opposite of what it claims.
    const refused = await Effect.runPromise(
      Effect.exit(dispatch.unary("surface/outlines/ops/run", { op: "title", id: "a", title: "renamed by a tab" })),
    )
    expect(Exit.isFailure(refused)).toBe(true)
    if (Exit.isFailure(refused)) {
      expect(Cause.pretty(refused.cause)).toContain(
        `"surface/outlines/ops/run" is not exposed on this face`,
      )
    }

    // And the refusal was ONE request's answer. A gate that took the connection
    // down with it would be indistinguishable from a working gate in a test
    // that stopped at the line above, and catastrophic in a tab.
    const answered = await Effect.runPromise(
      dispatch.unary("surface/search/search/nodes", { text: "a" }) as Effect.Effect<
        { hits: ReadonlyArray<unknown> }
      >,
    )
    expect(answered.hits).toHaveLength(1)
  })
})

test("the keyboard's door is untouched by the gate", async () => {
  await withBrowserSocket(async (dispatch) => {
    // `edit.apply` is the browser's ONE write door and it stays open: the ops
    // vocabulary sits beside it rather than replacing it, and a gate that shut
    // the keyboard would be the change nobody asked for.
    const applied = await Effect.runPromise(
      dispatch.unary("surface/outlines/edit/apply", {
        verb: "title",
        id: "a",
        title: "typed by a person",
      }) as Effect.Effect<{ title: string }>,
    )
    expect(applied.title).toBe("typed by a person")
  })
})

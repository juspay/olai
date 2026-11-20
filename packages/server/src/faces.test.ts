import { selectFixtureRows } from "@olai/bundle/testlib"
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

const ROWS = ["vault", "vault-plugins", "search", ...CONTENT_ROWS] as const

interface Standing {
  readonly name: string
  readonly surface: Surface<SurfaceSpec>
  readonly faces: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

interface Composed {
  readonly rows: ReadonlyArray<Standing>
  readonly gates: Readonly<Record<"browser" | "agent", { readonly tags: ReadonlySet<string> }>>
  readonly served: ReadonlyArray<string>
  readonly group: ReturnType<typeof composeSurfaceContracts>["group"]
  readonly siblingKey: string
}

const withRows = <A>(use: (composed: Composed) => Promise<A>): Promise<A> => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-faces-"))
  fs.writeFileSync(path.join(root, "a.olai"), `{"id":"a","ord":"a0","title":"a"}\n`)
  return Effect.gen(function*() {
    const plugins = yield* openPlugins({ vars: {}, now: () => "" })
    yield* openLoading(plugins.host, [...ROWS], () => {}, {
      services: plugins.serviceKeys,
      browserServices: plugins.browserKeys,
    })
    yield* mountBundle(plugins.host, selectFixtureRows([...ROWS]))
    yield* provide(plugins.host, VaultBoot, () => ({ root, runtime: runtimePaths }))
    yield* settled(plugins.host, [...ROWS])
    const wired = yield* bind({
      hostname: hostname(),
      startedAt: "2026-08-29T09:31:00.000Z",
      plugins: yield* runtimeFor(plugins, [...ROWS]),
    })
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => runtime.close)
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

const grantOf = (
  surface: Surface<SurfaceSpec>,
  name: string | null,
  map: Readonly<Record<string, unknown>> | undefined,
): ReadonlyArray<string> =>
  map === undefined ? [] : [...exposeFace(surface, map as never).tags]
    .map((tag) => name === null ? tag : scopeSiblingTag(tag, name)).sort()

const under = (
  gate: { readonly tags: ReadonlySet<string> },
  name: string,
): ReadonlyArray<string> =>
  [...gate.tags].filter((tag) => tag.startsWith(`surface/${name}/`)).sort()

test("every surface-bearing row this fixture composes is standing", async () => {
  await withRows(async ({ rows }) => {
    expect(rows.map((row) => row.name).sort()).toEqual(["vault", "vault-plugins", "search", "outlines", "markdown", "files", "pins", "capture", "trash"].sort())
  })
})

test("every member a row declares is DECIDED by one of that row's faces", async () => {
  await withRows(async ({ rows }) => {
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
        expect({ row: row.name, face, tags: under(gates[face], row.name) })
          .toEqual({ row: row.name, face, tags: grantOf(row.surface, row.name, row.faces[face]) })
      }
    }
    const bound = new Set(served)
    for (const face of ["browser", "agent"] as const) {
      expect({ face, unserved: [...gates[face].tags].filter((tag) => !bound.has(tag)) })
        .toEqual({ face, unserved: [] })
    }
  })
})

test("the gate is partitioned by owner, and only core's members are bare", async () => {
  await withRows(async ({ rows, gates }) => {
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
    expect([...gates.browser.tags]).toContain("surface/plugins/set")
    expect([...gates.browser.tags]).toContain("surface/who/get")
    expect([...gates.browser.tags]).toContain("surface/app/get")
  })
})

test("no browser reaches an ops door, and only the agent face may", async () => {
  await withRows(async ({ rows, gates }) => {
    const ops = rows.flatMap((row) =>
      declaredIn(row.surface).filter((member) => member.startsWith("ops."))
        .map((member) => scopeSiblingTag(`surface/${member.replace(".", "/")}`, row.name))
    )
    expect(ops.length).toBeGreaterThan(0)
    expect(ops.filter((tag) => gates.browser.tags.has(tag))).toEqual([])
    expect(ops.filter((tag) => !gates.agent.tags.has(tag))).toEqual([])
  })
})

test("the plugin switch and the approval are a person's, and the three author verbs are an agent's", async () => {
  await withRows(async ({ gates }) => {
    expect(gates.browser.tags.has("surface/plugins/set")).toBe(true)
    expect(gates.agent.tags.has("surface/plugins/set")).toBe(false)
    expect(gates.agent.tags.has("surface/plugins/get")).toBe(false)

    expect(gates.browser.tags.has("surface/vault-plugins/plugins/approve")).toBe(true)
    expect(gates.agent.tags.has("surface/vault-plugins/plugins/approve")).toBe(false)

    for (const verb of ["mint", "ask"]) {
      expect(gates.browser.tags.has(`surface/vault-plugins/plugins/${verb}`)).toBe(true)
      expect(gates.agent.tags.has(`surface/vault-plugins/plugins/${verb}`)).toBe(false)
    }

    for (const verb of ["guide", "inspect", "write", "run", "stop"]) {
      expect(gates.agent.tags.has(`surface/vault-plugins/plugins/${verb}`)).toBe(true)
      expect(gates.browser.tags.has(`surface/vault-plugins/plugins/${verb}`)).toBe(false)
    }
  })
})

test("the keyboard's door is nobody's but the browser's, on every row that has one", async () => {
  await withRows(async ({ rows, gates }) => {
    const doors = rows.filter((row) => declaredIn(row.surface).includes("edit.apply"))
      .map((row) => `surface/${row.name}/edit/apply`)
    expect(doors.length).toBeGreaterThan(0)
    expect(doors.filter((tag) => !gates.browser.tags.has(tag))).toEqual([])
    expect(doors.filter((tag) => gates.agent.tags.has(tag))).toEqual([])
  })
})

test("the screen-shaped readings are the browser's, and the agent is answered in nodes", async () => {
  await withRows(async ({ gates }) => {
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
    expect(gates.agent.tags.has("surface/outlines/outlines/keys")).toBe(true)
    expect(gates.browser.tags.has("surface/outlines/outlines/keys")).toBe(false)

    for (const tag of ["surface/vault/errors/get", "surface/search/search/nodes", "surface/markdown/documents/keys"]) {
      expect({ tag, browser: gates.browser.tags.has(tag), agent: gates.agent.tags.has(tag) })
        .toEqual({ tag, browser: true, agent: true })
    }
  })
})

const perRow = () =>
  Object.entries(AGENT_SIBLINGS).map(([key, sibling]) =>
    resolveExpose(sibling.surface.spec as never, (sibling.expose ?? {}) as never, key)
  )

const resolved = () => ({
  resources: perRow().flatMap((one) => one.resources),
  resourceTemplates: perRow().flatMap((one) => one.resourceTemplates),
  tools: perRow().flatMap((one) => one.tools),
})

test("each published member is addressed by the kind it actually is", () => {
  const { resources, resourceTemplates } = resolved()

  for (const [row, key] of [["outlines", "outlines"], ["markdown", "documents"]] as const) {
    expect(resources).toContainEqual(
      expect.objectContaining({ uri: `surface://collections/${row}/${key}`, kind: "collection", key }),
    )
    expect(resourceTemplates).toContainEqual(
      expect.objectContaining({ uriTemplate: `surface://collections/${row}/${key}/{+id}`, key }),
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
    "surface://collections/markdown/documents/{+id}",
    "surface://collections/outlines/outlines/{+id}",
  ])
  expect(tools).toEqual([])
  expect(Object.keys(AGENT_SIBLINGS.vault.expose)).not.toContain("manifest")
  expect(resolved().resources.map((r) => r.key)).not.toContain("manifest")
})

test("every published key names something the contract actually declares", () => {
  expect(() => resolved()).not.toThrow()
})

const WS_PATH = "/rpc/ws"

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
      expect(said).not.toContain("is not exposed on this face")
    }
  })
})

test("a browser calling a write verb is refused, and the same socket keeps serving", async () => {
  await withBrowserSocket(async (dispatch) => {
    const refused = await Effect.runPromise(
      Effect.exit(dispatch.unary("surface/outlines/ops/run", { op: "title", id: "a", title: "renamed by a tab" })),
    )
    expect(Exit.isFailure(refused)).toBe(true)
    if (Exit.isFailure(refused)) {
      expect(Cause.pretty(refused.cause)).toContain(
        `"surface/outlines/ops/run" is not exposed on this face`,
      )
    }

    const answered = await Effect.runPromise(
      dispatch.unary("surface/search/search/nodes", { text: "a", kind: "node" }) as Effect.Effect<
        { hits: ReadonlyArray<unknown> }
      >,
    )
    expect(answered.hits).toHaveLength(1)
  })
})

test("the keyboard's door is untouched by the gate", async () => {
  await withBrowserSocket(async (dispatch) => {
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

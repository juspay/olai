import { selectFixtureRows } from "@olai/bundle/testlib"
import { VaultBoot } from "olai-plugin-vault/boot"
import { CONTENT_ROWS, runtimeFor } from "../capabilities.testlib.ts"
import { runtimePaths } from "../runtime-paths.ts"
import { type Store, type Ops } from "@olai/ops"
import { mountBundle, provide, offered, settled } from "@olai/bundle/bundle"
import { openPlugins, Directory, Ops as OpsDoor } from "@olai/plugin-api/services"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { ResourceUpdatedNotificationSchema } from "@modelcontextprotocol/sdk/types.js"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { watchFault } from "../fault.ts"
import { hostname } from "../hostname.ts"
import { bind } from "../runtime.ts"
import { SERVER_LAYERS } from "../serve.testlib.ts"
import { clientsFor, siblingsOf, type Row } from "olai-plugin-mcp/testlib"
import { serveFace } from "olai-plugin-mcp/testlib"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets"}`,
  "",
].join("\n")

const GARDEN = `{"id":"beds","ord":"a0","title":"Raised beds"}\n`

const BODY_MARKER = "BODY-THAT-MUST-NOT-TRAVEL"

const MANUAL = `# Manual\n\n${`${BODY_MARKER} filler filler filler.\n`.repeat(1200)}`

const SAVED = `<h1>Saved</h1>\n<p>${BODY_MARKER} inlined.</p>\n`

const served = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-face-"))
  fs.writeFileSync(path.join(root, "house.olai"), HOUSE)
  fs.writeFileSync(path.join(root, "garden.olai"), GARDEN)
  fs.writeFileSync(path.join(root, "manual.md"), MANUAL)
  fs.writeFileSync(path.join(root, "saved.html"), SAVED)
  return root
}

interface Face {
  readonly client: Client
  readonly refresh: () => Promise<void>
  readonly root: string
}

const withFace = <A>(use: (face: Face) => Promise<A>): Promise<A> =>
  Effect.gen(function*() {
    const root = served()
    const plugins = yield* openPlugins({ vars: {}, now: () => "" })
    yield* mountBundle(plugins.host, selectFixtureRows(["vault", ...CONTENT_ROWS]))
    yield* provide(plugins.host, VaultBoot, () => ({root, runtime: runtimePaths}))
    yield* settled(plugins.host, ["vault", ...CONTENT_ROWS])
    const store = offered(plugins.host, Directory)!.store as Store
    yield* store.refresh("verified")
    const ops = offered(plugins.host, OpsDoor)!.gate as Ops
    const wired = yield* bind({
      hostname: hostname(),
      startedAt: "2026-08-29T09:31:00.000Z",
      plugins: yield* runtimeFor(plugins, ["vault", ...CONTENT_ROWS]),
    })
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))

    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    const rows = (): ReadonlyArray<Row> =>
      wired.bound.rows.map(row => ({ name: row.name, surface: row.surface, resources: row.resources ?? {}, tools: row.tools ?? [], charter: row.charter }))
    yield* serveFace({
      siblings: siblingsOf(rows(), () => ({})),
      client: () => clientsFor(
        rows(),
        () => ({ group: wired.bound.group, handlers: wired.bound.handlers, writes: wired.bound.writes, expose: wired.faces.agent }),
        { writer: "mcp" },
      ),
      rows,
      transport: serverSide,
    })

    const client = new Client({ name: "face.test", version: "0" })
    yield* Effect.promise(() => client.connect(clientSide))
    yield* Effect.addFinalizer(() => Effect.promise(() => client.close()))
    yield* Effect.addFinalizer(() => runtime.stopped)

    return yield* Effect.promise(() =>
      use({
        client,
        refresh: () => Effect.runPromise(Effect.orDie(store.refresh("cheap"))),
        root,
      })
    )
  }).pipe(Effect.scoped, Effect.provide(SERVER_LAYERS), Effect.runPromise)

const textOf = async (client: Client, uri: string): Promise<string> => {
  const answer = await client.readResource({ uri })
  const first = answer.contents[0]
  if (first === undefined || !("text" in first)) {
    throw new Error(`${uri}: expected one text part, got ${JSON.stringify(answer.contents)}`)
  }
  expect(first.mimeType).toBe("application/json")
  return first.text
}

const readJson = async (client: Client, uri: string): Promise<unknown> =>
  JSON.parse(await textOf(client, uri))

test("the served resources are exactly the allowlist names, each under its own row", async () => {
  await withFace(async ({ client }) => {
    const listed = await client.listResources()
    expect(listed.resources.map((r) => r.uri).sort()).toEqual([
      "surface://cells/vault/errors",
      "surface://collections/markdown/documents",
      "surface://collections/outlines/outlines",
    ])

    const templates = await client.listResourceTemplates()
    expect(templates.resourceTemplates.map((t) => t.uriTemplate).sort()).toEqual([
      "surface://collections/markdown/documents/{+id}",
      "surface://collections/outlines/outlines/{+id}",
    ])
  })
}, 30_000)

test("reading the outlines collection costs the KEY SET, not the corpus", async () => {
  await withFace(async ({ client }) => {
    const text = await textOf(client, "surface://collections/outlines/outlines")

    expect(JSON.parse(text).sort()).toEqual(["garden.olai", "house.olai"])

    expect(text).not.toContain(BODY_MARKER)
    expect(text.length).toBeLessThan(1024)
  })
}, 30_000)

test("one outline item is that file's nodes, and no other file's", async () => {
  await withFace(async ({ client }) => {
    const entry = await readJson(
      client,
      "surface://collections/outlines/outlines/house.olai",
    ) as { rev: number; nodes: ReadonlyArray<{ node: { title: string } }>; broken: unknown }

    expect(entry.nodes.map((n) => n.node.title)).toEqual([
      "Kitchen remodel",
      "order the cabinets",
    ])
    expect(entry.broken).toBeNull()
    expect(entry.rev).toBeGreaterThan(0)
  })
}, 30_000)

test("the errors cell reads as a live value", async () => {
  await withFace(async ({ client }) => {
    expect(await readJson(client, "surface://cells/vault/errors")).toEqual({ findings: [] })
  })
}, 30_000)

test("a directory that cannot be read reaches the agent, not just the browser", async () => {
  await withFace(async ({ client, refresh, root }) => {
    fs.rmSync(root, { recursive: true, force: true })
    await refresh().catch(() => {})

    const errors = await readJson(client, "surface://cells/vault/errors")
    expect(errors).toEqual({
      findings: [
        expect.objectContaining({ code: "unreadable-directory", file: ".", line: 0 }),
      ],
    })
  })
}, 30_000)

test("an edited outline notifies its subscribers", async () => {
  await withFace(async ({ client, refresh, root }) => {
    const uri = "surface://collections/outlines/outlines/house.olai"

    const updated = new Promise<string>((resolve) => {
      client.setNotificationHandler(
        ResourceUpdatedNotificationSchema,
        (note) => resolve(note.params.uri),
      )
    })
    await client.subscribeResource({ uri })

    fs.writeFileSync(
      path.join(root, "house.olai"),
      `${HOUSE}{"id":"paint","parent":"kitchen","ord":"a1","title":"paint it"}\n`,
    )
    await refresh()

    expect(await updated).toBe(uri)

    const entry = await readJson(client, uri) as {
      nodes: ReadonlyArray<{ node: { title: string } }>
    }
    expect(entry.nodes.map((n) => n.node.title)).toContain("paint it")
  })
}, 30_000)

test("a member the allowlist omits has no URI at all", async () => {
  await withFace(async ({ client }) => {
    await expect(
      client.readResource({ uri: "surface://cells/vault/manifest" }),
    ).rejects.toThrow(/unknown resource/)
    await expect(
      client.readResource({ uri: "surface://collections/vault/heads" }),
    ).rejects.toThrow(/unknown resource/)
  })
}, 30_000)

test("reading the documents collection costs the PATHS, not the bodies", async () => {
  await withFace(async ({ client }) => {
    const text = await textOf(client, "surface://collections/markdown/documents")

    expect(JSON.parse(text)).toEqual(["manual.md"])
    expect(text).not.toContain(BODY_MARKER)
    expect(text.length).toBeLessThan(1024)
  })
}, 30_000)

test("one document item is that document's body, fetched only when asked", async () => {
  await withFace(async ({ client }) => {
    const entry = await readJson(
      client,
      "surface://collections/markdown/documents/manual.md",
    ) as { text: string }

    expect(entry.text).toContain(BODY_MARKER)
    expect(entry.text.length).toBeGreaterThan(10_000)
  })
}, 30_000)

test("a saved page is absent from markdown's document resources", async () => {
  await withFace(async ({ client }) => {
    await expect(readJson(client, "surface://collections/markdown/documents/saved.html")).rejects.toThrow("not present")
  })
}, 30_000)


test("the agent has no unkept-body read tool", async () => {
  await withFace(async ({ client }) => {
    const tools = await client.listTools()
    expect(tools.tools.some(tool => tool.name === "vault_bodies_get")).toBe(false)
  })
}, 30_000)

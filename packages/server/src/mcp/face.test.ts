/**
 * The read face against a real directory, over a real MCP client.
 *
 * `expose.test.ts` proves what the allowlist RESOLVES to; this proves what a
 * client actually gets, which is a different question in the one way that
 * matters. The allowlist says `outlines` is a resource. Whether reading that
 * resource costs the key set or the corpus is decided by the ADAPTER — it picks
 * the verb by kind, `keys` for a collection and `get` for a cell — and that is
 * not visible from the map. So the wire-cost half of `faces.ts`'s rule is
 * fenced here, by reading the collection resource in a directory that contains a
 * deliberately fat document and asserting the answer stayed small.
 *
 * That fence is the point of the file. Without it, "a cell is exposable iff it
 * is O(1)-ish" is a paragraph in a header, and the way it gets broken is not by
 * somebody disagreeing with it — it is by somebody adding a member and not
 * having read it.
 *
 * In-process over a linked transport pair rather than a child process: what is
 * being tested is the PROJECTION, not the pipe. `serve.test.ts` next door owns
 * the process-level claims (stdout carries the protocol and nothing else,
 * closing stdin stops it), and those are exactly the ones an in-memory transport
 * cannot make.
 *
 * The store is driven with `refresh` rather than by waiting on the watcher —
 * "probe NOW, and do not return until the result has been published" — so the
 * subscription test is a sequence and not a race.
 */

import { fixedPolicy, make as makeOps } from "@olai/ops"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { ResourceUpdatedNotificationSchema } from "@modelcontextprotocol/sdk/types.js"
import { expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { openDirectory } from "../directory.ts"
import { propKinds } from "../propKinds.ts"
import { watchFault } from "../fault.ts"
import { hostname } from "../hostname.ts"
import { bind, gitWiring, writerAt } from "../runtime.ts"
import { SERVER_LAYERS } from "../serve.testlib.ts"
import { clientOver, serveFace } from "./face.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets"}`,
  "",
].join("\n")

const GARDEN = `{"id":"beds","ord":"a0","title":"Raised beds"}\n`

/** A string that appears ONLY in the document body, so an assertion that the
 *  corpus did not ride along is about this directory's actual bytes rather than
 *  about a size that happened to look small. */
const BODY_MARKER = "BODY-THAT-MUST-NOT-TRAVEL"

/** Fat on purpose. The manifest cell inlines every document's text, so a
 *  projection that reached for it instead of the collection would show up here
 *  as tens of kilobytes in an answer that should be two file names. */
const MANUAL = `# Manual\n\n${`${BODY_MARKER} filler filler filler.\n`.repeat(1200)}`

/** A saved page, of the shape that made the set expensive to hold: markup with
 *  its picture inlined. The server keeps this file's PATH and reads its bytes
 *  when somebody asks for them — an agent included, which is what the item read
 *  below is about. */
const SAVED = `<h1>Saved</h1>\n<p>${BODY_MARKER} inlined.</p>\n`

/** A directory with two outlines, one large document and one saved page, thrown
 *  away with the test. */
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
  /** Probe now and do not return until the result is published, so a test's own
   *  write reaches an open subscription without racing the file watcher. */
  readonly refresh: () => Promise<void>
  readonly root: string
}

/** Stand the whole read face up against a fresh directory, hand it to `use`,
 *  and take everything down with the scope. */
const withFace = <A>(use: (face: Face) => Promise<A>): Promise<A> =>
  Effect.gen(function*() {
    const root = served()
    const { store } = yield* openDirectory(root, yield* Effect.promise(() => propKinds(null)))
    // A real ops layer with commits OFF: this face is about READING, and `off`
    // is the one mode that asks git nothing at all. The edit procedures are
    // bound to it too and this face exposes none of them, so what they cost
    // here is a binding nobody can reach.
    const ops = makeOps({ store, root, policy: fixedPolicy({ commit: "off", push: null }) })
    const wired = yield* bind({
      store,
      chat: null,
      ops,
      writer: "mcp",
      hostname: hostname(),
      startedAt: "2026-08-29T09:31:00.000Z",
      // NO PLUGINS. Every runtime in this file is a reader — a bound face, an
      // MCP route — and none of them is about a terminal door or a CI chip;
      // dialing whatever daemons happen to be on the machine running the suite
      // would make these tests depend on them. `null` is the OFF setting, and
      // what it produces is a surface with no `surface/<name>/` on it at all:
      // an empty sibling record composes to no tag, no handler and no expose
      // row, so olai's own group is byte for byte what it always was.
      plugins: null,
      git: gitWiring(
        ops,
        fixedPolicy({ commit: "off", push: null }),
        yield* SubscriptionRef.make(0),
      ),
    })
    // Not optional, and not ceremony copied from `serve.ts`: the runtime's
    // `done` REJECTS when it is closed, so something has to be holding the
    // catch or every teardown here is an unhandled rejection the test runner
    // attributes to whichever test happened to be running. Holding it while
    // saying a shutdown is not news is `fault.ts`'s whole job.
    const runtime = yield* watchFault(wired.bound)
    // The runtime is built here, so it is closed here — the same rule serve.ts
    // keeps, and the reason the face is handed `handlers` and not a lifetime.
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))

    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    yield* serveFace({
      // The group AND the face, from the one call that composed both: an
      // exposure describes a group as a set equality, so a gate built from a
      // second reading of which plugins are on refuses to bind.
      client: () => clientOver(wired.bound, wired.faces.agent),
      transport: serverSide,
    })

    const client = new Client({ name: "face.test", version: "0" })
    yield* Effect.promise(() => client.connect(clientSide))
    yield* Effect.addFinalizer(() => Effect.promise(() => client.close()))
    // Registered LAST so it runs FIRST — finalizers run in reverse, and this
    // has to be true before anything starts closing. Same ordering rule, and
    // the same reason, as the pair in serve.ts.
    yield* Effect.addFinalizer(() => runtime.stopped)

    return yield* Effect.promise(() =>
      use({
        client,
        refresh: () => Effect.runPromise(Effect.orDie(store.refresh("cheap"))),
        root,
      })
    )
  }).pipe(Effect.scoped, Effect.provide(SERVER_LAYERS), Effect.runPromise)

/** The one text part of a resource read.
 *
 *  MCP types a content as text-OR-blob, and every resource this face serves is
 *  JSON in a text part — the adapter has no other arm. So a blob arriving here
 *  is a projection bug and gets thrown at rather than handled, which is also
 *  what narrows the union for the reads below. */
const textOf = async (client: Client, uri: string): Promise<string> => {
  const answer = await client.readResource({ uri })
  const first = answer.contents[0]
  if (first === undefined || !("text" in first)) {
    throw new Error(`${uri}: expected one text part, got ${JSON.stringify(answer.contents)}`)
  }
  expect(first.mimeType).toBe("application/json")
  return first.text
}

/** The same read, decoded. */
const readJson = async (client: Client, uri: string): Promise<unknown> =>
  JSON.parse(await textOf(client, uri))

test("the served resources are exactly the five the allowlist names", async () => {
  await withFace(async ({ client }) => {
    const listed = await client.listResources()
    expect(listed.resources.map((r) => r.uri).sort()).toEqual([
      "surface://cells/errors",
      "surface://cells/git",
      "surface://cells/pending",
      "surface://collections/documents",
      "surface://collections/outlines",
    ])

    const templates = await client.listResourceTemplates()
    expect(templates.resourceTemplates.map((t) => t.uriTemplate).sort()).toEqual([
      "surface://collections/documents/{id}",
      "surface://collections/outlines/{id}",
    ])
  })
})

test("reading the outlines collection costs the KEY SET, not the corpus", async () => {
  await withFace(async ({ client }) => {
    const text = await textOf(client, "surface://collections/outlines")

    // What it IS: the file names, and only the outline files.
    expect(JSON.parse(text).sort()).toEqual(["garden.olai", "house.olai"])

    // What it is NOT, stated two ways because they fail differently. The marker
    // catches a projection that reached the document text at all; the size
    // catches one that grew O(corpus) in some other shape. The document is ~40
    // KiB, so a bound of one is not a close call.
    expect(text).not.toContain(BODY_MARKER)
    expect(text.length).toBeLessThan(1024)
  })
})

test("one outline item is that file's nodes, and no other file's", async () => {
  await withFace(async ({ client }) => {
    const entry = await readJson(
      client,
      "surface://collections/outlines/house.olai",
    ) as { rev: number; nodes: ReadonlyArray<{ node: { title: string } }>; broken: unknown }

    expect(entry.nodes.map((n) => n.node.title)).toEqual([
      "Kitchen remodel",
      "order the cabinets",
    ])
    expect(entry.broken).toBeNull()
    // The revision the entry was published at travels with it — the number a
    // write will one day name as the base it edited.
    expect(entry.rev).toBeGreaterThan(0)
  })
})

test("the errors cell reads as a live value", async () => {
  await withFace(async ({ client }) => {
    // THE VERDICT, which is what the cell carries now (`@olai/format`'s
    // `verdict.ts`): a clean directory is a verdict with no findings, and an
    // agent asks it the same questions a browser does.
    expect(await readJson(client, "surface://cells/errors")).toEqual({ findings: [] })
  })
})

// A directory that cannot be READ, over the agent's face — the same rows the
// browser draws its banner from, off the same cell, because there is one cell.
//
// This is the MCP half of "MCP and Web ops must be consistent",
// and it is asserted rather than argued: the failure used to be a log line, so
// an agent reading a served directory that had gone away was handed the last
// good tree with nothing to say it was stale — the same lie the browser told,
// by the same omission. Putting it on the errors cell fixes both faces at once
// BY CONSTRUCTION, and this is what holds that construction in place.
test("a directory that cannot be read reaches the agent, not just the browser", async () => {
  await withFace(async ({ client, refresh, root }) => {
    fs.rmSync(root, { recursive: true, force: true })
    await refresh().catch(() => {})

    const errors = await readJson(client, "surface://cells/errors")
    // `.` and not the absolute root: every site in this vocabulary is
    // root-relative, and the server's filesystem layout is not something a
    // reader of an outline is owed.
    expect(errors).toEqual({
      findings: [
        expect.objectContaining({ code: "unreadable-directory", file: ".", line: 0 }),
      ],
    })
  })
})

test("an edited outline notifies its subscribers", async () => {
  await withFace(async ({ client, refresh, root }) => {
    const uri = "surface://collections/outlines/house.olai"

    const updated = new Promise<string>((resolve) => {
      client.setNotificationHandler(
        ResourceUpdatedNotificationSchema,
        (note) => resolve(note.params.uri),
      )
    })
    await client.subscribeResource({ uri })

    // The change an agent is watching for: another writer moved a file.
    fs.writeFileSync(
      path.join(root, "house.olai"),
      `${HOUSE}{"id":"paint","parent":"kitchen","ord":"a1","title":"paint it"}\n`,
    )
    await refresh()

    expect(await updated).toBe(uri)

    // And the re-read carries the change, which is the half that makes the
    // notification worth anything: MCP pushes "this changed", never the value.
    const entry = await readJson(client, uri) as {
      nodes: ReadonlyArray<{ node: { title: string } }>
    }
    expect(entry.nodes.map((n) => n.node.title)).toContain("paint it")
  })
})

test("a member the allowlist omits has no URI at all", async () => {
  await withFace(async ({ client }) => {
    // Default-deny at the WIRE, not merely in the map. `manifest` is the one
    // that matters — it is the .md corpus — but an omitted member of any kind
    // must be unaddressable, so the transcript is checked beside it.
    await expect(
      client.readResource({ uri: "surface://cells/manifest" }),
    ).rejects.toThrow(/unknown resource/)
    await expect(
      client.readResource({ uri: "surface://collections/transcript" }),
    ).rejects.toThrow(/unknown resource/)
  })
})

test("reading the documents collection costs the PATHS, not the bodies", async () => {
  await withFace(async ({ client }) => {
    const text = await textOf(client, "surface://collections/documents")

    // Every BODIED file, `.html` included — the key set is what the sidebar and
    // an agent both read, and a file whose body the server does not keep is
    // still a file it serves.
    expect(JSON.parse(text)).toEqual(["manual.md", "saved.html"])
    // The same fence as the outlines one, on the member that motivated the rule.
    // `manifest` used to carry these bodies whole; the collection is what
    // `snapshot-scale` cut them into, and this is the assertion that says the
    // MCP projection inherited the cheap shape rather than only the browser.
    expect(text).not.toContain(BODY_MARKER)
    expect(text.length).toBeLessThan(1024)
  })
})

test("one document item is that document's body, fetched only when asked", async () => {
  await withFace(async ({ client }) => {
    const entry = await readJson(
      client,
      "surface://collections/documents/manual.md",
    ) as { text: string }

    // The body IS reachable — laziness is about when it travels, not whether an
    // agent can read it. One `resources/read` of one key, and nothing else.
    expect(entry.text).toContain(BODY_MARKER)
    expect(entry.text.length).toBeGreaterThan(10_000)
  })
})

// The same read, of the file whose body the server does NOT keep — and the
// sharp edge it walks. A `resources/read` is ONE SHOT: it takes the first frame
// of the item and leaves. So a server that answered "here is the key, the body
// is coming" would hand an agent an empty document and call it the file. It
// answers nothing until the read has landed instead, and the first frame is the
// page.
test("one saved page is read from disk for the agent that asks for it", async () => {
  await withFace(async ({ client }) => {
    const entry = await readJson(
      client,
      "surface://collections/documents/saved.html",
    ) as { text: string | null }

    expect(entry.text).toBe(SAVED)
  })
})

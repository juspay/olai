import { expect, test } from "bun:test"
import { Effect } from "effect"
import { isRegular, type NodeAgent, UsageFailure, type WriteRequest } from "@olai/format"
import { TEST_CLAIMS, readingOf, setOf, planning } from "@olai/ops/testlib"
import { newChat, chatLocations, type NewChat } from "./new-chat.ts"

const NOTE = "notes/plan.md"

const fixture = () => {
  const texts: Record<string, string> = { "house.olai": '{"id":"kitchen","title":"kitchen remodel","ord":"a0"}\n' }
  const documents: Record<string, string> = { [NOTE]: "# Plan\n" }
  /** What the vault says is tied, by ITEM KEY — the roster the refusals are
   *  asked over, moved by a start exactly as a binding write would move it. */
  const ties = new Map<string, { engine: string; session: string | null; title: string }>()
  const events: string[] = []
  let refuse: "write" | "start" | undefined
  const reading = () =>
    readingOf(setOf(texts, Object.entries(documents).map(([path, text]) => [path, text] as const)))
  const owner: NewChat = {
    read: Effect.sync(reading),
    write: (request: WriteRequest) => Effect.gen(function*() {
      events.push(request.op)
      if (refuse === "write") return yield* new UsageFailure({ reason: "write refused" })
      const plan = planning(setOf(texts), request)
      if (plan._tag === "Failure") return yield* plan.failure
      for (const file of plan.success.files) texts[file.file] = TEST_CLAIMS.byKind.get("outline-olai")!.format!.serialize(file.nodes)
      return { id: plan.success.id }
    }),
    start: (item, engine) => Effect.gen(function*() {
      events.push(`start:${engine}`)
      if (refuse === "start") {
        // A refused start still writes the engine, which is what makes the
        // retry land on this same item rather than on a second one.
        ties.set(item, { engine, session: null, title: item })
        return yield* new UsageFailure({ reason: "start refused" })
      }
      ties.set(item, { engine, session: "session", title: item })
      return { agent: engine, session: "session" }
    }),
    chats: () =>
      [...ties].map(([id, tie]): Pick<NodeAgent, "id" | "title" | "session"> => ({
        id,
        title: tie.title,
        session: tie.session,
      })),
  }
  return { owner, texts, documents, events, ties, refuse: (value: typeof refuse) => { refuse = value } }
}

const titleOf = (it: ReturnType<typeof fixture>, id: string): string => {
  const row = readingOf(setOf(it.texts)).derived.byId.get(id)!
  if (!isRegular(row)) throw new Error("new chat minted a mirror")
  return row.node.title
}

// ── the mint arm: a row under a parent the person chose ────────────────

test("new chat mints a plain child of the chosen parent, then starts the engine", async () => {
  const it = fixture()
  const made = await Effect.runPromise(newChat(it.owner, { agent: "claude", title: "First message", parent: "kitchen" }))
  expect(it.events).toEqual(["add", "start:claude"])
  expect(titleOf(it, made.node)).toBe("First message")
  expect(made.to).toEqual({ agent: "claude", session: "session" })
})

test("a missing or trashed parent refuses before spending", async () => {
  const it = fixture()
  for (const parent of ["missing", "gone"]) {
    if (parent === "gone") await Effect.runPromise(it.owner.write({ op: "create", file: "_olai/Trash.olai", seed: { id: "gone", title: "Gone" } }))
    it.events.length = 0
    const result = await Effect.runPromise(Effect.result(newChat(it.owner, { agent: "claude", title: "Planning", parent })))
    expect(result._tag).toBe("Failure")
    expect(it.events).toEqual([])
  }
})

test("a mirror cannot be a parent and is absent from the picker", async () => {
  const it = fixture()
  it.texts["work.olai"] = '{"id":"work","title":"Work","ord":"a0"}\n{"id":"mirror","mirror":"work","ord":"a1"}\n'
  const result = await Effect.runPromise(Effect.result(newChat(it.owner, { agent: "claude", title: "Planning", parent: "mirror" })))
  expect(result._tag).toBe("Failure")
  expect(it.events).toEqual([])
  expect(chatLocations(await Effect.runPromise(it.owner.read), { filter: "Work", limit: 20, ids: [], parents: [] }).nodes.map(node => node.id)).toEqual(["work"])
})

test("a refused write starts nothing; a refused start keeps the minted node", async () => {
  const it = fixture()
  it.refuse("write")
  expect((await Effect.runPromise(Effect.result(newChat(it.owner, { agent: "claude", title: "First message", parent: "kitchen" }))))._tag).toBe("Failure")
  expect(it.events).toEqual(["add"])
  it.refuse("start")
  it.events.length = 0
  const refused = await Effect.runPromise(newChat(it.owner, { agent: "claude", title: "First message", parent: "kitchen" }))
  expect(refused.refusal).toBe("start refused")
  expect(refused.to).toBeNull()
  expect(readingOf(setOf(it.texts)).derived.byId.has(refused.node)).toBe(true)
})

test("server normalizes long multiline titles and refuses empty titles before any writes", async () => {
  const it = fixture()
  const empty = await Effect.runPromise(Effect.result(newChat(it.owner, { agent: "claude", title: " \n\t", parent: "kitchen" })))
  expect(empty._tag).toBe("Failure")
  expect(it.events).toEqual([])
  const result = await Effect.runPromise(newChat(it.owner, { agent: "claude", title: `\n  ${"x".repeat(80)}  \nignored`, parent: "kitchen" }))
  expect(titleOf(it, result.node)).toBe(`${"x".repeat(59)}…`)
})

test("new chat seats against the committed reading while its display projection still lags", async () => {
  const it = fixture()
  const earlier = await Effect.runPromise(it.owner.read)
  let started = false
  const owner: NewChat = { ...it.owner, start: (node, _engine, committed) => Effect.sync(() => {
    expect(earlier.derived.byId.has(node)).toBe(false)
    expect(committed.derived.byId.has(node)).toBe(true)
    started = true
    return null
  }) }
  await Effect.runPromise(newChat(owner, { agent: "claude", title: "First message", parent: "kitchen" }))
  expect(started).toBe(true)
})

// ── the item arm: the chat of a node or a note that exists ─────────────

test("a node's own chat is started on the node, and nothing is minted", async () => {
  const it = fixture()
  const made = await Effect.runPromise(newChat(it.owner, { agent: "claude", item: { kind: "node", id: "kitchen" } }))
  expect(it.events).toEqual(["start:claude"])
  expect(made.node).toBe("kitchen")
  expect(made.to).toEqual({ agent: "claude", session: "session" })
})

test("a note's own chat is started on the note, keyed by its path", async () => {
  const it = fixture()
  const made = await Effect.runPromise(newChat(it.owner, { agent: "claude", item: { kind: "note", path: NOTE } }))
  expect(made.node).toBe(`/${NOTE}`)
  expect(it.events).toEqual(["start:claude"])
})

test("an item that already has a started chat is refused by name, and nothing is started", async () => {
  const it = fixture()
  await Effect.runPromise(newChat(it.owner, { agent: "claude", item: { kind: "note", path: NOTE } }))
  it.ties.set(`/${NOTE}`, { engine: "claude", session: "session", title: "plan" })
  it.events.length = 0
  const second = await Effect.runPromise(Effect.result(newChat(it.owner, { agent: "claude", item: { kind: "note", path: NOTE } })))
  if (second._tag !== "Failure") throw new Error("a second chat was started on one item")
  expect(second.failure.message).toBe("“plan” already has a chat; no conversation was created")
  expect(it.events).toEqual([])
})

test("a tie whose start was refused is started again on the SAME item", async () => {
  const it = fixture()
  it.refuse("start")
  const first = await Effect.runPromise(newChat(it.owner, { agent: "claude", item: { kind: "note", path: NOTE } }))
  expect(first.refusal).toBe("start refused")
  it.refuse(undefined)
  const second = await Effect.runPromise(newChat(it.owner, { agent: "claude", item: { kind: "note", path: NOTE } }))
  expect(second.node).toBe(first.node)
  expect(second.to).toEqual({ agent: "claude", session: "session" })
  expect(it.events).toEqual(["start:claude", "start:claude"])
})

test("an item olai does not hold is refused before anything is started", async () => {
  const it = fixture()
  for (
    const item of [
      { kind: "note", path: "notes/gone.md" },
      { kind: "node", id: "nobody" },
    ] as const
  ) {
    const missing = await Effect.runPromise(Effect.result(newChat(it.owner, { agent: "claude", item })))
    expect(missing._tag).toBe("Failure")
    if (missing._tag !== "Failure") throw new Error("unreachable")
    expect(missing.failure.message).toContain("to talk about; no conversation was created")
  }
  expect(it.events).toEqual([])
})

test("location queries cap matches, resolve ids and parents, and exclude machinery except Inbox", () => {
  const rows = Array.from({ length: 100 }, (_, index) => ({ id: `n${index}`, title: `Work ${index}`, ord: `a${index}` }))
  const reading = readingOf(setOf({
    "work.olai": rows.map(row => JSON.stringify(row)).join("\n"),
    "_olai/Inbox.olai": '{"id":"chats","title":"Chats","ord":"a0"}\n{"id":"child","title":"Conversation","parent":"chats","ord":"a0"}',
    "_olai/Settings.olai": '{"id":"settings","title":"Work settings","ord":"a0"}',
    "_olai/Properties.olai": '{"id":"prop","title":"Work property","ord":"a0"}',
  }))
  const query = { filter: "Work", limit: 5, ids: [], parents: [] }
  expect(chatLocations(reading, query).nodes).toHaveLength(5)
  expect(chatLocations(reading, { ...query, limit: 1000 }).nodes).toHaveLength(20)
  expect(chatLocations(reading, { ...query, filter: "" }).nodes).toEqual([])
  const lookup = chatLocations(reading, { ...query, filter: "", ids: ["n99", "settings", "prop"], parents: ["child"] })
  expect(lookup.nodes.map(node => node.id)).toEqual(["n99", "chats"])
})

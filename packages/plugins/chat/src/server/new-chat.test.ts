import { expect, test } from "bun:test"
import { Effect } from "effect"
import { UsageFailure, isRegular, type WriteRequest } from "@olai/format"
import { TEST_CLAIMS, readingOf, setOf, planning } from "@olai/ops/testlib"
import { newChat, chatLocations, type NewChat } from "./new-chat.ts"

const fixture = () => {
  const texts: Record<string, string> = {}
  const events: string[] = []
  let inbox: string | null = "Inbox.olai"
  let refuse: "write" | "start" | undefined
  const owner: NewChat = {
    current: () => inbox, read: Effect.sync(() => readingOf(setOf(texts))),
    write: (request: WriteRequest) => Effect.gen(function*() {
      events.push(request.op)
      if (refuse === "write") return yield* new UsageFailure({ reason: "write refused" })
      const plan = planning(setOf(texts), request)
      if (plan._tag === "Failure") return yield* plan.failure
      for (const file of plan.success.files) texts[file.file] = TEST_CLAIMS.byKind.get("outline-olai")!.format!.serialize(file.nodes)
      return { id: plan.success.id }
    }),
    start: (node, engine) => Effect.gen(function*() {
      events.push(`start:${engine}`)
      expect(readingOf(setOf(texts)).derived.byId.has(node)).toBe(true)
      if (refuse === "start") return yield* new UsageFailure({ reason: "start refused" })
      return { agent: engine, session: "session" }
    }),
  }
  return { owner, texts, events, inbox: (value: string | null) => { inbox = value }, refuse: (value: typeof refuse) => { refuse = value } }
}

test("new chat ensures Chats, mints its plain child, then starts the chosen engine", async () => {
  const it = fixture()
  const { node: id } = await Effect.runPromise(newChat(it.owner, { agent: "claude", title: "First message", parent: null }))
  expect(it.events).toEqual(["create", "add", "start:claude"])
  const row = readingOf(setOf(it.texts)).derived.byId.get(id)!
  if (!isRegular(row)) throw new Error("new chat minted a mirror")
  expect(row.node.title).toBe("First message")
  expect(row.node.parent).toBe("chats")
  await Effect.runPromise(newChat(it.owner, { agent: "codex", title: "First message", parent: null }))
  expect(it.events).toEqual(["create", "add", "start:claude", "add", "start:codex"])
})

test("missing or withdrawn Inbox refuses before minting or starting", async () => {
  const it = fixture()
  it.inbox(null)
  expect((await Effect.runPromise(Effect.result(newChat(it.owner, { agent: "claude", title: "First message", parent: null }))))._tag).toBe("Failure")
  expect(it.events).toEqual([])
  it.inbox("Inbox.olai")
  const write = it.owner.write
  const withdrawn: NewChat = { ...it.owner, write: request => write(request).pipe(Effect.tap(() => Effect.sync(() => it.inbox(null)))) }
  expect((await Effect.runPromise(Effect.result(newChat(withdrawn, { agent: "claude", title: "First message", parent: null }))))._tag).toBe("Failure")
  expect(it.events).toEqual(["create"])
})

test("a refused write starts nothing; a refused start preserves the minted node", async () => {
  const it = fixture()
  it.refuse("write")
  expect((await Effect.runPromise(Effect.result(newChat(it.owner, { agent: "claude", title: "First message", parent: null }))))._tag).toBe("Failure")
  expect(it.events).toEqual(["create"])
  it.refuse("start")
  const refused = await Effect.runPromise(newChat(it.owner, { agent: "claude", title: "First message", parent: null }))
  expect(refused.refusal).toBe("start refused")
  expect(refused.to).toBeNull()
  expect(it.events).toEqual(["create", "create", "add", "start:claude"])
  expect(readingOf(setOf(it.texts)).derived.nodes.some(row => isRegular(row) && row.node.title === "First message")).toBe(true)
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
  await Effect.runPromise(newChat(owner, { agent: "claude", title: "First message", parent: null }))
  expect(started).toBe(true)
})


test("an explicit parent works without capture and does not create Chats", async () => {
  const it = fixture()
  await Effect.runPromise(it.owner.write({ op: "create", file: "work.olai", seed: { id: "work", title: "Work" } }))
  it.events.length = 0
  it.inbox(null)
  const result = await Effect.runPromise(newChat(it.owner, { agent: "claude", title: "Planning", parent: "work" }))
  expect(it.events).toEqual(["add", "start:claude"])
  expect(result.to).toEqual({ agent: "claude", session: "session" })
  expect(it.texts["Inbox.olai"]).toBeUndefined()
})

test("a missing or trashed explicit parent refuses before spending", async () => {
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


test("server normalizes long multiline titles and refuses empty titles before any writes", async () => {
  const it = fixture()
  const empty = await Effect.runPromise(Effect.result(newChat(it.owner, { agent: "claude", title: " \n\t", parent: null })))
  expect(empty._tag).toBe("Failure")
  expect(it.events).toEqual([])
  const result = await Effect.runPromise(newChat(it.owner, { agent: "claude", title: `\n  ${"x".repeat(80)}  \nignored`, parent: null }))
  const row = readingOf(setOf(it.texts)).derived.byId.get(result.node)!
  expect(isRegular(row) && row.node.title).toBe(`${"x".repeat(59)}…`)
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
  const lookup = chatLocations(reading, { ...query, filter: "", ids: ["n99", "settings", "prop"], parents: ["child"] }, "_olai/Inbox.olai")
  expect(lookup.nodes.map(node => node.id)).toEqual(["n99", "chats"])
  expect(lookup.defaultParent).toBe("chats")
})

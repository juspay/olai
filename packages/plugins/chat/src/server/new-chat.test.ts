import { expect, test } from "bun:test"
import { Effect } from "effect"
import { type NodeAgent, UsageFailure } from "@olai/format"
import { readingOf, setOf } from "@olai/ops/testlib"
import { newChat, itemLocations, type NewChat } from "./new-chat.ts"

const NOTE = "notes/plan.md"

const fixture = () => {
  const texts: Record<string, string> = { "house.olai": '{"id":"kitchen","title":"kitchen remodel","ord":"a0"}\n' }
  const documents: Record<string, string> = { [NOTE]: "# Plan\n" }
  /** What the vault says is tied, by ITEM KEY — the roster the refusals are
   *  asked over, moved by a start exactly as a binding write would move it. */
  const ties = new Map<string, { engine: string; session: string | null; title: string }>()
  const events: string[] = []
  let refuse: "start" | undefined
  const reading = () =>
    readingOf(setOf(texts, Object.entries(documents).map(([path, text]) => [path, text] as const)))
  const owner: NewChat = {
    read: Effect.sync(reading),
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

// ── the chat of a node or a note that exists ───────────────────────────

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

test("the start is seated against the reading the refusal was asked over", async () => {
  const it = fixture()
  let seen = false
  const owner: NewChat = { ...it.owner, start: (node, _engine, committed) => Effect.sync(() => {
    expect(committed.derived.byId.has(node)).toBe(true)
    seen = true
    return null
  }) }
  await Effect.runPromise(newChat(owner, { agent: "claude", item: { kind: "node", id: "kitchen" } }))
  expect(seen).toBe(true)
})

// ── which node or note a new chat can be about ─────────────────────────

const vault = () => readingOf(setOf({
  "work.olai": Array.from({ length: 100 }, (_, index) => JSON.stringify({ id: `n${index}`, title: `Work ${index}`, ord: `a${index}` })).join("\n"),
  "_olai/Settings.olai": '{"id":"settings","title":"Work settings","ord":"a0"}',
}, [
  ["notes/work.md", "# Work\n"],
  ["notes/other.md", "# Other\n"],
  ["plugins/swatch/README.md", "# Swatch\n"],
  ["_olai/Hidden.md", "# Work hidden\n"],
]))

test("a typed search answers nodes and notes, each kind capped, machinery excluded", () => {
  const reading = vault()
  const query = { filter: "Work", limit: 5, keys: [] }
  const few = itemLocations(reading, query).items
  expect(few.filter(one => one.kind === "node")).toHaveLength(5)
  expect(few.filter(one => one.kind === "note").map(one => one.key)).toEqual(["/notes/work.md"])
  expect(itemLocations(reading, { ...query, limit: 1000 }).items.filter(one => one.kind === "node")).toHaveLength(20)
  expect(itemLocations(reading, { ...query, filter: "" }).items).toEqual([])
  // `_olai` is olai's own machinery, node and note alike.
  expect(few.some(one => one.file.startsWith("_olai/"))).toBe(false)
})

test("a README is named after its folder, so no two plugin chats share a word", () => {
  const found = itemLocations(vault(), { filter: "swatch", limit: 20, keys: [] }).items
  expect(found.map(one => [one.key, one.title]))
    .toEqual([["/plugins/swatch/README.md", "swatch"]])
})

test("keys are answered whatever is typed, and an item that is not there is simply absent", () => {
  const found = itemLocations(vault(), { filter: "", limit: 20, keys: ["n99", "/notes/other.md", "settings", "/notes/gone.md"] })
  expect(found.items.map(one => one.key)).toEqual(["n99", "/notes/other.md"])
})

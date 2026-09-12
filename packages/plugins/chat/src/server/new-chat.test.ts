import { expect, test } from "bun:test"
import { Effect } from "effect"
import { UsageFailure, isRegular, type WriteRequest } from "@olai/format"
import { TEST_CLAIMS, readingOf, setOf, planning } from "@olai/ops/testlib"
import { newChat, type NewChat } from "./new-chat.ts"

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
    }),
  }
  return { owner, texts, events, inbox: (value: string | null) => { inbox = value }, refuse: (value: typeof refuse) => { refuse = value } }
}

test("new chat ensures Chats, mints its plain child, then starts the chosen engine", async () => {
  const it = fixture()
  const id = await Effect.runPromise(newChat(it.owner, "claude"))
  expect(it.events).toEqual(["create", "add", "start:claude"])
  const row = readingOf(setOf(it.texts)).derived.byId.get(id)!
  if (!isRegular(row)) throw new Error("new chat minted a mirror")
  expect(row.node.title).toBe("new conversation")
  expect(row.node.parent).toBe("chats")
  await Effect.runPromise(newChat(it.owner, "codex"))
  expect(it.events).toEqual(["create", "add", "start:claude", "add", "start:codex"])
})

test("missing or withdrawn Inbox refuses before minting or starting", async () => {
  const it = fixture()
  it.inbox(null)
  expect((await Effect.runPromise(Effect.result(newChat(it.owner, "claude"))))._tag).toBe("Failure")
  expect(it.events).toEqual([])
  it.inbox("Inbox.olai")
  const write = it.owner.write
  const withdrawn: NewChat = { ...it.owner, write: request => write(request).pipe(Effect.tap(() => Effect.sync(() => it.inbox(null)))) }
  expect((await Effect.runPromise(Effect.result(newChat(withdrawn, "claude"))))._tag).toBe("Failure")
  expect(it.events).toEqual(["create"])
})

test("a refused write starts nothing; a refused start preserves the minted node", async () => {
  const it = fixture()
  it.refuse("write")
  expect((await Effect.runPromise(Effect.result(newChat(it.owner, "claude"))))._tag).toBe("Failure")
  expect(it.events).toEqual(["create"])
  it.refuse("start")
  expect((await Effect.runPromise(Effect.result(newChat(it.owner, "claude"))))._tag).toBe("Failure")
  expect(it.events).toEqual(["create", "create", "add", "start:claude"])
  expect(readingOf(setOf(it.texts)).derived.nodes.some(row => isRegular(row) && row.node.title === "new conversation")).toBe(true)
})

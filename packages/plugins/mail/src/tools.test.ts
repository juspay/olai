import { openMailbox } from "./mailbox.ts"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import { harness, connected } from "./tools.testlib.ts"
import { MAIL_UNCONNECTED } from "./wire.ts"

const run = (work: Parameters<typeof harness>[0]) => Effect.runPromise(harness(work))
test("inbox, query, pagination, HTML and all five mutations round trip", () => run(h => Effect.gen(function*() {
  const inbox = yield* h.call("inbox") as Effect.Effect<any>
  expect(inbox.threads).toHaveLength(3)
  expect(inbox.threads.filter((t: any) => t.unread)).toHaveLength(1)
  const page = yield* h.call("inbox", { max: 2 }) as Effect.Effect<any>
  expect((yield* h.call("inbox", { page: page.next, max: 2 }) as Effect.Effect<any>).threads).toHaveLength(1)
  const html = yield* h.call("thread", { thread: "a2" }) as Effect.Effect<any>
  expect(html.messages[0].text).toBeNull()
  expect(html.messages[0].html).toContain("<p>")
  yield* h.call("archive", { thread: "a1" })
  expect((yield* h.call("inbox") as Effect.Effect<any>).threads).toHaveLength(2)
  expect((yield* h.call("label", { thread: "a2", add: ["WAITING"] }) as Effect.Effect<any>).changed.added).toEqual(["waiting"])
  yield* h.call("trash", { thread: "a2" })
  expect((yield* h.call("search", { query: "in:trash" }) as Effect.Effect<any>).threads).toHaveLength(1)
  yield* h.call("untrash", { thread: "a2" })
  expect((yield* h.call("search", { query: "in:trash" }) as Effect.Effect<any>).threads).toHaveLength(0)
  yield* h.call("read", { thread: "a1", read: true })
  expect((yield* h.call("search", { query: "is:unread" }) as Effect.Effect<any>).threads).toHaveLength(0)
  yield* h.call("read", { thread: "a1", read: false })
  expect((yield* h.call("search", { query: "is:unread" }) as Effect.Effect<any>).threads).toHaveLength(1)
})))

test("every tool refuses absent, faulted and expired accounts without spawning", () => run(h => Effect.gen(function*() {
  const args = { body: "Hello", draft: "draft_1", thread: "a1", message: "a32", attachment: "attachment_1", query: "is:unread", add: ["waiting"], read: true }
  for (const state of [MAIL_UNCONNECTED, { ...connected, status: "fault" as const, reason: "invalid_grant" }, connected]) {
    h.state(state, false)
    for (const name of ["inbox", "search", "thread", "attachment", "archive", "trash", "untrash", "label", "read", "draft", "draft_update"]) {
      const result = yield* Effect.result(h.call(name, args))
      expect(result._tag).toBe("Failure")
    }
  }
  expect(h.calls).toHaveLength(0)
})))

test("unknown labels and missing threads cannot write; argument bounds are enforced", () => run(h => Effect.gen(function*() {
  for (const args of [{ max: 0 }, { max: 51 }, { max: 1.5 }]) expect((yield* Effect.result(h.call("inbox", args)))._tag).toBe("Failure")
  for (const args of [{ thread: "a1" }, { thread: "a1", add: [] }, { thread: "a1", add: Array(11).fill("waiting") }, { thread: "a1", add: ["missing"] }]) expect((yield* Effect.result(h.call("label", args)))._tag).toBe("Failure")
  for (const name of ["archive", "trash", "untrash", "read"]) expect((yield* Effect.result(h.call(name, { thread: "ffff", read: true })))._tag).toBe("Failure")
  expect(h.calls.filter(c => ["threads.modify", "threads.trash", "threads.untrash"].includes(c.verb.id))).toHaveLength(0)
})))

test("concurrent writes to the same thread keep each before/write/after transaction together", () => run(h => Effect.gen(function*() {
  yield* Effect.all([h.call("archive", { thread: "a1" }), h.call("trash", { thread: "a1" })], { concurrency: 2 })
  expect(h.calls.filter(c => c.verb.id.startsWith("threads.")).map(c => c.verb.id)).toEqual(["threads.get", "threads.modify", "threads.get", "threads.get", "threads.trash", "threads.get"])
})))

test("fifty-thread listings never run more than four Himalaya children", async () => {
  const { makeTools } = await import("./tools.ts")
  const { THREADS, LABELS } = await import("./appliance/testlib/fixtures.ts")
  let active = 0
  let peak = 0
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const tools = yield* makeTools(yield* openMailbox({ binary: "/fake", useToken: () => Effect.void, close: async () => {}, run: call => Effect.acquireUseRelease(
      Effect.sync(() => { active++; peak = Math.max(peak, active) }),
      () => Effect.sleep("2 millis").pipe(Effect.as(call.verb.id === "labels.list" ? LABELS : call.verb.id === "threads.list" ? { threads: Array.from({ length: 50 }, (_, i) => ({ id: i.toString(16) })) } : { ...THREADS[0], id: call.args?.[0] })),
      () => Effect.sync(() => { active-- }),
    ) }, { current: () => connected, usable: () => true }))
    const tool = tools.find(t => t.name === "inbox")!
    if (tool.kind !== "surface") throw new Error("wrong tool kind")
    yield* tool.call(undefined as never, { max: 50 } as never)
  })))
  expect(peak).toBe(4)
  expect(active).toBe(0)
})

test("closing mail cuts running calls before deleting attachments and refuses retained tools", async () => {
  const { makeTools } = await import("./tools.ts")
  const { Deferred, Exit, Fiber, Scope } = await import("effect")
  const { LABELS } = await import("./appliance/testlib/fixtures.ts")
  const scope = Scope.makeUnsafe()
  const entered = Deferred.makeUnsafe<void>()
  let cut = false
  let spawns = 0
  const tools = await Effect.runPromise(Effect.provideService(openMailbox({ binary: "/fake", useToken: () => Effect.void, close: async () => {}, run: call => {
    spawns++
    if (call.verb.id === "labels.list") return Effect.succeed(LABELS)
    return Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never), Effect.ensuring(Effect.sync(() => { cut = true })))
  } }, { current: () => connected, usable: () => true }).pipe(Effect.flatMap(makeTools)), Scope.Scope, scope))
  const tool = tools.find(t => t.name === "thread")!
  if (tool.kind !== "surface") throw new Error("wrong tool kind")
  const call = tool.call(undefined as never, { thread: "a1" } as never)
  const fiber = Effect.runFork(call)
  await Effect.runPromise(Deferred.await(entered))
  await Effect.runPromise(Scope.close(scope, Exit.void))
  expect(cut).toBe(true)
  await Effect.runPromise(Fiber.await(fiber))
  const before = spawns
  const refused = await Effect.runPromise(Effect.result(call))
  expect(refused._tag).toBe("Failure")
  expect(spawns).toBe(before)
})

test("stale label ids survive all reads, and a missing attachment names the attachment", () => Effect.runPromise(harness(h => Effect.gen(function*() {
  for (const [name, args] of [["inbox", {}], ["search", { query: "is:unread" }], ["thread", { thread: "a1" }]] as const) {
    const answer = yield* h.call(name, args)
    expect(JSON.stringify(answer)).toContain("Label_deleted")
    expect(JSON.stringify(answer)).toContain("SYSTEM_UNKNOWN")
  }
  yield* h.call("thread", { thread: "a3" })
  const result = yield* Effect.result(h.call("attachment", { message: "a32", attachment: "attachment_1" }))
  expect(result._tag).toBe("Failure")
  if (result._tag === "Failure") expect(result.failure).toMatchObject({ reason: "this attachment is not on that message" })
}), true)))

test("drafts create, reply and replace, retaining MIME and account identity", () => run(h => Effect.gen(function*() {
  const { readFileSync } = yield* Effect.promise(() => import("node:fs"))
  const saved = (id: string) => JSON.parse(readFileSync(`${h.root}/draft-${id}.json`, "utf8"))
  const created: any = yield* h.call("draft", { to: ["ravi@example.com"], cc: ["copy@example.com"], bcc: ["blind@example.com"], subject: "Café ☕", body: "Literal \\n text\nand a line" })
  expect(created).toMatchObject({ address: "you@gmail.com", draft: "draft_1", message: "d01", thread: null, subject: "Café ☕", updated: false })
  expect(saved(created.draft).headers).toMatchObject({ From: "you@gmail.com", To: "ravi@example.com", Cc: "copy@example.com", Bcc: "blind@example.com", Subject: "Café ☕" })
  expect(saved(created.draft).body).toBe("Literal \\n text\nand a line")
  const reply: any = yield* h.call("draft", { thread: "a2", body: "Count me in" })
  expect(reply).toMatchObject({ thread: "a2", to: ["Ravi <ravi@example.com>"], cc: [], subject: "Re: Nix meetup" })
  expect(saved(reply.draft).headers).toMatchObject({ "In-Reply-To": "<a21@example.com>", References: "<earlier@example.com> <a21@example.com>" })
  expect(saved(reply.draft).args).toContain("--thread-id")
  const updated: any = yield* h.call("draft_update", { draft: created.draft, to: ["new@example.com"], subject: "Replacement", body: "New text" })
  expect(updated.updated).toBe(true)
  expect(saved(created.draft).body).toBe("New text")
  expect(saved(created.draft).headers.To).toBe("new@example.com")
  expect(saved(created.draft).headers.Cc).toBeUndefined()
  expect(saved(created.draft).headers.Bcc).toBeUndefined()
  expect(h.calls.some(c => c.verb.id.includes("send"))).toBe(false)
})))

test("invalid drafts do not spawn, missing threads do not create, missing drafts name the account", () => run(h => Effect.gen(function*() {
  const base = { to: ["r@example.com"], subject: "hi", body: "text" }
  for (const args of [{ ...base, to: ["bad"] }, { ...base, subject: "hi\nBcc: victim@example.com" }, { ...base, body: "" }, { ...base, body: "x".repeat(262145) }, { ...base, cc: Array(50).fill("c@example.com") }, { body: "hi" }, { ...base, thread: "a2", cc: ["bad"] }]) {
    expect((yield* Effect.result(h.call("draft", args)))._tag).toBe("Failure")
  }
  expect(h.calls).toHaveLength(0)
  const missing = yield* Effect.result(h.call("draft", { thread: "ffff", body: "hi" }))
  expect(missing).toMatchObject({ _tag: "Failure", failure: { reason: "this thread is not in you@gmail.com" } })
  expect(h.calls.some(c => c.verb.id === "drafts.create")).toBe(false)
  const update = yield* Effect.result(h.call("draft_update", { ...base, draft: "unknown" }))
  expect(update).toMatchObject({ _tag: "Failure", failure: { reason: "this draft is not in you@gmail.com" } })
})))

test("draft replacements serialize and replies share the existing thread permit", () => run(h => Effect.gen(function*() {
  yield* h.call("draft", { thread: "a2", body: "First" })
  h.calls.length = 0
  yield* Effect.all([
    h.call("draft_update", { draft: "draft_1", thread: "a2", body: "Second" }),
    h.call("draft_update", { draft: "draft_1", thread: "a2", body: "Third" }),
    h.call("archive", { thread: "a2" }),
  ], { concurrency: 3 })
  const verbs = h.calls.filter(c => c.verb.id !== "labels.list").map(c => c.verb.id)
  for (const [i, verb] of verbs.entries()) if (verb === "drafts.update") expect(verbs[i - 1]).toBe("threads.get")
  expect(verbs.filter(v => v === "drafts.update")).toHaveLength(2)
})))

test("reply defaults use the last message and Reply-To, with explicit overrides and no double Re", () => run(h => Effect.gen(function*() {
  const { writeFileSync, readFileSync } = yield* Effect.promise(() => import("node:fs"))
  const { THREADS } = yield* Effect.promise(() => import("./appliance/testlib/fixtures.ts"))
  const thread = structuredClone(THREADS[2]!)
  const last = thread.messages.at(-1)!
  last.headers.push({ name: "Reply-To", value: "reply@example.com" })
  last.headers.find(header => header.name === "Subject")!.value = "Re: Invoice"
  writeFileSync(`${h.root}/thread-${thread.id}.json`, JSON.stringify(thread))
  const reply: any = yield* h.call("draft", { thread: thread.id, body: "Thanks" })
  expect(reply).toMatchObject({ to: ["reply@example.com"], subject: "Re: Invoice" })
  expect(JSON.parse(readFileSync(`${h.root}/draft-${reply.draft}.json`, "utf8")).headers["In-Reply-To"]).toBe("<a32@example.com>")
  const explicit: any = yield* h.call("draft", { thread: thread.id, to: ["other@example.com"], cc: ["copy@example.com"], subject: "Another subject", body: "Thanks" })
  expect(explicit).toMatchObject({ to: ["other@example.com"], cc: ["copy@example.com"], subject: "Another subject" })
  last.headers = last.headers.filter(header => header.name !== "Message-ID")
  writeFileSync(`${h.root}/thread-${thread.id}.json`, JSON.stringify(thread))
  h.calls.length = 0
  expect((yield* Effect.result(h.call("draft", { thread: thread.id, body: "Thanks" })))).toMatchObject({ _tag: "Failure", failure: { reason: "this thread's last message has no Message-ID to reply to" } })
  expect(h.calls.map(c => c.verb.id)).toEqual(["threads.get"])
})))

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
  expect(created).toMatchObject({ address: "you@gmail.com", draft: "draft_1", message: "message_draft_1", thread: null, subject: "Café ☕", updated: false })
  expect(saved(created.draft).headers).toMatchObject({ From: "you@gmail.com", To: "ravi@example.com", Cc: "copy@example.com", Bcc: "blind@example.com", Subject: "Café ☕" })
  expect(saved(created.draft).body).toBe("Literal \\n text\nand a line")
  const reply: any = yield* h.call("draft", { thread: "a2", body: "Count me in" })
  expect(reply).toMatchObject({ thread: "a2", to: ["ravi@example.com"], cc: [], subject: "Re: Nix meetup" })
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

test("drafts carry files, an update replaces them, and an update naming none drops them", () => run(h => Effect.gen(function*() {
  const { readFileSync, writeFileSync } = yield* Effect.promise(() => import("node:fs"))
  const { createHash } = yield* Effect.promise(() => import("node:crypto"))
  const saved = (id: string) => JSON.parse(readFileSync(`${h.root}/draft-${id}.json`, "utf8"))
  const sha = (data: Buffer | string) => createHash("sha256").update(data).digest("hex")
  const pdf = Buffer.from("%PDF-1.4 invoice bytes")
  const notes = "two lines\nof notes"
  writeFileSync(`${h.root}/invoice.pdf`, pdf)
  writeFileSync(`${h.root}/notes.txt`, notes)
  const base = { to: ["ravi@example.com"], subject: "Q3" }
  const created: any = yield* h.call("draft", { ...base, body: "See attached",
    attachments: [{ path: `${h.root}/invoice.pdf` }, { path: `${h.root}/notes.txt`, filename: "Café ☕.txt" }] })
  expect(created.attachments).toEqual([
    { filename: "invoice.pdf", type: "application/pdf", bytes: pdf.length },
    { filename: "Café ☕.txt", type: "text/plain", bytes: notes.length },
  ])
  expect(saved(created.draft).body).toBe("See attached")
  expect(saved(created.draft).attachments).toEqual([
    { filename: "invoice.pdf", type: "application/pdf", bytes: pdf.length, sha256: sha(pdf) },
    { filename: "Café ☕.txt", type: "text/plain", bytes: notes.length, sha256: sha(notes) },
  ])
  const updated: any = yield* h.call("draft_update", { ...base, draft: created.draft, body: "Just the notes", attachments: [{ path: `${h.root}/notes.txt`, type: "text/markdown" }] })
  expect(updated.attachments).toEqual([{ filename: "notes.txt", type: "text/markdown", bytes: notes.length }])
  expect(saved(created.draft).attachments).toEqual([{ filename: "notes.txt", type: "text/markdown", bytes: notes.length, sha256: sha(notes) }])
  const dropped: any = yield* h.call("draft_update", { ...base, draft: created.draft, body: "Nothing attached" })
  expect(dropped.attachments).toEqual([])
  expect(saved(created.draft).attachments).toEqual([])
  expect(saved(created.draft).body).toBe("Nothing attached")
  // An empty list is the other way to say it, and the schema takes it: an
  // agent replacing a draft has one shape for "carry these" and for "carry
  // nothing", rather than a refusal for the second.
  const emptied: any = yield* h.call("draft_update", { ...base, draft: created.draft, body: "Still nothing", attachments: [] })
  expect(emptied.attachments).toEqual([])
  expect(saved(created.draft).attachments).toEqual([])
  const fresh: any = yield* h.call("draft", { ...base, body: "Nothing to carry", attachments: [] })
  expect(fresh.attachments).toEqual([])
  expect(saved(fresh.draft).attachments).toEqual([])
  // A draft with no attachments is still the single text part it always was.
  expect(h.calls.at(-1)!.message).toContain("Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64")
  expect(h.calls.at(-1)!.message).not.toContain("multipart/mixed")
})))

test("an unattachable file refuses the whole draft before the thread is looked up", () => run(h => Effect.gen(function*() {
  const { writeFileSync } = yield* Effect.promise(() => import("node:fs"))
  writeFileSync(`${h.root}/notes.txt`, "notes")
  const base = { to: ["ravi@example.com"], subject: "Q3", body: "See attached" }
  const cases: Array<[unknown, string | undefined]> = [
    [{ ...base, attachments: [{ path: `${h.root}/nowhere.pdf` }] }, `there is no file to attach at ${h.root}/nowhere.pdf`],
    [{ ...base, attachments: [{ path: h.root, filename: "root.zip" }] }, `${h.root} is not a file, so it cannot be attached`],
    [{ ...base, attachments: [{ path: `${h.root}/notes.txt` }, { path: `${h.root}/../notes.txt` }] }, "two mail attachments would arrive as notes.txt; give one of them its own filename"],
    [{ ...base, attachments: [{ path: `${h.root}/notes.txt`, type: "text" }] }, undefined],
    [{ ...base, attachments: [{ path: "notes.txt" }] }, undefined],
    [{ ...base, attachments: Array.from({ length: 11 }, () => ({ path: `${h.root}/notes.txt` })) }, undefined],
    [{ ...base, thread: "a2", attachments: [{ path: `${h.root}/nowhere.pdf` }] }, `there is no file to attach at ${h.root}/nowhere.pdf`],
  ]
  for (const [args, reason] of cases) {
    const result = yield* Effect.result(h.call("draft", args))
    expect(result._tag).toBe("Failure")
    if (reason !== undefined && result._tag === "Failure") expect(result.failure).toMatchObject({ reason })
  }
  expect(h.calls).toHaveLength(0)
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

test("self follow-ups use the last message To list, case-insensitively, and preserve threading on replacement", () => run(h => Effect.gen(function*() {
  const reply: any = yield* h.call("draft", { thread: "a6", body: "Following up" })
  expect(reply.to).toEqual(["ravi@example.com", "jane@example.com"])
  const updated: any = yield* h.call("draft_update", { draft: reply.draft, thread: "a6", body: "Following up again" })
  expect(updated).toMatchObject({ thread: "a6", updated: true, to: reply.to })
  const create = h.calls.find(c => c.verb.id === "drafts.create")!
  const update = h.calls.find(c => c.verb.id === "drafts.update")!
  expect(h.calls.find(c => c.verb.id === "threads.get")!.args).toContain("To")
  for (const call of [create, update]) {
    expect(call.args).toContain("--thread-id")
    expect(call.message).toContain("In-Reply-To: <a62@example.com>")
    expect(call.message).toContain("To: ravi@example.com,\r\n jane@example.com")
  }
})))

test("default Reply-To lists strip encoded names and count all addresses before writing", () => run(h => Effect.gen(function*() {
  const { writeFileSync } = yield* Effect.promise(() => import("node:fs"))
  const { THREADS } = yield* Effect.promise(() => import("./appliance/testlib/fixtures.ts"))
  const thread = structuredClone(THREADS[1]!)
  const header = { name: "Reply-To", value: '"Doe, Jane" <jane@example.com>, =?UTF-8?B?UmVuw6ll?= <r@example.com>' }
  thread.messages[0]!.headers.push(header)
  const save = () => writeFileSync(`${h.root}/thread-${thread.id}.json`, JSON.stringify(thread))
  save()
  const reply: any = yield* h.call("draft", { thread: thread.id, cc: ["copy@example.com"], body: "Hello" })
  expect(reply).toMatchObject({ to: ["jane@example.com", "r@example.com"], cc: ["copy@example.com"] })
  header.value = Array.from({ length: 51 }, (_, i) => `r${i}@example.com`).join(", ")
  save()
  h.calls.length = 0
  const refused = yield* Effect.result(h.call("draft", { thread: thread.id, body: "Hello" }))
  expect(refused).toMatchObject({ _tag: "Failure", failure: { reason: "mail drafts allow at most 50 recipients" } })
  expect(h.calls.map(c => c.verb.id)).toEqual(["threads.get"])
  header.value = Array.from({ length: 50 }, (_, i) => `r${i}@example.com`).join(", ")
  save()
  const fifty: any = yield* h.call("draft", { thread: thread.id, body: "Hello" })
  expect(fifty.to).toHaveLength(50)
  expect(fifty.message).not.toBe(reply.message)
})))

test("composer defects remain defects through the mailbox boundary", async () => {
  const { Cause, Exit } = await import("effect")
  const exit = await Effect.runPromiseExit(Effect.scoped(Effect.gen(function*() {
    const mailbox = yield* openMailbox({ binary: "/unused", useToken: () => Effect.void, close: async () => {}, run: () => Effect.die("must not spawn") }, { current: () => connected, usable: () => true })
    return yield* mailbox.draft({ to: ["r@example.com"], subject: "Hi", get body(): string { throw new TypeError("composer defect") } })
  })))
  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isFailure(exit)) {
    expect(Cause.hasDies(exit.cause)).toBe(true)
    expect(Cause.pretty(exit.cause)).toContain("composer defect")
  }
})


test("empty reply defaults explain how to supply recipients, without writing", () => run(h => Effect.gen(function*() {
  const { writeFileSync } = yield* Effect.promise(() => import("node:fs"))
  const { THREADS } = yield* Effect.promise(() => import("./appliance/testlib/fixtures.ts"))
  const thread = structuredClone(THREADS.find(thread => thread.id === "a6")!)
  const last = thread.messages.at(-1)!
  const file = `${h.root}/thread-${thread.id}.json`
  const headers = last.headers
  for (const value of [undefined, "", "   "]) {
    last.headers = headers.filter(header => header.name !== "To")
    if (value !== undefined) last.headers.push({ name: "To", value })
    writeFileSync(file, JSON.stringify(thread))
    h.calls.length = 0
    const refused = yield* Effect.result(h.call("draft", { thread: thread.id, body: "Following up" }))
    expect(refused).toMatchObject({ _tag: "Failure", failure: { reason: "this thread names no one to reply to; pass `to`" } })
    expect(h.calls.map(call => call.verb.id)).toEqual(["threads.get"])
    const supplied: any = yield* h.call("draft", { thread: thread.id, to: ["ravi@example.com"], body: "Following up" })
    expect(supplied.to).toEqual(["ravi@example.com"])
  }
})))

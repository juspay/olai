import { openMailbox } from "./mailbox.ts"
import { expect, test } from "bun:test"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Effect } from "effect"
import { harness, connected } from "./tools.testlib.ts"
import { MAIL_UNCONNECTED } from "./wire.ts"
import type { Run } from "./himalaya/run.ts"

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
  const args = { body: "Hello", draft: "draft_1", thread: "a1", message: "a32", attachment: "attachment_1", query: "is:unread", add: ["waiting"], read: true, action: "label" }
  for (const state of [MAIL_UNCONNECTED, { ...connected, status: "fault" as const, reason: "invalid_grant" }, connected]) {
    h.state(state, false)
    for (const name of ["inbox", "search", "thread", "attachment", "archive", "trash", "untrash", "label", "read", "bulk", "draft", "draft_update"]) {
      const result = yield* Effect.result(h.call(name, args))
      expect(result._tag).toBe("Failure")
      if (name === "bulk") expect(result).toMatchObject({ failure: { reason: expect.stringMatching(/connect one|invalid_grant|expired/) } })
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

/** Threads this file writes beside the fixtures, as the fake reads them: one message each, in the inbox. */
const extra = (root: string, ids: ReadonlyArray<string>, subject: string) => {
  for (const [i, id] of ids.entries()) writeFileSync(join(root, `thread-${id}.json`), JSON.stringify({ id, messages: [{
    id: `${id}1`, "label-ids": ["INBOX"], snippet: `${subject} ${i} preview`,
    headers: [{ name: "Subject", value: `${subject} ${i}` }, { name: "From", value: "Ravi <ravi@example.com>" }, { name: "Date", value: "Tue, 15 Sep 2026 10:00:00 +0000" }],
    payload: { mimeType: "text/plain", parts: [] },
  }] }))
}
const twelve = Array.from({ length: 12 }, (_, i) => `b${i.toString(16)}`)
const WRITES = ["threads.modify", "threads.trash", "threads.untrash"]
/** The thread verbs one id saw, in order, listings aside. */
const verbsFor = (calls: ReadonlyArray<Run>, id: string) => calls.filter(c => c.verb.id.startsWith("threads.") && c.verb.id !== "threads.list" && c.args?.[0] === id).map(c => c.verb.id)
const QUOTA = "403 Quota exceeded for quota metric 'Queries' and limit 'Queries per minute per user'"

test("bulk by id list applies each action once per thread and answers a row per id, in order", () => run(h => Effect.gen(function*() {
  const archived: any = yield* h.call("bulk", { action: "archive", threads: ["a3", "a1", "a2"] })
  expect(archived).toMatchObject({ mail: "bulk", address: "you@gmail.com", action: "archive", counts: { applied: 3, unchanged: 0, failed: 0, skipped: 0 }, stopped: null })
  expect(archived.threads.map((t: any) => [t.id, t.subject, t.outcome])).toEqual([["a3", "Invoice conversation", "applied"], ["a1", "Q3 invoice", "applied"], ["a2", "Nix meetup", "applied"]])
  expect(archived.threads[1]).toMatchObject({ from: "Ravi <ravi@example.com>", messages: 1, unread: true, labels: ["INBOX", "UNREAD"] })
  for (const id of ["a1", "a2", "a3"]) expect(verbsFor(h.calls, id)).toEqual(["threads.get", "threads.modify"])
  expect((yield* h.call("inbox") as Effect.Effect<any>).threads).toHaveLength(0)
  const trashed: any = yield* h.call("bulk", { action: "trash", threads: ["a2", "a4"] })
  expect(trashed.threads.map((t: any) => t.outcome)).toEqual(["applied", "applied"])
  expect((yield* h.call("search", { query: "in:trash" }) as Effect.Effect<any>).threads.map((t: any) => t.id).sort()).toEqual(["a2", "a4"])
  const restored: any = yield* h.call("bulk", { action: "untrash", threads: ["a4", "a2"] })
  expect(restored.threads.map((t: any) => [t.id, t.labels.includes("TRASH"), t.outcome])).toEqual([["a4", true, "applied"], ["a2", true, "applied"]])
  expect((yield* h.call("search", { query: "in:trash" }) as Effect.Effect<any>).threads).toHaveLength(0)
  expect((yield* h.call("bulk", { action: "read", threads: ["a1"] }) as Effect.Effect<any>).counts.applied).toBe(1)
  expect((yield* h.call("search", { query: "is:unread" }) as Effect.Effect<any>).threads).toHaveLength(0)
  expect((yield* h.call("bulk", { action: "unread", threads: ["a1", "a2"] }) as Effect.Effect<any>).counts.applied).toBe(2)
  expect((yield* h.call("search", { query: "is:unread" }) as Effect.Effect<any>).threads).toHaveLength(2)
  expect(h.calls.filter(c => c.verb.id === "labels.list")).toHaveLength(1)
})))

test("bulk label resolves names once, and leaves the mailbox as labelled", () => run(h => Effect.gen(function*() {
  const labelled: any = yield* h.call("bulk", { action: "label", threads: ["a1", "a2"], add: ["Waiting"], remove: ["INBOX"] })
  expect(labelled.counts).toEqual({ applied: 2, unchanged: 0, failed: 0, skipped: 0 })
  expect(h.calls.filter(c => c.verb.id === "labels.list")).toHaveLength(1)
  expect(h.calls.filter(c => c.verb.id === "threads.modify").map(c => c.args)).toEqual([["a1", "--add-label", "Label_1", "--remove-label", "INBOX"], ["a2", "--add-label", "Label_1", "--remove-label", "INBOX"]])
  expect((yield* h.call("search", { query: "is:unread" }) as Effect.Effect<any>).threads[0].labels).toEqual(["UNREAD", "waiting"])
  expect((yield* h.call("inbox") as Effect.Effect<any>).threads.map((t: any) => t.id)).toEqual(["a3"])
})))

test("a thread already where the action puts it is reported unchanged and not written", () => run(h => Effect.gen(function*() {
  yield* h.call("trash", { thread: "a3" })
  h.calls.length = 0
  for (const [action, id, extraArgs] of [["archive", "a4", {}], ["trash", "a3", {}], ["untrash", "a2", {}], ["read", "a2", {}], ["unread", "a1", {}], ["label", "a5", { add: ["waiting"] }], ["label", "a2", { remove: ["waiting"] }]] as const) {
    const answer: any = yield* h.call("bulk", { action, threads: [id], ...extraArgs })
    expect(answer.threads).toEqual([expect.objectContaining({ id, outcome: "unchanged" })])
    expect(answer.counts).toEqual({ applied: 0, unchanged: 1, failed: 0, skipped: 0 })
  }
  expect(h.calls.filter(c => WRITES.includes(c.verb.id))).toHaveLength(0)
})))

test("bulk refuses malformed arguments before any thread is touched", () => run(h => Effect.gen(function*() {
  const fifty1 = Array.from({ length: 51 }, (_, i) => i.toString(16))
  for (const args of [
    { action: "archive" }, { action: "archive", threads: ["a1"], query: "is:unread" }, { action: "archive", threads: [] }, { action: "archive", threads: fifty1 },
    { action: "archive", threads: ["zz"] }, { action: "delete", threads: ["a1"] }, { threads: ["a1"] },
    { action: "archive", query: "is:unread", max: 0 }, { action: "archive", query: "is:unread", max: 51 }, { action: "archive", query: "is:unread", max: 1.5 },
    { action: "archive", query: "" }, { action: "archive", query: "   " }, { action: "archive", query: "is:unread", confirm: "XYZ" },
    { action: "archive", threads: ["a1"], confirm: "0123456789abcdef" }, { action: "archive", threads: ["a1"], max: 5 }, { action: "archive", threads: ["a1"], includeSpamTrash: true },
    { action: "archive", threads: ["a1"], add: ["waiting"] }, { action: "trash", query: "is:unread", remove: ["INBOX"] },
    { action: "label", threads: ["a1"] }, { action: "label", threads: ["a1"], add: [] }, { action: "label", threads: ["a1"], add: ["missing"] },
    { action: "label", query: "is:unread", add: ["waiting"], remove: ["Waiting"] },
  ]) expect((yield* Effect.result(h.call("bulk", args)))._tag).toBe("Failure")
  expect(h.calls.filter(c => c.verb.id.startsWith("threads."))).toHaveLength(0)
})))

test("duplicate ids are read and written once; a missing id fails alone and names the account", () => run(h => Effect.gen(function*() {
  const answer: any = yield* h.call("bulk", { action: "archive", threads: ["a1", "ffff", "a1", "a2"] })
  expect(answer.threads).toEqual([
    expect.objectContaining({ id: "a1", outcome: "applied" }),
    { id: "ffff", outcome: "failed", reason: "this thread is not in you@gmail.com" },
    expect.objectContaining({ id: "a2", outcome: "applied" }),
  ])
  expect(answer.counts).toEqual({ applied: 2, unchanged: 0, failed: 1, skipped: 0 })
  expect(answer.stopped).toBeNull()
  expect(verbsFor(h.calls, "a1")).toEqual(["threads.get", "threads.modify"])
})))

test("a missing thread on the write itself fails alone too", () => Effect.runPromise(harness(h => Effect.gen(function*() {
  const answer: any = yield* h.call("bulk", { action: "trash", threads: ["a1", "a2", "a3"] })
  expect(answer.threads.map((t: any) => [t.id, t.outcome, t.reason])).toEqual([["a1", "applied", undefined], ["a2", "failed", "this thread is not in you@gmail.com"], ["a3", "applied", undefined]])
  expect(answer.threads[1].subject).toBe("Nix meetup")
  expect(answer.stopped).toBeNull()
}), false, call => call.verb.id === "threads.trash" && call.args?.[0] === "a2" ? "404 Requested entity was not found." : undefined)))

for (const [where, verb] of [["read", "threads.get"], ["write", "threads.modify"]] as const) {
  test(`a quota failure on a ${where} stops the run: the rest are skipped and nothing new starts`, () => Effect.runPromise(harness(h => Effect.gen(function*() {
      extra(h.root, twelve, "Bulk notice")
      const answer: any = yield* h.call("bulk", { action: "archive", threads: twelve })
      expect(answer.threads.map((t: any) => t.id)).toEqual(twelve)
      expect(answer.stopped).toBe(QUOTA)
      const failed = answer.threads.findIndex((t: any) => t.outcome === "failed")
      expect(answer.threads[failed]).toMatchObject({ id: "b3", reason: QUOTA })
      expect(answer.counts.applied + answer.counts.unchanged + answer.counts.failed + answer.counts.skipped).toBe(12)
      expect(answer.counts.skipped).toBeGreaterThanOrEqual(12 - 4 - failed)
      for (const [i, row] of answer.threads.entries()) {
        if (i < failed) expect(row.outcome).not.toBe("skipped")
        if (row.outcome === "skipped") expect(verbsFor(h.calls, row.id)).toEqual([])
        if (i > failed + 3) expect(row.outcome).toBe("skipped")
      }
    }), false, call => call.verb.id === verb && call.args?.[0] === "b3" ? QUOTA : undefined)))
}

test("a query preview writes nothing and shows what it covers", () => run(h => Effect.gen(function*() {
  extra(h.root, twelve, "Bulk notice")
  const preview: any = yield* h.call("bulk", { action: "trash", query: "notice" })
  expect(preview).toMatchObject({ mail: "bulk", action: "trash", query: "notice", matched: 12, more: false })
  expect(preview.threads.map((t: any) => t.id).sort()).toEqual(twelve)
  for (const t of preview.threads) expect(t.snippet).toMatch(/^Bulk notice \d+ preview$/)
  expect(preview.sample).toHaveLength(10)
  expect(preview.sample.map((t: any) => t.id)).toEqual(preview.threads.slice(0, 10).map((t: any) => t.id))
  expect(preview.sample[0]).toMatchObject({ subject: expect.stringMatching(/^Bulk notice/), labels: ["INBOX"], messages: 1 })
  expect(preview.confirm).toMatch(/^[0-9a-f]{16}$/)
  expect(preview.counts).toBeUndefined()
  expect(h.calls.filter(c => c.verb.id === "threads.get")).toHaveLength(10)
  expect(h.calls.filter(c => WRITES.includes(c.verb.id))).toHaveLength(0)
  expect(h.calls.find(c => c.verb.id === "threads.list")?.args).toEqual(["-s", "51", "-q", "notice"])
  const capped: any = yield* h.call("bulk", { action: "trash", query: "notice", max: 5 })
  expect(capped).toMatchObject({ matched: 5, more: true })
  expect(capped.threads).toHaveLength(5)
  expect(capped.confirm).not.toBe(preview.confirm)
  const none: any = yield* h.call("bulk", { action: "trash", query: "nothing-here" })
  expect(none).toMatchObject({ matched: 0, more: false, threads: [], sample: [] })
  expect("confirm" in none).toBe(false)
  expect(yield* Effect.result(h.call("bulk", { action: "trash", query: "nothing-here", confirm: preview.confirm }))).toMatchObject({ _tag: "Failure", failure: { reason: expect.stringContaining("nothing matches") } })
  expect(h.calls.filter(c => WRITES.includes(c.verb.id))).toHaveLength(0)
})))

test("confirm applies exactly the previewed threads, and refuses when the set or the action changed", () => run(h => Effect.gen(function*() {
  const preview: any = yield* h.call("bulk", { action: "archive", query: "invoice" })
  expect(preview.threads).toEqual([{ id: "a1", snippet: "Q3 invoice" }, { id: "a3", snippet: "Re: Invoice conversation" }])
  const wrongAction = yield* Effect.result(h.call("bulk", { action: "trash", query: "invoice", confirm: preview.confirm }))
  expect(wrongAction).toMatchObject({ _tag: "Failure", failure: { reason: expect.stringContaining("changed since the preview") } })
  extra(h.root, ["c1"], "Late invoice")
  const changed = yield* Effect.result(h.call("bulk", { action: "archive", query: "invoice", confirm: preview.confirm }))
  expect(changed).toMatchObject({ _tag: "Failure", failure: { reason: expect.stringContaining("changed since the preview") } })
  expect(h.calls.filter(c => WRITES.includes(c.verb.id))).toHaveLength(0)
  const again: any = yield* h.call("bulk", { action: "archive", query: "invoice" })
  expect(again.matched).toBe(3)
  const applied: any = yield* h.call("bulk", { action: "archive", query: "invoice", confirm: again.confirm })
  expect(applied).toMatchObject({ query: "invoice", matched: 3, more: false, stopped: null, counts: { applied: 3, unchanged: 0, failed: 0, skipped: 0 } })
  expect(applied.threads.map((t: any) => t.id)).toEqual(again.threads.map((t: any) => t.id))
  expect(applied.threads.map((t: any) => t.subject)).toEqual(expect.arrayContaining(["Q3 invoice", "Invoice conversation", "Late invoice 0"]))
  expect(h.calls.filter(c => WRITES.includes(c.verb.id)).map(c => c.args?.[0]).sort()).toEqual(["a1", "a3", "c1"])
  expect((yield* h.call("inbox") as Effect.Effect<any>).threads.map((t: any) => t.id)).toEqual(["a2"])
})))

test("a thread with one message in Trash and a newer one in the inbox is listed, trashed, and then gone", () => run(h => Effect.gen(function*() {
  yield* h.call("trash", { thread: "a2" })
  const saved = JSON.parse(readFileSync(join(h.root, "thread-a2.json"), "utf8"))
  saved.messages.push({ ...saved.messages[0], id: "a22", "label-ids": ["INBOX", "UNREAD"], snippet: "Nix meetup moved" })
  writeFileSync(join(h.root, "thread-a2.json"), JSON.stringify(saved))
  expect((yield* h.call("search", { query: "meetup" }) as Effect.Effect<any>).threads.map((t: any) => t.id)).toEqual(["a2"])
  const preview: any = yield* h.call("bulk", { action: "trash", query: "meetup" })
  expect(preview.threads).toEqual([{ id: "a2", snippet: "Nix meetup moved" }])
  expect(preview.sample[0].labels).toEqual(expect.arrayContaining(["INBOX", "TRASH"]))
  const trashed: any = yield* h.call("bulk", { action: "trash", query: "meetup", confirm: preview.confirm })
  expect(trashed.threads).toEqual([expect.objectContaining({ id: "a2", outcome: "applied" })])
  expect((yield* h.call("search", { query: "meetup" }) as Effect.Effect<any>).threads).toHaveLength(0)
  expect((yield* h.call("bulk", { action: "trash", threads: ["a2"] }) as Effect.Effect<any>).threads[0].outcome).toBe("unchanged")
})))

test("a query reaches trashed threads only with includeSpamTrash, and an untrash by query restores them", () => run(h => Effect.gen(function*() {
  yield* h.call("trash", { thread: "a2" })
  h.calls.length = 0
  const without: any = yield* h.call("bulk", { action: "untrash", query: "meetup" })
  expect(without).toMatchObject({ matched: 0, threads: [] })
  expect(h.calls.find(c => c.verb.id === "threads.list")?.args).toEqual(["-s", "51", "-q", "meetup"])
  h.calls.length = 0
  const preview: any = yield* h.call("bulk", { action: "untrash", query: "meetup", includeSpamTrash: true })
  expect(preview).toMatchObject({ matched: 1, threads: [{ id: "a2", snippet: "Nix meetup" }] })
  expect(preview.sample[0].labels).toContain("TRASH")
  expect(h.calls.find(c => c.verb.id === "threads.list")?.args).toEqual(["-s", "51", "-q", "meetup", "--include-spam-trash"])
  const restored: any = yield* h.call("bulk", { action: "untrash", query: "meetup", includeSpamTrash: true, confirm: preview.confirm })
  expect(restored.threads).toEqual([expect.objectContaining({ id: "a2", outcome: "applied" })])
  expect(h.calls.filter(c => c.verb.id === "threads.untrash").map(c => c.args?.[0])).toEqual(["a2"])
  expect((yield* h.call("search", { query: "meetup" }) as Effect.Effect<any>).threads.map((t: any) => t.id)).toEqual(["a2"])
})))

test("a fifty-thread bulk write never runs more than four Himalaya children", async () => {
  const { makeTools } = await import("./tools.ts")
  const { THREADS, LABELS } = await import("./appliance/testlib/fixtures.ts")
  let active = 0
  let peak = 0
  const ids = Array.from({ length: 50 }, (_, i) => i.toString(16))
  const answer: any = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const tools = yield* makeTools(yield* openMailbox({ binary: "/fake", useToken: () => Effect.void, close: async () => {}, run: call => Effect.acquireUseRelease(
      Effect.sync(() => { active++; peak = Math.max(peak, active) }),
      () => Effect.sleep("2 millis").pipe(Effect.as(call.verb.id === "labels.list" ? LABELS : call.verb.id === "threads.get" ? { ...THREADS[0], id: call.args?.[0] } : "modified")),
      () => Effect.sync(() => { active-- }),
    ) }, { current: () => connected, usable: () => true }))
    const tool = tools.find(t => t.name === "bulk")!
    if (tool.kind !== "surface") throw new Error("wrong tool kind")
    return yield* tool.call(undefined as never, { action: "archive", threads: ids } as never)
  })))
  expect(answer.counts.applied).toBe(50)
  expect(peak).toBe(4)
  expect(active).toBe(0)
})

test("closing mail mid-run cuts the bulk call and starts no further spawn", async () => {
  const { makeTools } = await import("./tools.ts")
  const { Deferred, Exit, Fiber, Scope } = await import("effect")
  const { THREADS, LABELS } = await import("./appliance/testlib/fixtures.ts")
  const scope = Scope.makeUnsafe()
  const entered = Deferred.makeUnsafe<void>()
  let cut = 0
  let spawns = 0
  const tools = await Effect.runPromise(Effect.provideService(openMailbox({ binary: "/fake", useToken: () => Effect.void, close: async () => {}, run: call => {
    spawns++
    if (call.verb.id === "labels.list") return Effect.succeed(LABELS)
    if (call.verb.id === "threads.get") return Effect.succeed({ ...THREADS[0], id: call.args?.[0] })
    return Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never), Effect.ensuring(Effect.sync(() => { cut++ })))
  } }, { current: () => connected, usable: () => true }).pipe(Effect.flatMap(makeTools)), Scope.Scope, scope))
  const tool = tools.find(t => t.name === "bulk")!
  if (tool.kind !== "surface") throw new Error("wrong tool kind")
  const fiber = Effect.runFork(tool.call(undefined as never, { action: "trash", threads: twelve } as never))
  await Effect.runPromise(Deferred.await(entered))
  await Effect.runPromise(Scope.close(scope, Exit.void))
  const closed = spawns
  expect(cut).toBeGreaterThan(0)
  await Effect.runPromise(Fiber.await(fiber))
  expect(spawns).toBe(closed)
})

import { expect, test } from "bun:test"
import { Effect, Fiber, Deferred } from "effect"
import { UsageFailure, serializeOutline, type WriteRequest } from "@olai/format"
import { readingOf, setOf, planning } from "@olai/ops/testlib"
import type { SessionInfo, Listed } from "olai-plugin-chat/wire"
import { vaultEvents } from "@olai/plugin-api/services"
import { makeFiler, claimed, fileListed, noteOf, type Filing } from "./filer.ts"

const row = (id: string, supersededBy: string | null = null): SessionInfo => ({
  id, agent: "claude", title: id, messageCount: 2, updatedAt: "2026-09-10T12:34:00Z", supersededBy,
})
const listed = (...sessions: SessionInfo[]): Listed => ({ sessions, unreachable: [] })
const fixture = (files: Record<string, string> = {}) => {
  const texts = { ...files }
  const writes: WriteRequest[] = []
  const logs: string[] = []
  const assigned: string[] = []
  let refuse: (request: WriteRequest) => boolean = () => false
  const filing: Filing = {
    read: Effect.sync(() => readingOf(setOf(texts))),
    current: () => "Inbox.olai", key: () => "chat-agent-session",
    log: line => Effect.sync(() => { logs.push(line) }),
    assigned: to => Effect.sync(() => { assigned.push(to.session) }),
    write: request => Effect.gen(function*() {
      writes.push(request)
      if (refuse(request)) return yield* new UsageFailure({ reason: "refused by this validator" })
      const plan = planning(setOf(texts), request)
      if (plan._tag === "Failure") return yield* plan.failure
      for (const file of plan.success.files) texts[file.file] = serializeOutline(file.nodes)
    }),
  }
  return { filing, writes, logs, assigned, texts, refuse: (f: typeof refuse) => { refuse = f } }
}

test("Chats gets its own write, then only unclaimed heads; repeating mints nothing", async () => {
  const it = fixture()
  const sessions = listed(row("head"), row("old", "head"), row("other"))
  await Effect.runPromise(fileListed(it.filing, "Inbox.olai", sessions))
  expect(it.writes.map(write => write.op)).toEqual(["create", "add", "add"])
  expect(it.assigned).toEqual(["head", "other"])
  expect(claimed(readingOf(setOf(it.texts)), sessions.sessions).size).toBe(3)
  await Effect.runPromise(fileListed(it.filing, "Inbox.olai", sessions))
  expect(it.writes).toHaveLength(3)
})

test("a refused Chats write files nothing and retries next run", async () => {
  const it = fixture()
  it.refuse(() => true)
  await Effect.runPromise(fileListed(it.filing, "Inbox.olai", listed(row("one"))))
  expect(it.writes).toHaveLength(1)
  expect(it.assigned).toEqual([])
  expect(it.logs.join()).toContain("refused by this validator")
  it.refuse(() => false)
  await Effect.runPromise(fileListed(it.filing, "Inbox.olai", listed(row("one"))))
  expect(it.assigned).toEqual(["one"])
})

test("a refused row preserves its neighbours and retries alone", async () => {
  const it = fixture()
  it.refuse(request => request.op === "add" && request.title === "bad")
  const sessions = listed(row("first"), row("bad"), row("last"))
  await Effect.runPromise(fileListed(it.filing, "Inbox.olai", sessions))
  expect(it.assigned).toEqual(["first", "last"])
  it.refuse(() => false)
  await Effect.runPromise(fileListed(it.filing, "Inbox.olai", sessions))
  expect(it.assigned).toEqual(["first", "last", "bad"])
  expect(it.writes).toHaveLength(5)
})

test("trash claims its chain; an existing Chats root is reused", async () => {
  const it = fixture({ "Inbox.olai": '{"id":"chats","title":"Renamed","ord":"a0"}',
    "_olai/Trash.olai": '{"id":"put-away","title":"Old","ord":"a0","custom":{"chat-agent-session":"claude:gone"}}' })
  await Effect.runPromise(fileListed(it.filing, "Inbox.olai", listed(row("gone"), row("past", "gone"), row("new"))))
  expect(it.writes).toHaveLength(1)
  expect(it.assigned).toEqual(["new"])
})

test("interruption leaves completed rows claimed and the rest retries", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const it = fixture()
  const waiting = yield* Deferred.make<void>()
  const sessions = listed(row("first"), row("second"))
  const write = it.filing.write
  const interrupted: Filing = { ...it.filing, write: request => request.op === "add" && request.title === "second"
    ? Effect.andThen(Deferred.succeed(waiting, undefined), Effect.never) : write(request) }
  const run = yield* Effect.forkScoped(fileListed(interrupted, "Inbox.olai", sessions))
  yield* Deferred.await(waiting)
  yield* Fiber.interrupt(run)
  expect(it.assigned).toEqual(["first"])
  yield* fileListed(it.filing, "Inbox.olai", sessions)
  expect(it.assigned).toEqual(["first", "second"])
}))))

test("unreachable engines are logged and absent metadata never invents a value", async () => {
  const it = fixture()
  await Effect.runPromise(fileListed(it.filing, "Inbox.olai", { sessions: [], unreachable: [{ agent: "codex", why: "offline" }] }))
  expect(it.logs).toEqual(["filer: codex: offline"])
  expect(it.writes).toEqual([])
  expect(noteOf({ messageCount: null, updatedAt: null })).toEqual({})
  expect(noteOf({ messageCount: 0, updatedAt: null })).toEqual({ desc: "0 messages" })
  await Effect.runPromise(fileListed(it.filing, "Inbox.olai", listed({ ...row("untitled"), title: null, messageCount: null, updatedAt: null })))
  expect(it.writes[1]).toEqual({ op: "add", parent: "chats", title: "untitled", props: { "chat-agent-session": "claude:untitled" } })
})

test("absence does no listing; appearance runs fully; withdrawal interrupts without stopping chat", () =>
  Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const it = fixture()
    const inbox = vaultEvents("/tmp").door("chat").inbox
    const started = yield* Deferred.make<void>()
    const stopped = yield* Deferred.make<void>()
    let calls = 0
    const filer = yield* makeFiler({ ...it.filing, current: inbox.current }, inbox, {
      all: Effect.ensuring(Effect.gen(function*() {
        calls += 1
        yield* Deferred.succeed(started, undefined)
        return yield* Effect.never
      }), Deferred.succeed(stopped, undefined)), one: () => Effect.die("must not list without an Inbox"),
    })
    yield* filer.full
    yield* filer.settled("claude")
    expect(calls).toBe(0)
    expect(it.logs).toEqual(["filer: no Inbox entry; filing is inactive"])
    const leave = yield* Deferred.make<void>()
    const provider = yield* Effect.forkScoped(Effect.scoped(Effect.gen(function*() {
      yield* inbox.register("Inbox.olai")
      yield* Deferred.await(leave)
    })))
    yield* Deferred.await(started)
    yield* Deferred.succeed(leave, undefined)
    yield* Fiber.join(provider)
    yield* Deferred.await(stopped)
    expect(inbox.current()).toBeNull()
    yield* filer.full
    expect(calls).toBe(1)
    expect(it.writes).toEqual([])
    expect(it.logs).toHaveLength(3)
  }))))

test("a claim on one engine does not claim another engine's same session id", async () => {
  const it = fixture({ "claimed.olai": '{"id":"owned","ord":"a0","title":"Owned","custom":{"chat-agent-session":"claude:same"}}' })
  await Effect.runPromise(fileListed(it.filing, "Inbox.olai", listed(row("same"), { ...row("same"), agent: "opencode" })))
  expect(it.writes).toHaveLength(2)
  expect(it.writes[1]).toMatchObject({ props: { "chat-agent-session": "opencode:same" } })
})

test("settled turns request only their engine, never another full listing", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const it = fixture()
  const inbox = vaultEvents("/tmp").door("chat").inbox
  yield* inbox.register("Inbox.olai")
  const boot = yield* Deferred.make<void>()
  const narrow = yield* Deferred.make<void>()
  let full = 0
  const engines: string[] = []
  const filer = yield* makeFiler({ ...it.filing, current: inbox.current,
    log: line => line === "filer: full run complete" ? Effect.asVoid(Deferred.succeed(boot, undefined)) : Effect.void,
  }, inbox, {
    all: Effect.sync(() => { full += 1; return listed() }),
    one: engine => Effect.gen(function*() {
      engines.push(engine)
      yield* Deferred.succeed(narrow, undefined)
      return listed()
    }),
  })
  yield* Deferred.await(boot)
  yield* filer.settled("claude")
  yield* Deferred.await(narrow)
  expect(full).toBe(1)
  expect(engines).toEqual(["claude"])
}))))

import { expect, test } from "bun:test"
import { Effect } from "effect"
import { makeWatch, digest } from "./watch.ts"
import { openMemory } from "./local.ts"
import { doorOver } from "./local.testlib.ts"
import { connected } from "./tools.testlib.ts"
import { MailRefusal, MAIL_UNCONNECTED } from "./wire.ts"
import type { History } from "./himalaya/history.ts"
const row = (id: string) => ({ id, from: "Ravi", subject: "Invoice", date: "today", snippet: "Please review", unread: true, messages: 1, labels: ["INBOX"] })
const page = (id: string, threads: string[], inbox = true): History => ({ "history-id": id, history: [{ id, "messages-added-details": threads.map(id => ({ id: id + "1", "thread-id": id, "label-ids": inbox ? ["INBOX"] : [] })) }] })
const bench = (historyId: string | null = "10") => {
  const door = doorOver({ refreshToken: "rt", address: "you@gmail.com", connectedAt: "connection", scope: null, historyId })
  const memory = Effect.runSync(openMemory(door.door, () => {}))
  const held: Array<() => string | null> = []
  const calls: string[] = []
  let answer = page("11", ["a1"])
  let expired = false
  let refused = false
  const warnings: string[] = []
  let following: History | undefined
  let usable = true
  let active = true
  let epoch = 0
  const watch = makeWatch({ memory, clock: { now: () => "2026-09-15T09:14:00Z" },
    machine: { current: () => usable ? connected : MAIL_UNCONNECTED, usable: () => usable },
    mailbox: {
      seed: Effect.sync(() => { calls.push("seed"); return "20" }),
      history: (_since, token) => Effect.suspend(() => { calls.push("history"); return refused ? Effect.fail(new MailRefusal({ reason: "503 unavailable" })) : expired ? Effect.fail(new MailRefusal({ reason: "404 not found" })) : Effect.succeed(token && following ? following : answer) }),
      summary: id => Effect.sync(() => { calls.push(id); return row(id) }),
    },
    deliveries: { scopes: () => { const issued = epoch; return active ? [{ agent: "claude", session: "session", pick: true, current: () => active && epoch === issued }] : [] }, deliver: (_to, body) => Effect.sync(() => { expect(memory.current()?.historyId).not.toBe(answer["history-id"]); held.push(body) }) },
    debug: () => {}, warn: line => warnings.push(line),
  })
  return { choose: (on: boolean) => { active = on; epoch++ }, watch, memory, held, calls, warnings, refuse: (value: boolean) => { refused = value }, next: (value: History) => { following = value }, answer: (next: History) => { answer = next }, expired: () => { expired = true }, absent: () => { usable = false } }
}
test("history advances only after handing delivery thunks over; held polls coalesce all distinct threads", async () => {
  const b = bench()
  await Effect.runPromise(b.watch.poll)
  expect(b.memory.current()?.historyId).toBe("11")
  b.answer(page("12", ["a1", "a2"]))
  await Effect.runPromise(b.watch.poll)
  const body = b.held.at(-1)!()
  expect(body).toContain("2 threads since 09:14 UTC")
  expect(body).toContain("a1 (unread)")
  expect(body).toContain("a2 (unread)")
  expect(b.held[0]!()).toBeNull()
})
test("archived arrivals are ignored, and an expired cursor seeds silently", async () => {
  const b = bench()
  b.answer(page("11", ["a1"], false))
  await Effect.runPromise(b.watch.poll)
  expect(b.calls).toEqual(["history"])
  expect(b.held).toHaveLength(0)
  b.expired()
  await Effect.runPromise(b.watch.poll)
  expect(b.memory.current()?.historyId).toBe("20")
  expect(b.held).toHaveLength(0)
})
test("first seed is silent; off clears queued mail and re-enabling seeds without replaying the gap", async () => {
  const b = bench(null)
  await Effect.runPromise(b.watch.poll)
  expect(b.calls).toEqual(["seed"])
  b.answer(page("21", ["a1"]))
  await Effect.runPromise(b.watch.poll)
  b.choose(false)
  expect(b.held[0]!()).toBeNull()
  await Effect.runPromise(b.watch.poll)
  b.choose(true)
  await Effect.runPromise(b.watch.poll)
  expect(b.calls).toEqual(["seed", "history", "a1", "seed"])
})
test("a node with no account receives one notice and performs no mailbox work", async () => {
  const b = bench()
  b.absent()
  await Effect.runPromise(b.watch.poll)
  await Effect.runPromise(b.watch.poll)
  expect(b.held).toHaveLength(1)
  expect(b.held[0]!()).toContain("connect one in ⧉ plugins")
  expect(b.calls).toEqual([])
})
test("digest caps at fifty threads, retains ids and labels itself as machine-written", () => {
  const body = digest("you@gmail.com", "2026-09-15T09:14:00Z", Array.from({ length: 53 }, (_, i) => row(String(i))))
  expect(body.match(/^- /gm)).toHaveLength(50)
  expect(body).toContain("3 more threads")
  expect(body).toEndWith("Written by olai's mail watcher, not by a person.")
})

test("every history page is gathered before cursor advance, with thread deduplication", async () => {
  const b = bench()
  b.answer({ ...page("11", ["a1"]), next_page: "page2" })
  b.next(page("12", ["a1", "a2"]))
  await Effect.runPromise(b.watch.poll)
  expect(b.calls).toEqual(["history", "history", "a1", "a2"])
  expect(b.memory.current()?.historyId).toBe("12")
  expect(b.held[0]!()).toContain("2 threads")
})
test("a refused poll preserves the cursor, warns once, and retries successfully", async () => {
  const b = bench()
  b.refuse(true)
  await Effect.runPromise(b.watch.poll)
  await Effect.runPromise(b.watch.poll)
  expect(b.memory.current()?.historyId).toBe("10")
  expect(b.held).toHaveLength(0)
  expect(b.warnings).toHaveLength(1)
  b.refuse(false)
  await Effect.runPromise(b.watch.poll)
  expect(b.memory.current()?.historyId).toBe("11")
})

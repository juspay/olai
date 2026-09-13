import { expect, test } from "bun:test"
import { buildSurfaceClient } from "@kolu/surface/solid"
import { Effect, Exit, Queue, Scope, Stream } from "effect"
import { createMemo, createRoot } from "solid-js"
import { CHAT_OFF, surface, type Conversing } from "../../wire.ts"
import { holdChatWire } from "../wire.ts"
import { createChat } from "./state.ts"

const settle = async () => { for (let i = 0; i < 8; i++) await Bun.sleep(0) }

test("two Chats read and send to their own conversations and keep refusals separate", async () => {
  const released: Array<string> = []
  const sent: Array<unknown> = []
  const wire = createRoot(dispose => ({ dispose, client: buildSurfaceClient(surface, {
    unary: (_tag, input) => Effect.sync(() => { sent.push(input) }),
    stream: (tag, input) => Stream.callback<unknown>(queue => Effect.acquireRelease(
      Effect.sync(() => {
        const to = input as Conversing
        const member = tag.split("/").at(-2)
        Queue.offerUnsafe(queue, member === "state" ? {
          ...CHAT_OFF, status: "idle", uploadScope: `scope-${to.session}`,
          session: { id: to.session, title: null, updatedAt: null },
        } : { kind: "snapshot", entries: member === "transcript" ? [["user:1", {
          kind: "user", id: "user:1", seq: 1, since: "2026-09-11T00:00:00Z", text: to.session,
        }]] : [] })
        return `${to.session}/${member}`
      }), key => Effect.sync(() => { released.push(key) }))),
  }, () => true) }))
  const activation = Scope.makeUnsafe()
  await Effect.runPromise(holdChatWire(() => wire.client).pipe(Effect.provideService(Scope.Scope, activation)))
  const first = createRoot(dispose => ({ dispose, chat: createChat({ agent: "alpha", session: "one" }) }))
  const second = createRoot(dispose => ({ dispose, chat: createChat({ agent: "beta", session: "two" }) }))
  try {
    await settle()
    expect(first.chat.entry("user:1")()?.text).toBe("one")
    expect(second.chat.entry("user:1")()?.text).toBe("two")
    first.chat.refuse(["only the first gesture failed"])
    expect(first.chat.refused()?.message).toBe("only the first gesture failed")
    expect(second.chat.refused()).toBeNull()
    await second.chat.send("hello", [], [])
    expect(sent).toEqual([{ conv: { agent: "beta", session: "two" }, scope: "scope-two", text: "hello", attachments: [], context: [] }])
    first.dispose()
    await settle()
    expect(released.toSorted()).toEqual(["one/saying", "one/state", "one/transcript"])
    expect(second.chat.entry("user:1")()?.text).toBe("two")
  } finally {
    first.dispose(); second.dispose(); wire.dispose()
    await Effect.runPromise(Scope.close(activation, Exit.void))
  }
})

test("a send waits for its keyed opening, and disposal settles a queued gesture without sending", async () => {
  const states = new Map<string, Queue.Enqueue<unknown>>()
  const sent: Array<unknown> = []
  const wire = createRoot(dispose => ({ dispose, client: buildSurfaceClient(surface, {
    unary: (_tag, input) => Effect.sync(() => { sent.push(input) }),
    stream: (tag, input) => Stream.callback<unknown>(queue => Effect.sync(() => {
      const to = input as Conversing
      if (tag.split("/").at(-2) === "state") states.set(to.session, queue)
      else Queue.offerUnsafe(queue, { kind: "snapshot", entries: [] })
    })),
  }, () => true) }))
  const activation = Scope.makeUnsafe()
  await Effect.runPromise(holdChatWire(() => wire.client).pipe(Effect.provideService(Scope.Scope, activation)))
  const first = createRoot(dispose => ({ dispose, chat: createChat({ agent: "alpha", session: "opening" }) }))
  const second = createRoot(dispose => ({ dispose, chat: createChat({ agent: "alpha", session: "closed" }) }))
  try {
    await settle()
    const pending = first.chat.send("queued words", [], [])
    const abandoned = second.chat.send("kept words", [], [])
    await settle()
    expect(sent).toEqual([])
    second.dispose()
    expect(await abandoned).toBe(false)
    expect(second.chat.refused()?.message).toContain("your message was kept")
    Queue.offerUnsafe(states.get("opening")!, {
      ...CHAT_OFF, status: "idle", uploadScope: "opened-lifetime",
      session: { id: "opening", title: null, updatedAt: null },
    })
    expect(await pending).toBe(true)
    expect(sent).toEqual([{ conv: { agent: "alpha", session: "opening" }, scope: "opened-lifetime", text: "queued words", attachments: [], context: [] }])
  } finally {
    first.dispose(); second.dispose(); wire.dispose()
    await Effect.runPromise(Scope.close(activation, Exit.void))
  }
})

test("a paragraph opening wakes the row that grows and the row that stopped, not every row", async () => {
  // THE OPEN, from the reader's end: a replay opens a paragraph per message,
  // and every row asking "am I the one growing" of the shared memo was woken
  // by each of them — a whole transcript re-read per message it replayed.
  const queues = new Map<string, Queue.Enqueue<unknown>>()
  const keys = Array.from({ length: 20 }, (_, at) => `agent:${at}`)
  const wire = createRoot(dispose => ({ dispose, client: buildSurfaceClient(surface, {
    unary: () => Effect.void,
    stream: (tag, input) => Stream.callback<unknown>(queue => Effect.sync(() => {
      const to = input as Conversing
      const member = tag.split("/").at(-2) ?? ""
      queues.set(member, queue)
      Queue.offerUnsafe(queue, member === "state" ? {
        ...CHAT_OFF, status: "idle", uploadScope: `scope-${to.session}`,
        session: { id: to.session, title: null, updatedAt: null },
      } : { kind: "snapshot", entries: member === "transcript" ? keys.map((key, seq) => [key, {
        kind: "agent", id: key, seq, since: "2026-09-11T00:00:00Z", text: `said ${seq}`,
      }]) : [] })
    })),
  }, () => true) }))
  const activation = Scope.makeUnsafe()
  await Effect.runPromise(holdChatWire(() => wire.client).pipe(Effect.provideService(Scope.Scope, activation)))
  const opened = createRoot(dispose => ({ dispose, chat: createChat({ agent: "alpha", session: "long" }) }))
  const runs = new Map<string, number>()
  const readers = createRoot(dispose => {
    for (const key of keys) {
      createMemo(() => {
        runs.set(key, (runs.get(key) ?? 0) + 1)
        return opened.chat.entry(key)()
      })
    }
    return dispose
  })
  const woken = async (frame: unknown): Promise<ReadonlyArray<string>> => {
    const before = new Map(runs)
    Queue.offerUnsafe(queues.get("saying")!, frame)
    await settle()
    return [...runs].filter(([key, count]) => count !== before.get(key)).map(([key]) => key).sort()
  }
  try {
    await settle()
    expect(opened.chat.entry("agent:5")()?.text).toBe("said 5")
    expect(await woken({ kind: "delta", upserts: [["agent:5#6", { of: "agent:5", at: 6, text: " more" }]], removes: [] }))
      .toEqual(["agent:5"])
    expect(opened.chat.entry("agent:5")()?.text).toBe("said 5 more")
    expect(await woken({ kind: "delta", upserts: [["agent:9#6", { of: "agent:9", at: 6, text: " next" }]], removes: ["agent:5#6"] }))
      .toEqual(["agent:5", "agent:9"])
    expect(opened.chat.entry("agent:9")()?.text).toBe("said 9 next")
    expect(opened.chat.entry("agent:5")()?.text).toBe("said 5")
  } finally {
    readers(); opened.dispose(); wire.dispose()
    await Effect.runPromise(Scope.close(activation, Exit.void))
  }
})

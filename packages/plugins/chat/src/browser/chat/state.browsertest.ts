import { createConversation } from "../agents/conversation-reading.ts"
import type { Row } from "../agents/roster.ts"
import { createAgentReadings } from "../agents/reading.ts"
import type { Roster } from "../agents/answered.tsx"
import { expect, test } from "bun:test"
import { buildSurfaceClient } from "@kolu/surface/solid"
import { Effect, Exit, Queue, Scope, Stream } from "effect"
import { createMemo, createRoot, createSignal } from "solid-js"
import { CHAT_OFF, surface, type ChatState, type Conversing } from "../../wire.ts"
import { holdChatWire } from "../wire.ts"
import { createChat, createChatState } from "./state.ts"

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
    expect(second.chat.refused()?.message).toContain("Your message was kept")
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
  // Every row asks "am I the one growing" of one shared memo, and each message
  // that opens a paragraph moves it: read directly, that woke every row in the
  // conversation per message.
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


test("a node's new session waits for its matching draft owner while auth refusals remain visible", async () => {
  const queues = new Set<Queue.Enqueue<unknown>>()
  let current: ChatState = {
    ...CHAT_OFF, status: "idle", uploadScope: "first-lifetime",
    talking: { kind: "agent", id: "alpha", name: "Alpha", steers: false, queues: false, methods: [] },
    session: { id: "first", title: null, updatedAt: null },
  }
  const publish = (state: ChatState) => {
    current = state
    for (const queue of queues) Queue.offerUnsafe(queue, state)
  }
  const wire = createRoot(dispose => ({ dispose, client: buildSurfaceClient(surface, {
    unary: () => Effect.void,
    stream: () => Stream.callback<unknown>(queue => Effect.acquireRelease(Effect.sync(() => {
      queues.add(queue)
      Queue.offerUnsafe(queue, current)
    }), () => Effect.sync(() => { queues.delete(queue) }))),
  }, () => true) }))
  const activation = Scope.makeUnsafe()
  await Effect.runPromise(holdChatWire(() => wire.client).pipe(Effect.provideService(Scope.Scope, activation)))
  const first = createRoot(dispose => ({ dispose, state: createChatState({ node: "one" }, { agent: "alpha", session: "first" }) }))
  let closeNext = () => {}
  try {
    await settle()
    expect(first.state().session?.id).toBe("first")
    publish({ ...current, uploadScope: "next-lifetime", session: { id: "next", title: null, updatedAt: null } })
    await settle()
    // The binding has not arrived. Seeing "next" here would invite typing
    // into an owner about to be replaced by the binding's next reader.
    expect(first.state().session).toBeNull()
    expect(first.state().status).toBe("off")
    const next = createRoot(dispose => {
      closeNext = dispose
      return createChatState({ node: "one" }, { agent: "alpha", session: "next" })
    })
    await settle()
    expect(next().session?.id).toBe("next")
    publish({ ...current, session: null, unopened: { what: null, why: "Authentication required" }, signIn: { kind: "choosing" } })
    await settle()
    expect(next().signIn?.kind).toBe("choosing")
    expect(next().unopened?.why).toBe("Authentication required")
  } finally {
    first.dispose(); closeNext(); wire.dispose()
    await Effect.runPromise(Scope.close(activation, Exit.void))
  }
})

test("conversation views lease one activation-owned reading until the last view leaves", async () => {
  let opened = 0, released = 0
  const wire = createRoot(dispose => ({ dispose, client: buildSurfaceClient(surface, {
    unary: () => Effect.void,
    stream: (tag) => Stream.callback<unknown>(queue => Effect.acquireRelease(
      Effect.sync(() => {
        opened++
        Queue.offerUnsafe(queue, tag.split("/").at(-2) === "state" ? CHAT_OFF : { kind: "snapshot", entries: [] })
      }), () => Effect.sync(() => { released++ }))),
  }, () => true) }))
  const activation = Scope.makeUnsafe()
  await Effect.runPromise(holdChatWire(() => wire.client).pipe(Effect.provideService(Scope.Scope, activation)))
  const owner = createRoot(dispose => ({ dispose, reading: createAgentReadings({} as Roster) }))
  const pair = { agent: "alpha", session: "shared" }
  const view = () => createRoot(dispose => {
    const chat = owner.reading.conversation(pair, pair)
    const [shown, setShown] = createSignal(true)
    owner.reading.join("node", chat, shown)
    return { dispose, chat, setShown }
  })
  const first = view(), second = view()
  try {
    await settle()
    expect(first.chat).toBe(second.chat)
    expect(opened).toBe(3)
    first.setShown(false)
    await settle()
    expect(released).toBe(0)
    first.dispose()
    await settle()
    expect(released).toBe(0)
    second.dispose()
    await settle()
    expect(released).toBe(3)
  } finally {
    first.dispose(); second.dispose(); owner.dispose(); wire.dispose()
    await Effect.runPromise(Scope.close(activation, Exit.void))
  }
})


test("a refused fresh start signs in through the node while keeping the previous session UI", async () => {
  const sent: unknown[] = []
  const wire = createRoot(dispose => ({ dispose, client: buildSurfaceClient(surface, {
    unary: (_tag, input) => Effect.sync(() => { sent.push(input) }),
    stream: (tag, input) => Stream.callback<unknown>(queue => Effect.sync(() => {
      const node = "node" in (input as object)
      Queue.offerUnsafe(queue, tag.split("/").at(-2) === "state" ? {
        ...CHAT_OFF, status: "idle", uploadScope: node ? "fresh" : "previous",
        talking: { kind: "agent", id: "alpha", name: "Alpha", steers: false, queues: false, methods: [] },
        session: node ? null : { id: "old", title: null, updatedAt: null },
        unopened: node ? { what: null, why: "Authentication required" } : null,
      } : { kind: "snapshot", entries: [] })
    })),
  }, () => true) }))
  const activation = Scope.makeUnsafe()
  await Effect.runPromise(holdChatWire(() => wire.client).pipe(Effect.provideService(Scope.Scope, activation)))
  const [row, setRow] = createSignal<Row>({ id: "one", file: "Work.olai", title: "one", engine: "alpha", session: "old", memory: 1, standing: "idle", waiting: 0, said: null })
  const owner = createRoot(dispose => ({ dispose, reading: createAgentReadings({ at: () => row(), rows: () => [row()], engines: () => [], standings: () => [], only: () => null, missing: () => null, chats: () => null, unreachable: () => [], chatsRefusal: () => null, askChats: () => {} }) }))
  const view = createRoot(dispose => ({ dispose, reading: createConversation(owner.reading, () => "one", () => true) }))
  try {
    await settle()
    const previous = view.reading.chat()!.ui
    previous.folds.toggleFold("tool")
    setRow(value => ({ ...value, unopened: true }))
    await settle()
    expect(view.reading.pair()).toBeNull()
    expect(view.reading.chat()!.state().unopened?.why).toBe("Authentication required")
    view.reading.chat()!.signIn("device-code")
    await settle()
    expect(sent).toEqual([{ conv: { node: "one" }, scope: "fresh", method: "device-code" }])
    owner.reading.visit("one", { agent: "alpha", session: "old" })
    await settle()
    expect(view.reading.pair()).toEqual({ agent: "alpha", session: "old" })
    expect(view.reading.chat()!.ui).toBe(previous)
    view.reading.chat()!.loadSession("alpha", "next")
    expect(view.reading.pair()).toEqual({ agent: "alpha", session: "next" })
    view.reading.chat()!.loadSession("alpha", "old")
    expect(view.reading.pair()).toEqual({ agent: "alpha", session: "old" })
  } finally {
    view.dispose(); owner.dispose(); wire.dispose()
    await Effect.runPromise(Scope.close(activation, Exit.void))
  }
})

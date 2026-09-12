import { expect, test } from "bun:test"
import { buildSurfaceClient } from "@kolu/surface/solid"
import { Effect, Exit, Queue, Scope, Stream } from "effect"
import { createRoot } from "solid-js"
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

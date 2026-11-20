import { expect, test } from "bun:test"
import { Deferred, Effect, Fiber } from "effect"

import { type AgentItem, itemKey, UsageFailure } from "@olai/format"
import {
  type Conversations,
  Conversations as ConversationsKey,
  ConversationsWatch,
  definePlugin,
  mountPlugin,
  Offers,
  openPlugins,
} from "@olai/plugin-api/services"

import { conversationsProvision, type ConversationsOwner } from "./conversations.ts"
import type { Conversing } from "../sessions.ts"

const SEATED: Conversing = { agent: "claude", session: "sess-1" }

const README: AgentItem = { kind: "note", path: "plugins/timer/README.md" }

const host = () => openPlugins({ vars: {}, now: () => "2026-11-15T00:00:00.000Z" })

const provider = (owner: ConversationsOwner, leaving: Effect.Effect<void> = Effect.void) =>
  definePlugin({
    name: "chat",
    needs: [Offers],
    apply: Effect.gen(function*() {
      yield* Effect.addFinalizer(() => leaving)
      yield* (yield* Offers).offer(ConversationsKey, conversationsProvision(owner))
    }),
  })

const consumer = (took: (door: Conversations | undefined) => void) =>
  definePlugin({
    name: "vault-plugins",
    needs: [ConversationsWatch],
    apply: Effect.gen(function*() {
      took((yield* ConversationsWatch).current())
    }),
  })

test("a word said through the broker's door after the asking row unloaded lands nowhere", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const delivered: Array<{ readonly who: string; readonly text: string }> = []
    const owner: ConversationsOwner = {
      mint: () => Effect.succeed({ node: "node-1", to: SEATED, refusal: null }),
      send: () => Effect.void,
      seatAt: () => Effect.succeed(SEATED),
      chatsAt: (abouts) => Effect.succeed(new Set(abouts.map(itemKey))),
      deliver: (who, _to, text, current) =>
        Effect.sync(() => {
          if (!current()) return false
          delivered.push({ who, text })
          return true
        }),
      engines: () => [{ id: "claude", name: "Claude Code" }],
    }
    const plugins = yield* host()
    yield* mountPlugin(plugins.host, provider(owner))

    let door: Conversations | undefined
    const asking = yield* mountPlugin(plugins.host, consumer((taken) => { door = taken }))
    expect((yield* asking.report).state).toBe("running")
    expect(door).toBeDefined()

    expect(yield* door!.say({ about: README, text: "first" })).toBe(true)
    expect(delivered).toEqual([{ who: "vault-plugins", text: "first" }])

    yield* asking.dispose
    expect(yield* door!.say({ about: README, text: "second" })).toBe(false)
    expect(delivered).toEqual([{ who: "vault-plugins", text: "first" }])
  })))
})

test("a mint in flight when chat goes keeps the node it made and answers the refusal", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const minted: Array<string> = []
    const sending = yield* Deferred.make<void>()
    let gone = false
    const owner: ConversationsOwner = {
      mint: () =>
        Effect.sync(() => {
          minted.push("plugins/timer")
          return { node: "plugins/timer", to: SEATED, refusal: null }
        }),
      send: () =>
        Effect.gen(function*() {
          yield* Deferred.await(sending)
          if (gone) return yield* new UsageFailure({ reason: "the chat has stopped" })
        }),
      seatAt: () => Effect.succeed(SEATED),
      chatsAt: (abouts) => Effect.succeed(new Set(abouts.map(itemKey))),
      deliver: () => Effect.succeed(true),
      engines: () => [{ id: "claude", name: "Claude Code" }],
    }
    const plugins = yield* host()
    const chat = yield* mountPlugin(
      plugins.host,
      provider(owner, Effect.sync(() => { gone = true })),
    )

    let door: Conversations | undefined
    let watch: (() => Conversations | undefined) | undefined
    const asking = yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "vault-plugins",
        needs: [ConversationsWatch],
        apply: Effect.gen(function*() {
          const broker = yield* ConversationsWatch
          watch = broker.current
          door = broker.current()
        }),
      }),
    )

    const call = yield* Effect.forkScoped(door!.open({
      about: README,
      engine: "claude",
      say: "build me a timer",
      teach: ["Write server.ts first."],
    }))
    yield* Effect.yieldNow
    expect(minted).toEqual(["plugins/timer"])

    yield* chat.dispose
    yield* Deferred.succeed(sending, undefined)

    const answer = yield* Fiber.join(call)
    expect(answer.refusal).toBe("the chat has stopped")
    expect((yield* asking.report).state).toBe("running")
    expect(watch!()).toBeUndefined()
  })))
})

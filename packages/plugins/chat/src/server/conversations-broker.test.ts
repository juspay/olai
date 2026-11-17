/**
 * THE SAME DOOR, REACHED THE WAY THE ONLY REAL CONSUMER REACHES IT — through
 * core's broker, on a host, with two mounted rows.
 *
 * `./conversations.test.ts` plays the provision with a consumer this file's
 * subject is the absence of: a `{ current }` the test wrote itself. That is the
 * right bench for the policy and the wrong one for this question, because every
 * hop between a consuming fiber and these thunks is a place the consumer's
 * lifetime can be dropped, and a made-up lifetime proves none of them. It WAS
 * dropped: the facade stamps a provision with the activation's word AND its
 * lifetime, core's {@link ConversationsWatch} is itself a provision, and it
 * read the door behind it with the word alone. Every consumer was handed a door
 * whose gate answered "still here" forever, and the one thing the provision
 * promises — that a row which has unloaded cannot have words land under its
 * name — was unreachable in product code while passing in a suite.
 *
 * So both cases here mount a real consumer, name the broker the way
 * `vault-plugins` names it, and take the door out of `current()`. What is faked
 * is only what is BELOW the door: the mint, the send and the delivery are the
 * row's four thunks, and each of them has its own suite.
 */
import { expect, test } from "bun:test"
import { Deferred, Effect, Fiber } from "effect"

import { UsageFailure } from "@olai/format"
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

/** A host with nothing on it — none of what these cases ask about is a vault,
 *  and a row that stands behind a door needs no reading to do it. */
const host = () => openPlugins({ vars: {}, now: () => "2026-11-15T00:00:00.000Z" })

/** The row that stands behind the key, over whichever four thunks a case wants.
 *  Mounted under `chat`, which is the name the stamp is NOT: a message this
 *  door carries is the CONSUMER's. */
const provider = (owner: ConversationsOwner, leaving: Effect.Effect<void> = Effect.void) =>
  definePlugin({
    name: "chat",
    needs: [Offers],
    apply: Effect.gen(function*() {
      yield* Effect.addFinalizer(() => leaving)
      yield* (yield* Offers).offer(ConversationsKey, conversationsProvision(owner))
    }),
  })

/** The consumer `vault-plugins` is: it names the BROKER, never the key, and
 *  takes the door out of `current()` while a provider is up. */
const consumer = (took: (door: Conversations | undefined) => void) =>
  definePlugin({
    name: "vault-plugins",
    needs: [ConversationsWatch],
    apply: Effect.gen(function*() {
      took((yield* ConversationsWatch).current())
    }),
  })

/**
 * THE GATE CLOSES ON A ROW THAT HAS LEFT, through the broker and nothing else.
 *
 * The door is taken out of `current()` and HELD, which is not a contrivance: it
 * is what a consumer does for the length of a turn, and a delivery can be held
 * until somebody opens a conversation nobody is in, which can be days. The same
 * call, through the same door, before and after the asking row unloads — `true`
 * and a delivery under `vault-plugins`, then `false` and nothing.
 */
test("a word said through the broker's door after the asking row unloaded lands nowhere", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const delivered: Array<{ readonly who: string; readonly text: string }> = []
    const owner: ConversationsOwner = {
      mint: () => Effect.succeed({ node: "node-1", to: SEATED, refusal: null }),
      send: () => Effect.void,
      seatAt: () => Effect.succeed(SEATED),
      chatAt: () => Effect.succeed(true),
      deliver: (who, _to, text, current) =>
        Effect.sync(() => {
          // THE GATE IS READ AT THE LANDING and not only at the asking, which is
          // why it is handed down rather than checked once: the words reach an
          // agent at a turn boundary that may be long after the call.
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

    expect(yield* door!.say({ about: "/plugins/timer", text: "first" })).toBe(true)
    expect(delivered).toEqual([{ who: "vault-plugins", text: "first" }])

    // ...AND THE ROW GOES. Nothing else moves: chat is still up, the node is
    // still seated, the door is the same object the consumer was handed.
    yield* asking.dispose
    expect(yield* door!.say({ about: "/plugins/timer", text: "second" })).toBe(false)
    expect(delivered).toEqual([{ who: "vault-plugins", text: "first" }])
  })))
})

/**
 * ...AND A MINT IN FLIGHT WHEN CHAT IS SWITCHED OFF UNDER IT answers the node.
 *
 * The three acts are not one act, so there is a real instant between a node
 * written to the vault and a session started on it, and switching chat off
 * inside that instant is an ordinary thing for a person to do. The honest
 * answer is the one `open` already promises for a refused start, because what
 * the caller does with either is the same: a folder that exists and has no
 * agent in it is something somebody can open later, and a call that failed
 * whole would leave that folder behind under a name the retry is refused over.
 *
 * The consumer survives the provider, which is the broker's whole purpose —
 * it names {@link ConversationsWatch} and not the key, so chat leaving does not
 * unload it and there is still somebody to tell.
 */
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
      // THE FIRST MESSAGE IS WHERE THE ROW'S DEPARTURE IS FELT: the sessions and
      // the scheduler this send runs on are held on chat's own scope, so a send
      // after that scope closed is a refusal in the row's words, not a defect.
      send: () =>
        Effect.gen(function*() {
          yield* Deferred.await(sending)
          if (gone) return yield* new UsageFailure({ reason: "the chat has stopped" })
        }),
      seatAt: () => Effect.succeed(SEATED),
      chatAt: () => Effect.succeed(true),
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
      parent: null,
      title: "timer",
      about: "/plugins/timer",
      engine: "claude",
      say: "build me a timer",
      teach: ["Write server.ts first."],
    }))
    // The node is written; the first message is still in the air.
    yield* Effect.yieldNow
    expect(minted).toEqual(["plugins/timer"])

    yield* chat.dispose
    yield* Deferred.succeed(sending, undefined)

    const answer = yield* Fiber.join(call)
    expect(answer.node).toBe("plugins/timer")
    expect(answer.refusal).toBe("the chat has stopped")
    // The asker is still here to hear it, and what it would ask next is the
    // absence rather than a door that cannot work.
    expect((yield* asking.report).state).toBe("running")
    expect(watch!()).toBeUndefined()
  })))
})

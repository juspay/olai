/**
 * CORE'S `conversations` KEY, PLAYED WITH A MADE-UP CONSUMER.
 *
 * What is asserted here is the POLICY the provision owns, which is everything
 * that is decided per asking plugin: whose name a message carries, what a
 * conversation that is not there answers, what a refused start and a refused
 * first message both come back as, and that the caller's sentences reach the
 * teaching seam as lines rather than as themselves. The mint, the panel and
 * the scheduler are the owner's, faked here — each of them has its own suite
 * where it is the subject (`./new-chat.test.ts`, `../teaching.send.test.ts`).
 *
 * THE CONSUMER HERE IS MADE UP, and a made-up consumer cannot say anything
 * about whether the real one's lifetime ever arrives — it did not, for a
 * while. `./conversations-broker.test.ts` asks that question on a host, through
 * core's broker, and this file stays the policy's bench.
 */
import { expect, test } from "bun:test"
import { Effect } from "effect"

import { UsageFailure } from "@olai/format"

import { conversationsProvision, type ConversationsOwner, type Minted } from "./conversations.ts"
import type { Conversing } from "../sessions.ts"

interface Sent {
  readonly to: Conversing
  readonly text: string
  readonly preamble: ReadonlyArray<string>
}
interface Delivered {
  readonly who: string
  readonly to: Conversing
  readonly text: string
  readonly current: boolean
}

const SEATED: Conversing = { agent: "claude", session: "sess-1" }

const fixture = (over: Partial<ConversationsOwner> = {}) => {
  const sends: Sent[] = []
  const deliveries: Delivered[] = []
  let minted: Minted = { node: "node-1", to: SEATED, refusal: null }
  let sendRefusal: string | null = null
  let seat: Conversing | null = SEATED
  let engines: ReadonlyArray<{ id: string; name: string }> = [
    { id: "claude", name: "Claude Code" },
    { id: "codex", name: "Codex" },
  ]
  const owner: ConversationsOwner = {
    mint: () => Effect.succeed(minted),
    send: (to, text, preamble) =>
      Effect.gen(function*() {
        sends.push({ to, text, preamble })
        if (sendRefusal !== null) return yield* new UsageFailure({ reason: sendRefusal })
      }),
    seat: () => seat,
    deliver: (who, to, text, current) =>
      Effect.sync(() => {
        deliveries.push({ who, to, text, current: current() })
        return true
      }),
    engines: () => engines,
    ...over,
  }
  return {
    owner,
    sends,
    deliveries,
    mints: (value: Minted) => { minted = value },
    refusesSend: (reason: string | null) => { sendRefusal = reason },
    seats: (value: Conversing | null) => { seat = value },
    installs: (value: ReadonlyArray<{ id: string; name: string }>) => { engines = value },
  }
}

const door = (
  it: { readonly owner: ConversationsOwner },
  who = "vault-plugins",
  current?: () => boolean,
) => conversationsProvision(it.owner)(who, current === undefined ? undefined : { current })

test("open mints, then says the first message with the caller's sentences on the teaching seam", async () => {
  const it = fixture()
  const answer = await Effect.runPromise(door(it).open({
    parent: "folder-1",
    title: "Timer",
    engine: "claude",
    say: "Build the timer plugin.",
    teach: ["The plugin's folder is plugins/timer.", "Write server.ts first."],
  }))

  expect(answer).toEqual({ node: "node-1", refusal: null })
  expect(it.sends).toEqual([{
    to: SEATED,
    text: "Build the timer plugin.",
    // THE SEAM'S OWN SPELLING, applied once and here: a caller hands over
    // sentences and never lines, so there is no second convention for an agent
    // to learn (`../teaching.ts`).
    preamble: ["[olai] The plugin's folder is plugins/timer.", "[olai] Write server.ts first."],
  }])
})

test("a conversation with nothing to teach carries no lines at all", async () => {
  const it = fixture()
  await Effect.runPromise(door(it).open({ parent: null, title: "Timer", engine: "claude", say: "hello", teach: [] }))
  expect(it.sends[0]?.preamble).toEqual([])
})

test("a refused start answers the node and the sentence, and says nothing into nothing", async () => {
  const it = fixture()
  it.mints({ node: "node-2", to: null, refusal: "claude is not installed on this machine" })
  const answer = await Effect.runPromise(door(it).open({
    parent: null, title: "Timer", engine: "claude", say: "hello", teach: ["a line"],
  }))
  // THE NODE IS THE DURABLE HALF: a conversation that exists and could not be
  // opened is something somebody can open later.
  expect(answer).toEqual({ node: "node-2", refusal: "claude is not installed on this machine" })
  expect(it.sends).toEqual([])
})

test("a first message the agent would not take is a refusal beside the node, not a failure", async () => {
  const it = fixture()
  it.refusesSend("the agent is not available right now")
  const answer = await Effect.runPromise(door(it).open({
    parent: null, title: "Timer", engine: "claude", say: "hello", teach: [],
  }))
  expect(answer).toEqual({ node: "node-1", refusal: "the agent is not available right now" })
})

test("a refused mint fails the caller — there is no node to answer with", async () => {
  const it = fixture({ mint: () => new UsageFailure({ reason: "chat is off: no ACP agent is configured for this directory" }) })
  const result = await Effect.runPromise(Effect.result(door(it).open({
    parent: null, title: "Timer", engine: "claude", say: "hello", teach: [],
  })))
  expect(result._tag).toBe("Failure")
  if (result._tag !== "Failure") throw new Error("unreachable")
  // NARROWED AT THIS EDGE, which is what every consumer of core's
  // structurally-spelled refusal does: the door answers `{ _tag }` because
  // `@olai/plugin-api` may not import the format, and this package does.
  expect((result.failure as UsageFailure).message).toContain("chat is off")
})

test("say lands as the asking plugin, with its own activation riding the body", async () => {
  const it = fixture()
  expect(await Effect.runPromise(door(it, "vault-plugins", () => true).say({ node: "node-1", text: "any news?" })))
    .toBe(true)
  expect(it.deliveries).toEqual([{ who: "vault-plugins", to: SEATED, text: "any news?", current: true }])
})

test("say answers false for a node with no conversation, and delivers nothing", async () => {
  const it = fixture()
  it.seats(null)
  expect(await Effect.runPromise(door(it).say({ node: "node-9", text: "any news?" }))).toBe(false)
  expect(it.deliveries).toEqual([])
})

test("say answers false for a consumer that has left, before it reaches the roster", async () => {
  const it = fixture({ seat: () => { throw new Error("a departed consumer must not reach the roster") } })
  expect(await Effect.runPromise(door(it, "vault-plugins", () => false).say({ node: "node-1", text: "any news?" })))
    .toBe(false)
  expect(it.deliveries).toEqual([])
})

test("say answers false where there is no chat to hand the words to", async () => {
  const it = fixture({ deliver: () => Effect.succeed(false) })
  expect(await Effect.runPromise(door(it).say({ node: "node-1", text: "any news?" }))).toBe(false)
})

test("engines reflects the roster, read when asked rather than captured", () => {
  const it = fixture()
  const asked = door(it)
  expect(asked.engines()).toEqual([
    { id: "claude", name: "Claude Code" },
    { id: "codex", name: "Codex" },
  ])
  // A row switched off at the plugins panel leaves the list between two calls,
  // on the door a consumer is already holding.
  it.installs([])
  expect(asked.engines()).toEqual([])
})

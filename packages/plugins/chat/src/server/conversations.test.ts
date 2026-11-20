import { expect, test } from "bun:test"
import { Effect } from "effect"

import { type AgentItem, itemKey, UsageFailure } from "@olai/format"

import { conversationsProvision, type ConversationsOwner, type Minted } from "./conversations.ts"
import type { NewChatInput } from "./new-chat.ts"
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

const ABOUT: AgentItem = { kind: "note", path: "plugins/timer/README.md" }
const PLAN: AgentItem = { kind: "note", path: "notes/plan.md" }
const CLOCK: AgentItem = { kind: "node", id: "clock" }

const fixture = (over: Partial<ConversationsOwner> = {}) => {
  const sends: Sent[] = []
  const deliveries: Delivered[] = []
  const minting: NewChatInput[] = []
  let minted: Minted = { node: "node-1", to: SEATED, refusal: null }
  let sendRefusal: string | null = null
  const chats = new Set<string>([itemKey(ABOUT)])
  const seated = new Map<string, Conversing>([[itemKey(ABOUT), SEATED]])
  let engines: ReadonlyArray<{ id: string; name: string }> = [
    { id: "claude", name: "Claude Code" },
    { id: "codex", name: "Codex" },
  ]
  const owner: ConversationsOwner = {
    mint: (input) => Effect.sync(() => { minting.push(input); return minted }),
    send: (to, text, preamble) =>
      Effect.gen(function*() {
        sends.push({ to, text, preamble })
        if (sendRefusal !== null) return yield* new UsageFailure({ reason: sendRefusal })
      }),
    seatAt: (about) => Effect.sync(() => seated.get(itemKey(about)) ?? null),
    chatsAt: (abouts) => Effect.sync(() => new Set(abouts.map(itemKey).filter((key) => chats.has(key)))),
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
    minting,
    mints: (value: Minted) => { minted = value },
    refusesSend: (reason: string | null) => { sendRefusal = reason },
    startedAt: (about: AgentItem, to: Conversing) => { chats.add(itemKey(about)); seated.set(itemKey(about), to) },
    unstartedAt: (about: AgentItem) => { chats.add(itemKey(about)); seated.delete(itemKey(about)) },
    nothingAt: (about: AgentItem) => { chats.delete(itemKey(about)); seated.delete(itemKey(about)) },
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
    about: ABOUT,
    engine: "claude",
    say: "Build the timer plugin.",
    teach: ["The plugin's folder is plugins/timer.", "Write server.ts first."],
  }))

  expect(answer).toEqual({ refusal: null })
  expect(it.sends).toEqual([{
    to: SEATED,
    text: "Build the timer plugin.",
    preamble: ["[olai] The plugin's folder is plugins/timer.", "[olai] Write server.ts first."],
  }])
})

test("a conversation with nothing to teach carries no lines at all", async () => {
  const it = fixture()
  await Effect.runPromise(door(it).open({ about: ABOUT, engine: "claude", say: "hello", teach: [] }))
  expect(it.sends[0]?.preamble).toEqual([])
})

test("a refused start answers the sentence, and says nothing into nothing", async () => {
  const it = fixture()
  it.mints({ node: "node-2", to: null, refusal: "claude is not installed on this machine" })
  const answer = await Effect.runPromise(door(it).open({
    about: ABOUT, engine: "claude", say: "hello", teach: ["a line"],
  }))
  expect(answer).toEqual({ refusal: "claude is not installed on this machine" })
  expect(it.sends).toEqual([])
})

test("a first message the agent would not take is a refusal, not a failure", async () => {
  const it = fixture()
  it.refusesSend("the agent is not available right now")
  const answer = await Effect.runPromise(door(it).open({
    about: ABOUT, engine: "claude", say: "hello", teach: [],
  }))
  expect(answer).toEqual({ refusal: "the agent is not available right now" })
})

test("a refused mint fails the caller — there is no node to answer with", async () => {
  const it = fixture({ mint: () => new UsageFailure({ reason: "chat is off: no ACP agent is configured for this directory" }) })
  const result = await Effect.runPromise(Effect.result(door(it).open({
    about: ABOUT, engine: "claude", say: "hello", teach: [],
  })))
  expect(result._tag).toBe("Failure")
  if (result._tag !== "Failure") throw new Error("unreachable")
  expect((result.failure as UsageFailure).message).toContain("chat is off")
})

test("open starts the chat OF THE ITEM it was asked about, and mints nothing", async () => {
  const it = fixture()
  await Effect.runPromise(door(it).open({ about: CLOCK, engine: "claude", say: "hello", teach: [] }))
  expect(it.minting).toEqual([{ agent: "claude", item: CLOCK }])
})

test("say lands as the asking plugin, with its own activation riding the body", async () => {
  const it = fixture()
  expect(await Effect.runPromise(door(it, "vault-plugins", () => true).say({ about: ABOUT, text: "any news?" })))
    .toBe(true)
  expect(it.deliveries).toEqual([{ who: "vault-plugins", to: SEATED, text: "any news?", current: true }])
})

test("say reaches the conversation of the item it was given, and not another one", async () => {
  const it = fixture()
  const other: Conversing = { agent: "codex", session: "sess-2" }
  it.startedAt(PLAN, other)
  expect(await Effect.runPromise(door(it).say({ about: PLAN, text: "any news?" }))).toBe(true)
  expect(it.deliveries).toEqual([{ who: "vault-plugins", to: other, text: "any news?", current: true }])
})

test("say answers false where no chat is on that item, and delivers nothing", async () => {
  const it = fixture()
  it.nothingAt(ABOUT)
  expect(await Effect.runPromise(door(it).say({ about: ABOUT, text: "any news?" }))).toBe(false)
  expect(await Effect.runPromise(door(it).say({ about: PLAN, text: "any news?" }))).toBe(false)
  expect(it.deliveries).toEqual([])
})

test("say answers false for a chat with no conversation, and delivers nothing", async () => {
  const it = fixture()
  it.unstartedAt(ABOUT)
  expect(await Effect.runPromise(door(it).say({ about: ABOUT, text: "any news?" }))).toBe(false)
  expect(it.deliveries).toEqual([])
})

test("say answers false for a consumer that has left, before it reaches the roster", async () => {
  const it = fixture({ seatAt: () => { throw new Error("a departed consumer must not reach the roster") } })
  expect(await Effect.runPromise(door(it, "vault-plugins", () => false).say({ about: ABOUT, text: "any news?" })))
    .toBe(false)
  expect(it.deliveries).toEqual([])
})

test("say answers false where the words found nothing to land in at the delivery", async () => {
  const it = fixture({ deliver: () => Effect.succeed(false) })
  expect(await Effect.runPromise(door(it).say({ about: ABOUT, text: "any news?" }))).toBe(false)
})

test("here answers which of the items asked about have a chat, started or not", async () => {
  const it = fixture()
  it.unstartedAt(CLOCK)
  expect(await Effect.runPromise(door(it).here({ about: [ABOUT, CLOCK, PLAN] })))
    .toEqual(new Set([itemKey(ABOUT), itemKey(CLOCK)]))
  it.nothingAt(ABOUT)
  expect(await Effect.runPromise(door(it).here({ about: [ABOUT, CLOCK] })))
    .toEqual(new Set([itemKey(CLOCK)]))
  expect(await Effect.runPromise(door(it).here({ about: [] }))).toEqual(new Set())
})

test("engines reflects the roster, read when asked rather than captured", () => {
  const it = fixture()
  const asked = door(it)
  expect(asked.engines()).toEqual([
    { id: "claude", name: "Claude Code" },
    { id: "codex", name: "Codex" },
  ])
  it.installs([])
  expect(asked.engines()).toEqual([])
})

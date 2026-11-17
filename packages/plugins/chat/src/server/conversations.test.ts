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

/** The address these cases talk about, and the one place the fixture's vault
 *  holds a chat at until a case puts another one somewhere. */
const ABOUT = "/plugins/timer"

const fixture = (over: Partial<ConversationsOwner> = {}) => {
  const sends: Sent[] = []
  const deliveries: Delivered[] = []
  const minting: NewChatInput[] = []
  let minted: Minted = { node: "node-1", to: SEATED, refusal: null }
  let sendRefusal: string | null = null
  // The vault as a case holds it, read BY ADDRESS: which addresses have a
  // chat, and which of those chats has a conversation seated on it. The two
  // are separate because a chat nobody has started is still a chat there.
  const chats = new Set<string>([ABOUT])
  const seated = new Map<string, Conversing>([[ABOUT, SEATED]])
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
    seatAt: (about) => Effect.sync(() => seated.get(about) ?? null),
    chatsAt: (abouts) => Effect.sync(() => new Set(abouts.filter((about) => chats.has(about)))),
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
    /** A chat at that address with a conversation seated on it. */
    startedAt: (about: string, to: Conversing) => { chats.add(about); seated.set(about, to) },
    /** A chat at that address that nobody has started. */
    unstartedAt: (about: string) => { chats.add(about); seated.delete(about) },
    /** Nothing there at all — the row was retitled or trashed, or the place went. */
    nothingAt: (about: string) => { chats.delete(about); seated.delete(about) },
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
    about: ABOUT,
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
  await Effect.runPromise(door(it).open({ parent: null, title: "Timer", about: ABOUT, engine: "claude", say: "hello", teach: [] }))
  expect(it.sends[0]?.preamble).toEqual([])
})

test("a refused start answers the node and the sentence, and says nothing into nothing", async () => {
  const it = fixture()
  it.mints({ node: "node-2", to: null, refusal: "claude is not installed on this machine" })
  const answer = await Effect.runPromise(door(it).open({
    parent: null, title: "Timer", about: ABOUT, engine: "claude", say: "hello", teach: ["a line"],
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
    parent: null, title: "Timer", about: ABOUT, engine: "claude", say: "hello", teach: [],
  }))
  expect(answer).toEqual({ node: "node-1", refusal: "the agent is not available right now" })
})

test("a refused mint fails the caller — there is no node to answer with", async () => {
  const it = fixture({ mint: () => new UsageFailure({ reason: "chat is off: no ACP agent is configured for this directory" }) })
  const result = await Effect.runPromise(Effect.result(door(it).open({
    parent: null, title: "Timer", about: ABOUT, engine: "claude", say: "hello", teach: [],
  })))
  expect(result._tag).toBe("Failure")
  if (result._tag !== "Failure") throw new Error("unreachable")
  // NARROWED AT THIS EDGE, which is what every consumer of core's
  // structurally-spelled refusal does: the door answers `{ _tag }` because
  // `@olai/plugin-api` may not import the format, and this package does.
  expect((result.failure as UsageFailure).message).toContain("chat is off")
})

test("open mints a conversation ABOUT the place it was asked about, under the place's name", async () => {
  const it = fixture()
  await Effect.runPromise(door(it).open({
    parent: "folder-1", title: "Timer", about: "/plugins/swatch", engine: "claude", say: "hello", teach: [],
  }))
  // The address rides through whole: the row's title is `[name](address)` and
  // the mint is the one place that spells it (`./new-chat.ts`).
  expect(it.minting).toEqual([{ agent: "claude", title: "Timer", parent: "folder-1", about: "/plugins/swatch" }])
})

test("say lands as the asking plugin, with its own activation riding the body", async () => {
  const it = fixture()
  expect(await Effect.runPromise(door(it, "vault-plugins", () => true).say({ about: ABOUT, text: "any news?" })))
    .toBe(true)
  expect(it.deliveries).toEqual([{ who: "vault-plugins", to: SEATED, text: "any news?", current: true }])
})

test("say reaches the conversation at the address it was given, and not another one", async () => {
  const it = fixture()
  const other: Conversing = { agent: "codex", session: "sess-2" }
  it.startedAt("/notes/plan.md", other)
  expect(await Effect.runPromise(door(it).say({ about: "/notes/plan.md", text: "any news?" }))).toBe(true)
  expect(it.deliveries).toEqual([{ who: "vault-plugins", to: other, text: "any news?", current: true }])
})

test("say answers false where no chat is at that address, and delivers nothing", async () => {
  const it = fixture()
  it.nothingAt(ABOUT)
  expect(await Effect.runPromise(door(it).say({ about: ABOUT, text: "any news?" }))).toBe(false)
  // ...and the same for an address nothing was ever put at.
  expect(await Effect.runPromise(door(it).say({ about: "/notes/plan.md", text: "any news?" }))).toBe(false)
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

test("here answers which of the addresses asked about have a chat, started or not", async () => {
  const it = fixture()
  it.unstartedAt("/plugins/clock")
  // A chat there, a chat nobody has started — both are chats at that address,
  // because `here` is a fact about the vault and not about what anybody said —
  // and nothing at an address no chat was ever put at.
  expect(await Effect.runPromise(door(it).here({ about: [ABOUT, "/plugins/clock", "/notes/plan.md"] })))
    .toEqual(new Set([ABOUT, "/plugins/clock"]))
  // ...and a chat that was retitled or trashed is gone from the next answer.
  it.nothingAt(ABOUT)
  expect(await Effect.runPromise(door(it).here({ about: [ABOUT, "/plugins/clock"] })))
    .toEqual(new Set(["/plugins/clock"]))
  // Nothing asked about is nothing answered.
  expect(await Effect.runPromise(door(it).here({ about: [] }))).toEqual(new Set())
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

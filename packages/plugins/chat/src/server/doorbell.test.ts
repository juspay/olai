import { expect, test } from "bun:test"
import { Effect } from "effect"
import type { Wake } from "@olai/plugin-api/services"
import type { Chat } from "../scoped.ts"
import { scopeThrough } from "./doorbell.ts"
const TALKING = { agent: "alpha", session: "s" }
const RINGING: Wake = { subject: "events", waiting: { one: "event", many: "events" } }
const chatPicking = (): {
  readonly chat: Chat
  readonly picked: ReadonlyArray<{
    readonly to: { agent: string; session: string }
    readonly plugin: string
    readonly pick: string | null
  }>
} => {
  const picked: Array<{
    readonly to: { agent: string; session: string }
    readonly plugin: string
    readonly pick: string | null
  }> = []
  const chat = {
    scope: (
      to: { agent: string; session: string },
      plugin: string,
      pick: string | null,
    ) => Effect.sync(() => void picked.push({ to, plugin, pick })),
  } as unknown as Chat
  return { chat, picked }
}

const rings = (...names: ReadonlyArray<string>): ReadonlyMap<string, Wake> =>
  new Map(names.map((one) => [one, RINGING]))

/**
 * THE GATE'S FIRST ANSWER: a plugin this serve composed, whose half declares a
 * wake, gets the pick — whole, and with nothing about it re-decided here.
 *
 * The triple travels EXACTLY as it arrived, which is the half a reader should
 * check for a substitution rather than for an error: what this end must not do
 * is store "whichever conversation is open", because a picker somebody left open
 * can outlive the session under it and the chat is where that race is answered.
 */
test("a scope naming a composed plugin that rings is written through, whole", async () => {
  const it = chatPicking()
  await Effect.runPromise(
    scopeThrough(it.chat, rings("ringer"), { ...TALKING, plugin: "ringer", pick: "notes.olai" }),
  )
  expect(it.picked).toEqual([{ to: TALKING, plugin: "ringer", pick: "notes.olai" }])
})

/**
 * ...AND THE REFUSAL: this serve did not compose that plugin, or the half it
 * composed declares no wake. Both arms land here and both mean the same thing to
 * the person who pressed — nothing will read what you just asked for — so the
 * declarations table is the one question asked.
 *
 * The negative beside it is the one that matters: nothing was written. A gate
 * that refused and stored anyway would be a row nothing will ever read, kept
 * against the cap of a record that has one.
 */
test("a scope naming a plugin that does not ring here is refused, in words, and stores nothing", async () => {
  const it = chatPicking()
  const said = await Effect.runPromise(
    Effect.flip(
      scopeThrough(it.chat, rings("ringer"), { ...TALKING, plugin: "quiet", pick: "notes.olai" }),
    ),
  )
  expect(said.reason).toContain("quiet")
  expect(it.picked).toEqual([])
  // ...and the one that DOES ring, through the same gate and the same
  // conversation, is written through — so what was refused was the declaration
  // and not the gate.
  await Effect.runPromise(
    scopeThrough(it.chat, rings("ringer"), { ...TALKING, plugin: "ringer", pick: "notes.olai" }),
  )
  expect(it.picked).toEqual([{ to: TALKING, plugin: "ringer", pick: "notes.olai" }])
})

/** ...AND CLEARING ONE IS THE SAME GATE, because `null` is a value rather than a
 *  second verb: a `forget` beside a `set` would be two ways to write one row and
 *  a question about which of them a fresh pick goes through. */
test("clearing a scope goes through the same gate, with the pick as null", async () => {
  const it = chatPicking()
  await Effect.runPromise(
    scopeThrough(it.chat, rings("ringer"), { ...TALKING, plugin: "ringer", pick: null }),
  )
  expect(it.picked).toEqual([{ to: TALKING, plugin: "ringer", pick: null }])
})

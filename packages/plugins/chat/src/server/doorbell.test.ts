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

test("a scope naming a composed plugin that rings is written through, whole", async () => {
  const it = chatPicking()
  await Effect.runPromise(
    scopeThrough(it.chat, rings("ringer"), { ...TALKING, plugin: "ringer", pick: "notes.olai" }),
  )
  expect(it.picked).toEqual([{ to: TALKING, plugin: "ringer", pick: "notes.olai" }])
})

test("a scope naming a plugin that does not ring here is refused, in words, and stores nothing", async () => {
  const it = chatPicking()
  const said = await Effect.runPromise(
    Effect.flip(
      scopeThrough(it.chat, rings("ringer"), { ...TALKING, plugin: "quiet", pick: "notes.olai" }),
    ),
  )
  expect(said.reason).toContain("quiet")
  expect(it.picked).toEqual([])
  await Effect.runPromise(
    scopeThrough(it.chat, rings("ringer"), { ...TALKING, plugin: "ringer", pick: "notes.olai" }),
  )
  expect(it.picked).toEqual([{ to: TALKING, plugin: "ringer", pick: "notes.olai" }])
})

test("clearing a scope goes through the same gate, with the pick as null", async () => {
  const it = chatPicking()
  await Effect.runPromise(
    scopeThrough(it.chat, rings("ringer"), { ...TALKING, plugin: "ringer", pick: null }),
  )
  expect(it.picked).toEqual([{ to: TALKING, plugin: "ringer", pick: null }])
})

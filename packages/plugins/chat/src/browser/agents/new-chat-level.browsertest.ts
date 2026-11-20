import { expect, test } from "bun:test"
import { buildSurfaceClient } from "@kolu/surface/solid"
import { BusyFailure } from "@olai/format"
import { Effect, Exit, Scope, Stream } from "effect"
import { createRoot, createSignal } from "solid-js"

import { surface } from "../../wire.ts"
import { holdChatWire } from "../wire.ts"
import { holdPluginRoster } from "../plugin-roster.ts"
import type { Roster } from "./answered.tsx"
import type { NewChatOwner } from "./new-chat.ts"
import { newChatRow, REFUSED_ROW, settled, TYPING_PAUSE_MS } from "./new-chat-level.ts"

const after = (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, ms)
  return promise
}

test("words typed before the level's first effect runs still become the question", async () => {
  const owner = createRoot(dispose => {
    const [typed, setTyped] = createSignal("")
    return { dispose, setTyped, value: settled(typed) }
  })
  try {
    owner.setTyped("pick the hinges")
    await after(TYPING_PAUSE_MS * 4)
    expect(owner.value()).toBe("pick the hinges")
  } finally {
    owner.dispose()
  }
})

test("the box the level opened with is asked at once, and later typing waits for a pause", async () => {
  const owner = createRoot(dispose => {
    const [typed, setTyped] = createSignal("kitchen")
    return { dispose, setTyped, value: settled(typed) }
  })
  try {
    expect(owner.value()).toBe("kitchen")
    owner.setTyped("kitchen remodel")
    expect(owner.value()).toBe("kitchen")
    await after(TYPING_PAUSE_MS * 4)
    expect(owner.value()).toBe("kitchen remodel")
  } finally {
    owner.dispose()
  }
})

const turns = async () => { for (let index = 0; index < 8; index++) await Bun.sleep(0) }

const EMPTY_ROSTER = { rows: () => [], at: () => undefined, engines: () => [] } as unknown as Roster

const tickingRoster = () => {
  const [frame, tick] = createSignal(0)
  return {
    tick,
    roster: { rows: () => { frame(); return [] }, at: () => undefined, engines: () => [] } as unknown as Roster,
  }
}

const NO_CREATION = { pending: () => false } as unknown as NewChatOwner

const openLevel = async (
  answer: () => Effect.Effect<unknown, unknown>,
  changing: () => boolean,
  roster: Roster = EMPTY_ROSTER,
  typed: () => string = () => "",
) => {
  const asked: Array<unknown> = []
  const wire = createRoot(dispose => ({ dispose, client: buildSurfaceClient(surface, {
    unary: (tag, input) => {
      if (!tag.includes("/locations")) return Effect.succeed({})
      asked.push(input)
      return answer()
    },
    stream: () => Stream.empty,
  }, () => true) }))
  const activation = Scope.makeUnsafe()
  const held = Effect.provideService(Scope.Scope, activation)
  await Effect.runPromise(held(holdChatWire(() => wire.client)))
  await Effect.runPromise(held(Effect.acquireRelease(
    Effect.sync(() => holdPluginRoster({ changing })), stop => Effect.sync(stop))))
  const action = newChatRow(NO_CREATION, roster).action
  if (action.kind !== "level" || action.level.kind !== "group" || typeof action.level.children !== "function") {
    throw new Error("New chat no longer opens a group level whose rows are its own")
  }
  const children = action.level.children
  const opened = createRoot(dispose => ({
    dispose, rows: children({ typed, signal: new AbortController().signal }),
  }))
  return {
    asked, rows: opened.rows,
    close: async () => {
      opened.dispose()
      wire.dispose()
      await Effect.runPromise(Scope.close(activation, Exit.void))
    },
  }
}

test("the level asks nothing while the tab is recomposing, and asks once it has settled", async () => {
  const [changing, setChanging] = createSignal(true)
  const level = await openLevel(() => Effect.succeed({ items: [] }), changing)
  try {
    await turns()
    expect(level.asked.length).toBe(0)
    setChanging(false)
    await turns()
    expect(level.asked.length).toBe(1)
  } finally {
    await level.close()
  }
})

test("a refused question is shown in the level, and the press asks it again", async () => {
  const [changing] = createSignal(false)
  let refuse = true
  const level = await openLevel(
    () => refuse ? Effect.fail(new BusyFailure({ reason: "The chat server is busy" })) : Effect.succeed({ items: [] }),
    changing,
  )
  try {
    await turns()
    expect(level.asked.length).toBe(1)
    const refused = level.rows()[0]
    expect(refused?.id).toBe(REFUSED_ROW)
    expect(refused?.label).toBe("The chat server is busy")
    refuse = false
    if (refused?.action.kind !== "run") throw new Error("the refusal row is not a press")
    expect(await refused.action.run()).toEqual({ keepOpen: true })
    await turns()
    expect(level.asked.length).toBe(2)
    expect(level.rows().some(row => row.id === REFUSED_ROW)).toBe(false)
  } finally {
    await level.close()
  }
})

test("a question refused on the settle after a reconnect is asked again on the next frame, once", async () => {
  const [changing, setChanging] = createSignal(true)
  const ticking = tickingRoster()
  let refuse = true
  const level = await openLevel(
    () => refuse ? Effect.fail(new BusyFailure({ reason: "The chat server is busy" })) : Effect.succeed({ items: [] }),
    changing,
    ticking.roster,
  )
  try {
    await turns()
    expect(level.asked.length).toBe(0)
    setChanging(false)
    await turns()
    expect(level.asked.length).toBe(1)
    expect(level.rows()[0]?.id).toBe(REFUSED_ROW)
    refuse = false
    ticking.tick(count => count + 1)
    await turns()
    expect(level.asked.length).toBe(2)
    expect(level.rows().some(row => row.id === REFUSED_ROW)).toBe(false)
    ticking.tick(count => count + 1)
    await turns()
    expect(level.asked.length).toBe(2)
  } finally {
    await level.close()
  }
})

test("a refusal of a question that is not a reconnect's never asks again on a roster frame", async () => {
  const [changing] = createSignal(false)
  const [typed, setTyped] = createSignal("")
  const ticking = tickingRoster()
  let refuse = false
  const level = await openLevel(
    () => refuse ? Effect.fail(new BusyFailure({ reason: "The chat server is busy" })) : Effect.succeed({ items: [] }),
    changing,
    ticking.roster,
    typed,
  )
  try {
    await turns()
    expect(level.asked.length).toBe(1)
    expect(level.rows().some(row => row.id === REFUSED_ROW)).toBe(false)
    refuse = true
    setTyped("plan")
    await after(TYPING_PAUSE_MS + 20)
    await turns()
    expect(level.asked.length).toBe(2)
    const refused = level.rows()[0]
    expect(refused?.id).toBe(REFUSED_ROW)
    ticking.tick(count => count + 1)
    await turns()
    ticking.tick(count => count + 1)
    await turns()
    expect(level.asked.length).toBe(2)
    expect(level.rows()[0]?.id).toBe(REFUSED_ROW)
    refuse = false
    if (refused?.action.kind !== "run") throw new Error("the refusal row is not a press")
    await refused.action.run()
    await turns()
    expect(level.asked.length).toBe(3)
    expect(level.rows().some(row => row.id === REFUSED_ROW)).toBe(false)
  } finally {
    await level.close()
  }
})

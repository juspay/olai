/**
 * THE WHERE LEVEL — which question it asks, when it asks it, and what it does
 * with an answer that never came (`./new-chat-level.ts`).
 *
 * It runs under the browser condition because its whole subject is an EFFECT:
 * when the effect runs relative to a change is the thing being pinned, and a
 * server-resolved run would report nothing at all.
 *
 * THE FIRST REGRESSION: a person pressed the `+`, the level opened, and words
 * landed in the box before the level's first effect had run — which on a
 * loaded machine is ordinary. The old guard skipped the FIRST RUN rather than
 * an unchanged value, so those words were swallowed and the level went on
 * asking about an empty box forever, since nothing was ever going to type
 * again. The list stayed empty and no node could be chosen.
 *
 * ...AND THE SECOND: a plugin switched on or off makes the tab dial a new
 * wire, and a question asked across that moment is interrupted rather than
 * answered. That was worked around with ten tries 150 ms apart — a clock
 * standing in for an event. The level stands down while the tab is
 * recomposing and asks again when it has settled, and a refusal that is not
 * that is put on the page instead of being swallowed.
 *
 * ...AND THE THIRD: a standing refusal used to be retried on every frame of
 * this plugin's roster, and those frames also come from ordinary activity. So
 * a refusal that was shown once asked again, and again, for as long as
 * anything in the vault was talking. One question has an automatic second go
 * now and only one: the one asked on the settle after a reconnect, whose
 * refusal may be a serve that was still composing. It goes out again on the
 * next frame, once. Every other refusal waits for *Ask again*. The last two
 * tests here are those two halves.
 */
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
    // In the same breath as the opening: no effect has run yet.
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
    // The opening value is the question, with no pause spent on it.
    expect(owner.value()).toBe("kitchen")
    owner.setTyped("kitchen remodel")
    expect(owner.value()).toBe("kitchen")
    await after(TYPING_PAUSE_MS * 4)
    expect(owner.value()).toBe("kitchen remodel")
  } finally {
    owner.dispose()
  }
})

/** Eight microtask turns — what an answer travelling through the client and
 *  back into a signal costs. No wall clock: nothing below waits on one. */
const turns = async () => { for (let index = 0; index < 8; index++) await Bun.sleep(0) }

/** A roster with nothing in it: the level reads `rows()` for the chats this
 *  tab was last in and `at()` to mark an item that already has one, and both
 *  answers are "none" here — what is under test is the QUESTION, not the
 *  shortlist built out of its answer. */
const EMPTY_ROSTER = { rows: () => [], at: () => undefined, engines: () => [] } as unknown as Roster

/** ...and the same roster with frames a test can publish: the same chats in a
 *  new array, which is what ordinary activity sends — a turn starting, an
 *  answer landing, a title changing. */
const tickingRoster = () => {
  const [frame, tick] = createSignal(0)
  return {
    tick,
    roster: { rows: () => { frame(); return [] }, at: () => undefined, engines: () => [] } as unknown as Roster,
  }
}

/** The one creation permit a submit shares. No level opened here reaches it. */
const NO_CREATION = { pending: () => false } as unknown as NewChatOwner

/** One opening of the item level, over a wire that answers `locations`
 *  however the caller says, with both holds the level reads through in place. */
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
    // The wire is being replaced: a question asked now is interrupted rather
    // than answered, so none is asked.
    expect(level.asked.length).toBe(0)
    setChanging(false)
    await turns()
    // ...and the composition settling is what asks it — one question, off the
    // event that refused the last one, with no clock anywhere.
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
    // NOT AN EMPTY LIST, which reads as "there is nothing here": the server's
    // own sentence is on a row of its own.
    const refused = level.rows()[0]
    expect(refused?.id).toBe(REFUSED_ROW)
    expect(refused?.label).toBe("The chat server is busy")
    refuse = false
    if (refused?.action.kind !== "run") throw new Error("the refusal row is not a press")
    expect(await refused.action.run()).toEqual({ keepOpen: true })
    await turns()
    // A person's gesture asked again, and the answer took the sentence away.
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
    // THE SETTLE: the wire is new, and the serve behind it may still be
    // composing — so this question's refusal is the one worth a second go.
    setChanging(false)
    await turns()
    expect(level.asked.length).toBe(1)
    expect(level.rows()[0]?.id).toBe(REFUSED_ROW)
    // A FRAME IS THE SERVE SAYING IT ANSWERS AGAIN.
    refuse = false
    ticking.tick(count => count + 1)
    await turns()
    expect(level.asked.length).toBe(2)
    expect(level.rows().some(row => row.id === REFUSED_ROW)).toBe(false)
    // ...AND THE EDGE IS SPENT: a frame after it asks nothing at all.
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
    // AN ORDINARY QUESTION, over a connection nothing has dialled.
    expect(level.asked.length).toBe(1)
    expect(level.rows().some(row => row.id === REFUSED_ROW)).toBe(false)
    refuse = true
    setTyped("plan")
    await after(TYPING_PAUSE_MS + 20)
    await turns()
    expect(level.asked.length).toBe(2)
    const refused = level.rows()[0]
    expect(refused?.id).toBe(REFUSED_ROW)
    // THE FRAMES ORDINARY ACTIVITY SENDS — a turn starting, an answer
    // landing. None of them is an event about this question, and a level that
    // asked on each would be a timer with another clock.
    ticking.tick(count => count + 1)
    await turns()
    ticking.tick(count => count + 1)
    await turns()
    expect(level.asked.length).toBe(2)
    expect(level.rows()[0]?.id).toBe(REFUSED_ROW)
    // THE PERSON IS THE WHOLE OF THE RETRY HERE.
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

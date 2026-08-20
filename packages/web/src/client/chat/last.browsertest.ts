/**
 * WHAT THE MINIMIZED PILL REMEMBERS, and what reading it costs.
 *
 * The claim under test is not what the pill says — `./last.test.ts` has the
 * clamping — but WHAT IS READ to keep it saying it. Written as one effect
 * looping over every row's `.kind`/`.seq`/`.text`, the panel was subscribed to
 * the TEXT OF EVERY ROW, so each token an agent streamed re-ran a walk of the
 * whole transcript to set one module signal
 * (docs/brainstorming/reactivity-after-the-flip.md §4.4). So the fake chat
 * below COUNTS its reads, and the cases are about that number.
 *
 * UNDER THE BROWSER CONDITION, for `../settled.browsertest.ts`'s reason: the
 * server build never re-runs a memo and never runs an effect at all, so a suite
 * about which rows a memo tracks would pass having tracked nothing.
 */

import { expect, test } from "bun:test"
import { type Accessor, createRoot, createSignal } from "solid-js"

import type { ChatEntry } from "@olai/surface"

import { createLastAgent, lastAgentPreview } from "./last.ts"
import type { Chat } from "./state.ts"

/** Rows as the transcript carries them, with only the fields this reads. */
const agent = (seq: number, text: string): ChatEntry =>
  ({ kind: "agent", seq, text } as unknown as ChatEntry)
const user = (seq: number, text: string): ChatEntry =>
  ({ kind: "user", seq, text } as unknown as ChatEntry)

/**
 * A live conversation with the pill watching it.
 *
 * The chat is the two things `createLastAgent` actually asks of a `Chat`: the
 * key list — the fold's, which hands back the same array while only text moves
 * (`./order.ts`) — and one signal per row. `reads` counts how many times a
 * row's VALUE was pulled, which is the whole measurement: a walk of the
 * transcript per token shows up here as rows × tokens.
 *
 * Made inside a root, and the rows are added from OUTSIDE it, because a Solid
 * effect does not run inside the body that created it — a case that asserted in
 * there would be asserting about an effect that had not run yet.
 */
const live = () => {
  const keysHeld: Array<string> = []
  const [keys, setKeys] = createSignal<ReadonlyArray<string>>(keysHeld)
  const rows = new Map<
    string,
    readonly [Accessor<ChatEntry | undefined>, (next: ChatEntry) => void]
  >()
  let reads = 0
  const chat = {
    rows: keys,
    entry: (key: string): Accessor<ChatEntry | undefined> => () => {
      reads += 1
      return rows.get(key)?.[0]()
    },
  } as unknown as Chat
  const stop = createRoot((dispose) => {
    createLastAgent(chat)
    return dispose
  })
  return {
    reads: () => reads,
    stop,
    /** A row arrives: the key list grows, which is the only thing membership
     *  can do. */
    add: (key: string, entry: ChatEntry) => {
      const [value, set] = createSignal<ChatEntry | undefined>(entry)
      rows.set(key, [value, set])
      keysHeld.push(key)
      setKeys([...keysHeld])
    },
    /** ...and a token lands on one: its value moves, the key list does not. */
    token: (key: string, entry: ChatEntry) => rows.get(key)?.[1](entry),
  }
}

test("the pill shows the last agent row", () => {
  const chat = live()
  chat.add("a", user(1, "what is in the shed"))
  chat.add("b", agent(2, "a ladder"))
  expect(lastAgentPreview()).toBe("a ladder")
  chat.stop()
})

test("a token on the last agent row reaches the pill", () => {
  const chat = live()
  chat.add("b", agent(2, "a ladder"))
  chat.token("b", agent(2, "a ladder and a tin of"))
  expect(lastAgentPreview()).toBe("a ladder and a tin of")
  chat.stop()
})

test("a token on any OTHER row costs no read at all", () => {
  // THE DEFECT. Every row's text was tracked, so a tool call revising its
  // progress — or a user row above — re-ran the whole loop, per token.
  const chat = live()
  for (let n = 0; n < 20; n += 1) chat.add(`u${n}`, user(n, `line ${n}`))
  chat.add("last", agent(99, "the answer"))
  const before = chat.reads()
  for (let n = 0; n < 10; n += 1) chat.token("u3", user(3, `line 3 revised ${n}`))
  expect(chat.reads()).toBe(before)
  expect(lastAgentPreview()).toBe("the answer")
  chat.stop()
})

test("a token on the last agent row costs one read, whatever the transcript holds", () => {
  const chat = live()
  for (let n = 0; n < 20; n += 1) chat.add(`u${n}`, user(n, `line ${n}`))
  chat.add("last", agent(99, "the"))
  const before = chat.reads()
  for (let n = 0; n < 10; n += 1) chat.token("last", agent(99, `the answer ${n}`))
  expect(chat.reads() - before).toBe(10)
  expect(lastAgentPreview()).toBe("the answer 9")
  chat.stop()
})

test("a row arriving is what moves the answer", () => {
  const chat = live()
  chat.add("a", agent(1, "the first thing"))
  expect(lastAgentPreview()).toBe("the first thing")
  chat.add("b", agent(2, "the second thing"))
  expect(lastAgentPreview()).toBe("the second thing")
  chat.stop()
})

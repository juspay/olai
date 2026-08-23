/**
 * WHAT THE MINIMIZED PILL REMEMBERS, and what reading it costs.
 *
 * The claim under test is not what the pill says — `./last.test.ts` has the
 * clamping — but WHAT IS READ to keep it saying it. Written as one effect
 * looping over every row's `.kind`/`.seq`/`.text`, the panel was subscribed to
 * the TEXT OF EVERY ROW, so each token an agent streamed re-ran a walk of the
 * whole transcript to set one module signal
 * (docs/brainstorming/reactivity-after-the-flip.md §4.4). So the fake chat
 * (`./live.testlib.ts`) COUNTS its reads, and the cases are about that number.
 *
 * The scan itself is `./newest.ts` now, shared with the banner's snapshot; the
 * counts below are what hold it to the rule for THIS reader, and
 * `./attention/asked.browsertest.ts` does the same for the other.
 *
 * UNDER THE BROWSER CONDITION, for `../settled.browsertest.ts`'s reason: the
 * server build never re-runs a memo and never runs an effect at all, so a suite
 * about which rows a memo tracks would pass having tracked nothing.
 */

import { expect, test } from "bun:test"

import { createLastAgent, lastAgentPreview } from "./last.ts"
import { agentRow as agent, live, userRow as user } from "./live.testlib.ts"

test("the pill shows the last agent row", () => {
  const chat = live(createLastAgent)
  chat.add("a", user(1, "what is in the shed"))
  chat.add("b", agent(2, "a ladder"))
  expect(lastAgentPreview()).toBe("a ladder")
  chat.stop()
})

test("a token on the last agent row reaches the pill", () => {
  const chat = live(createLastAgent)
  chat.add("b", agent(2, "a ladder"))
  chat.token("b", agent(2, "a ladder and a tin of"))
  expect(lastAgentPreview()).toBe("a ladder and a tin of")
  chat.stop()
})

test("a token on any OTHER row costs no read at all", () => {
  // THE DEFECT. Every row's text was tracked, so a tool call revising its
  // progress — or a user row above — re-ran the whole loop, per token.
  const chat = live(createLastAgent)
  for (let n = 0; n < 20; n += 1) chat.add(`u${n}`, user(n, `line ${n}`))
  chat.add("last", agent(99, "the answer"))
  const before = chat.reads()
  for (let n = 0; n < 10; n += 1) chat.token("u3", user(3, `line 3 revised ${n}`))
  expect(chat.reads()).toBe(before)
  expect(lastAgentPreview()).toBe("the answer")
  chat.stop()
})

test("a token on the last agent row costs one read, whatever the transcript holds", () => {
  const chat = live(createLastAgent)
  for (let n = 0; n < 20; n += 1) chat.add(`u${n}`, user(n, `line ${n}`))
  chat.add("last", agent(99, "the"))
  const before = chat.reads()
  for (let n = 0; n < 10; n += 1) chat.token("last", agent(99, `the answer ${n}`))
  expect(chat.reads() - before).toBe(10)
  expect(lastAgentPreview()).toBe("the answer 9")
  chat.stop()
})

test("a row arriving is what moves the answer", () => {
  const chat = live(createLastAgent)
  chat.add("a", agent(1, "the first thing"))
  expect(lastAgentPreview()).toBe("the first thing")
  chat.add("b", agent(2, "the second thing"))
  expect(lastAgentPreview()).toBe("the second thing")
  chat.stop()
})

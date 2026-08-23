/**
 * WHAT THE NOTIFICATION'S SECOND LINE REMEMBERS, and what reading it costs.
 *
 * `../last.browsertest.ts`'s claim, one row-kind over, and it has to be asked
 * separately because the answer is not the same: the pill's row is decided by
 * MEMBERSHIP alone, and a question's is not — an ask row settles under a key
 * that never moves, so this snapshot takes the one tracked read `../newest.ts`
 * leaves to a caller, for ask rows and no others. A version that tracked every
 * row would re-walk the transcript per streamed token; one that tracked none
 * would go on naming a question that had been answered.
 *
 * UNDER THE BROWSER CONDITION, for `../../settled.browsertest.ts`'s reason: the
 * server build never re-runs a memo and never runs an effect at all, so a suite
 * about which rows a memo tracks would pass having tracked nothing.
 */

import { expect, test } from "bun:test"

import { askPending, createAsked } from "./asked.ts"
import { agentRow as agent, askRow as ask, live } from "../live.testlib.ts"

test("the snapshot is the waiting question", () => {
  const chat = live(createAsked)
  chat.add("a", agent(1, "let me check"))
  chat.add("b", ask(2, "ask:1", "Which timber for the doors?"))
  expect(askPending()).toEqual({ id: "ask:1", text: "Which timber for the doors?" })
  chat.stop()
})

test("a conversation with nothing waiting has no snapshot", () => {
  const chat = live(createAsked)
  chat.add("a", agent(1, "a ladder"))
  expect(askPending()).toBeUndefined()
  chat.stop()
})

test("the newest waiting question is the one a person is looking at", () => {
  const chat = live(createAsked)
  chat.add("a", ask(1, "ask:1", "Which timber?"))
  chat.add("b", ask(2, "ask:2", "How many doors?"))
  expect(askPending()?.id).toBe("ask:2")
  chat.stop()
})

test("answering the question empties the snapshot", () => {
  // The read that has to be tracked: the key never moves, and the outcome does.
  const chat = live(createAsked)
  chat.add("b", ask(2, "ask:1", "Which timber?"))
  expect(askPending()?.id).toBe("ask:1")
  chat.token("b", ask(2, "ask:1", "Which timber?", true))
  expect(askPending()).toBeUndefined()
  chat.stop()
})

test("answering the newest falls back to the one still waiting under it", () => {
  const chat = live(createAsked)
  chat.add("a", ask(1, "ask:1", "Which timber?"))
  chat.add("b", ask(2, "ask:2", "How many doors?"))
  chat.token("b", ask(2, "ask:2", "How many doors?", true))
  expect(askPending()?.id).toBe("ask:1")
  chat.stop()
})

test("a token on prose costs no read at all", () => {
  // THE DEFECT `../last.ts` was rewritten for, asked here: an answer streaming
  // in must not re-walk the transcript per token to keep a notification warm.
  const chat = live(createAsked)
  for (let n = 0; n < 20; n += 1) chat.add(`p${n}`, agent(n, `line ${n}`))
  chat.add("q", ask(99, "ask:1", "Which timber?"))
  const before = chat.reads()
  for (let n = 0; n < 10; n += 1) chat.token("p3", agent(3, `line 3 revised ${n}`))
  expect(chat.reads()).toBe(before)
  expect(askPending()?.id).toBe("ask:1")
  chat.stop()
})

test("the panel closing empties the snapshot", () => {
  // The fallback is deliberate: a question remembered from the last time the
  // panel was open would be a notification about something else.
  const chat = live(createAsked)
  chat.add("b", ask(2, "ask:1", "Which timber?"))
  expect(askPending()?.id).toBe("ask:1")
  chat.stop()
  expect(askPending()).toBeUndefined()
})

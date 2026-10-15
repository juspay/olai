/**
 * THE STRIP’S OPT-IN, as the three pure questions behind it: which roster row a
 * conversation is, what the switch beside it says, and WHAT THE ITEM SAYS about
 * when this chat last slept and when it will next.
 *
 * What the DRAWING adds is covered where a browser is real — the scenarios press
 * the switch and read `aria-checked` back — and a test that rendered it here
 * would be asserting a first frame under SolidJS's server build and calling it
 * reactivity (`justfile` says so where the browser tests are counted).
 */

import { expect, test } from "bun:test"
import type { Forecast, NodeAgentRow } from "../../wire.ts"

import { nodeAgentOf, saidOf, sleepWords } from "./sleeping.ts"

/** One roster row, as the wire sends it. */
const row = (over: Partial<NodeAgentRow> = {}): NodeAgentRow => ({
  id: "install",
  file: "house.olai",
  title: "install the cabinets",
  engine: "one-engine",
  session: "sess-1",
  memory: 3,
  standing: "asleep",
  waiting: 0,
  said: null,
  seen: null,
  unread: false,
  sleeps: false,
  sleep: null,
  ...over,
})

test("a node agent's conversation finds its row, and a plain chat finds none", () => {
  // THE PAIR IS THE MATCH: a session id means nothing to the wrong engine, so a
  // row whose engine differs is a different agent's conversation.
  expect(nodeAgentOf([row()], { agent: "one-engine", session: "sess-1" })?.id).toBe("install")
  expect(nodeAgentOf([row()], { agent: "another-engine", session: "sess-1" })).toBeUndefined()
  expect(nodeAgentOf([row()], { agent: "one-engine", session: "sess-2" })).toBeUndefined()
  // ...AND A CONVERSATION NOBODY IS SEATED ON IS NOT A NODE AGENT'S AT ALL.
  expect(nodeAgentOf([row()], undefined)).toBeUndefined()
  expect(nodeAgentOf([], { agent: "one-engine", session: "sess-1" })).toBeUndefined()
})

test("the switch says which way the mark is, in the two words a person reads", () => {
  expect(sleepWords(nodeAgentOf([row()], { agent: "one-engine", session: "sess-1" })!.sleeps)).toBe("Off")
  expect(sleepWords(nodeAgentOf([row({ sleeps: true })], { agent: "one-engine", session: "sess-1" })!.sleeps)).toBe("On")
})

/** THE INSTANT THE WORDS ARE READ AT, and the memo an hour under it — so the
 *  phrase a person sees is the brief's own `last 3h ago` rather than a number
 *  nobody can check. */
const NOW = Date.parse("2026-10-12T09:00:00Z")
const HOUR = 3_600_000

/** One forecast, as the roster sends it. */
const forecast = (next: Forecast["next"], over: Partial<Forecast> = {}): Forecast => ({
  lastSlept: new Date(NOW - 3 * HOUR).toISOString(),
  after: 6 * HOUR,
  floor: 5,
  latest: 7 * 24 * HOUR,
  next,
  ...over,
})

/**
 * WHAT THE ITEM SAYS, by state — the whole table, because the words are the
 * point of the item and a state that says nothing useful is the bug this table
 * exists against.
 *
 * THE STATES ARE THE FORECAST’S OWN, so the browser’s words and the server’s
 * judgement cannot drift: `kind` is asserted beside `said`, and `data-next` on
 * the item is that same `kind`.
 */
test("the item says when it last slept, when it will next, and on what rhythm", () => {
  // OFF IN SETTINGS: no forecast at all, because no sleeper was built — and no
  // switch, because the answer is in a file this browser cannot write.
  const off = saidOf(null, NOW)
  expect([off.kind, off.switch, off.said]).toEqual(["off", false, []])
  // ...AND THE TITLE SAYS WHERE, which is the whole of what a person can do about
  // it.
  expect(off.title).toContain("sleep is off in _olai/Settings.olai")

  // NOBODY HAS ASKED: the switch is off, and what it did say is when it last did
  // — the fact a person deciding whether to turn it on wants.
  // ...AND THE SWITCH IS THERE, whatever the mark says: this type is the forecast,
  // and whether the chat asked to be tidied is the row's `sleeps`
  // (`Sleeping.tsx` reads it for `aria-checked`, the word and the press).
  expect(saidOf(forecast({ kind: "unmarked" }), NOW)).toMatchObject({ switch: true, said: ["last 3h ago"] })
  // ...AND NOTHING WHEN IT NEVER HAS, rather than a row of words about nothing.
  expect(saidOf(forecast({ kind: "unmarked" }, { lastSlept: null }), NOW).said).toEqual([])

  // A NODE WITH NO CONVERSATION cannot be slept however due it is.
  expect(saidOf(forecast({ kind: "unbound" }), NOW)).toMatchObject({ switch: true, said: ["no conversation yet"] })

  // THE MEMORY HAS NOT MOVED, AND THE CHAT IS QUIET — the two silences that are
  // not failures.
  expect(saidOf(forecast({ kind: "unchanged" }), NOW).said).toEqual(["last 3h ago", "nothing new to tidy"])
  // TOO LITTLE MOVED — how many rows did, against the floor, because a node that
  // is not being tidied and a node with nothing to tidy read the same otherwise.
  expect(saidOf(forecast({ kind: "little", rows: 2 }), NOW).said).toEqual(["last 3h ago", "too little to tidy · 2 of 5 rows"])
  expect(saidOf(forecast({ kind: "busy" }), NOW).said).toEqual(["last 3h ago", "when this chat is quiet"])

  // THE PASS IS RUNNING ON THIS NODE.
  expect(saidOf(forecast({ kind: "running" }), NOW).said).toEqual(["last 3h ago", "tidying now"])

  // DUE LATER, and the words are a statement about now rather than a rule: the
  // instant is the server’s and the arithmetic is one subtraction.
  expect(saidOf(forecast({ kind: "due", at: new Date(NOW + 4 * HOUR).toISOString(), rows: 6 }), NOW).said)
    .toEqual(["last 3h ago", "next in 4h if left alone"])
  // ...AND DUE NOW, which is a node the pass will take on its next look — “next
  // in 0s” is not a thing that can be true.
  expect(saidOf(forecast({ kind: "due", at: new Date(NOW).toISOString(), rows: 6 }), NOW).said)
    .toEqual(["last 3h ago", "due now"])
  // ...AND NEVER SLEPT, said as such rather than omitted: on a chat that IS
  // tidied, “never” is the answer to “when did it last”.
  expect(saidOf(forecast({ kind: "due", at: new Date(NOW + 4 * HOUR).toISOString(), rows: 6 }, { lastSlept: null }), NOW).said)
    .toEqual(["never", "next in 4h if left alone"])

  // A FAILED PASS, with the backoff’s own end as a clock time — the reader’s
  // hours and minutes, because “not before 14:05” is about the clock in front of
  // them.
  const skipped = saidOf(forecast({ kind: "skipped", until: new Date(NOW + HOUR).toISOString() }), NOW)
  expect(skipped.said[0]).toBe("last pass failed")
  expect(skipped.said[1]).toMatch(/^not before \d{2}:\d{2}$/)

  // THE RHYTHM IS IN THE TITLE, with the file it comes from — the sentence the
  // item is a compression of.
  expect(saidOf(forecast({ kind: "unchanged" }), NOW).title)
    .toBe("olai tidies this chat’s memory after 6 h alone, once 5 rows have moved since the last pass or any moved row has waited 7 d (sleep-after, sleep-floor, sleep-latest in _olai/Settings.olai)")
})

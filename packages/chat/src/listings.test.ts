/**
 * The rules a fan-out over several agents' lists turns on, over values.
 *
 * They are statements about TIME and about ORDER, and both are unreachable
 * through the real thing at anything like a sane cost: checking that an answer
 * goes stale means starting a subprocess, waiting out a clock and starting it
 * again, and checking the merge means arranging for two agents to have
 * conversations with particular timestamps on one machine. What they cost when
 * they are wrong is the bug the fan-out exists to fix, one layer along — a
 * conversation that is there and not in the list.
 */

import type { Listed, SessionInfo } from "@olai/surface"
import { describe, expect, test } from "bun:test"

import { asOneList, KEEP_FOR_MS, Listings } from "./listings.ts"

/** A stored conversation, as an agent's list answers one. */
const said = (
  agent: string,
  id: string,
  updatedAt: string | null,
): SessionInfo => ({ id, agent, title: null, updatedAt })

/** One agent's whole answer: what it had. */
const had = (...sessions: ReadonlyArray<SessionInfo>): Listed => ({
  sessions,
  unreachable: [],
})

/** ... and one that could not be asked at all. */
const couldNotAsk = (agent: string, why: string): Listed => ({
  sessions: [],
  unreachable: [{ agent, why }],
})

/** A clock a test moves by hand — the whole reason the class takes one. */
const clock = () => {
  let at = 1_000
  return { now: () => at, pass: (ms: number) => (at += ms) }
}

describe("what is worth reusing", () => {
  test("an agent never asked has nothing", () => {
    expect(new Listings(clock().now).fresh("claude")).toBeNull()
  })

  test("what it just said, until it goes stale", () => {
    const time = clock()
    const listings = new Listings(time.now)
    const rows = [said("claude", "a", "2026-08-22T10:00:00Z")]
    listings.keep("claude", rows)
    expect(listings.fresh("claude")).toEqual(rows)
    time.pass(KEEP_FOR_MS - 1)
    expect(listings.fresh("claude")).toEqual(rows)
    time.pass(1)
    // The list's whole warrant is that the agent's answer is the only one that
    // is right — a terminal `claude --resume` in this directory changes it.
    expect(listings.fresh("claude")).toBeNull()
  })

  test("AN EMPTY ANSWER IS AN ANSWER", () => {
    // An agent with no stored conversation has answered the question as
    // definitely as one with ten. Read as "nothing kept", every open of the
    // picker would pay a handshake to be told the same nothing.
    const listings = new Listings(clock().now)
    listings.keep("opencode", [])
    expect(listings.fresh("opencode")).toEqual([])
  })

  test("one agent's answer says nothing about another's", () => {
    const listings = new Listings(clock().now)
    listings.keep("claude", [said("claude", "a", null)])
    expect(listings.fresh("opencode")).toBeNull()
  })

  test("and what this panel has just changed is dropped", () => {
    // A cache is only ever wrong in one direction that matters: a list that
    // does not name the conversation you are sitting in reads as a lost one,
    // which is the complaint the fan-out exists to answer.
    const listings = new Listings(clock().now)
    listings.keep("claude", [said("claude", "a", null)])
    listings.forget("claude")
    expect(listings.fresh("claude")).toBeNull()
  })
})

describe("several answers as one", () => {
  test("newest first, whichever agent it is", () => {
    const merged = asOneList([
      had(said("claude", "old", "2026-08-01T00:00:00Z"), said("claude", "new", "2026-08-20T00:00:00Z")),
      had(said("opencode", "newest", "2026-08-22T00:00:00Z")),
    ])
    expect(merged.sessions.map((row) => row.id)).toEqual(["newest", "new", "old"])
  })

  test("an UNDATED row sorts last, never first", () => {
    // An agent that gave no timestamp has said nothing about when. Reading
    // that as "just now" would put it over every conversation that did say.
    const merged = asOneList([
      had(said("claude", "undated", null)),
      had(said("opencode", "dated", "2026-08-01T00:00:00Z")),
    ])
    expect(merged.sessions.map((row) => row.id)).toEqual(["dated", "undated"])
  })

  test("nothing at all is nothing, and one answer is itself", () => {
    expect(asOneList([])).toEqual({ sessions: [], unreachable: [] })
    expect(asOneList([had(), had()])).toEqual({ sessions: [], unreachable: [] })
    const one = said("claude", "a", "2026-08-02T00:00:00Z")
    expect(asOneList([had(one)]).sessions).toEqual([one])
  })

  test("every row keeps the agent it came with", () => {
    // The merge is where the answers stop being several, so it is the one place
    // a row could lose the only thing that says who can open it.
    const merged = asOneList([
      had(said("claude", "a", "2026-08-02T00:00:00Z")),
      had(said("opencode", "b", "2026-08-03T00:00:00Z")),
    ])
    expect(merged.sessions.map((row) => [row.id, row.agent])).toEqual([
      ["b", "opencode"],
      ["a", "claude"],
    ])
  })
})

describe("an agent that could not be asked", () => {
  test("does not take the other one's conversations with it", () => {
    // The shape of the bug the whole fan-out is the fix for, one agent along:
    // a list that vanishes because something else broke.
    const merged = asOneList([
      couldNotAsk("claude", "the conversation store is unreadable"),
      had(said("opencode", "mine", "2026-08-03T00:00:00Z")),
    ])
    expect(merged.sessions.map((row) => row.id)).toEqual(["mine"])
    expect(merged.unreachable).toEqual([
      { agent: "claude", why: "the conversation store is unreadable" },
    ])
  })

  test("and is not silent either — an empty list is not the same answer", () => {
    // `no stored conversations` is a claim about somebody's disk. Standing in
    // for "we never reached them" is the picker's oldest bug.
    expect(asOneList([couldNotAsk("claude", "not running")]).unreachable).toHaveLength(1)
    expect(asOneList([had()]).unreachable).toEqual([])
  })

  test("several of them keep the order they were asked in", () => {
    // There is nothing else to sort refusals by, and a list that reordered
    // itself between two opens would look like different refusals.
    const merged = asOneList([
      couldNotAsk("claude", "first"),
      couldNotAsk("opencode", "second"),
    ])
    expect(merged.unreachable.map((one) => one.agent)).toEqual(["claude", "opencode"])
  })
})

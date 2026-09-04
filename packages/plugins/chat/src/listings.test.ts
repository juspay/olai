/**
 * What every installed agent has stored, over values.
 *
 * Everything asserted here is a statement about COST or about TIME, and both
 * are unreachable through the real thing at anything like a sane price: proving
 * that opening the list does not start three subprocesses means counting
 * subprocesses, and proving an answer goes stale means starting one, waiting
 * out a clock and starting it again. What they cost when they are wrong is the
 * bug this module is the fix for, one layer along — a conversation that is
 * there and not in the list.
 *
 * WHAT IS FAKED is the one thing handed in: how to reach an agent. Which agent
 * is running and how to start one are the caller's ({@link ./chat.ts}), so a
 * test says both in two lines and counts what it was asked for.
 */

import { describe, expect, test } from "bun:test"
import { Effect } from "effect"

import { AgentGone } from "./agent.ts"
import type { Installed } from "./agents/roster.ts"
import { clock } from "./clock.testlib.ts"
import type { Stored } from "./events.ts"
import { KEEP_FOR_MS, type Listings, make, type Where } from "./listings.ts"

/** A roster row. Only the id is ever read here — how to spawn one is the
 *  caller's business, and this module never looks. */
const rowFor = (id: string): Installed =>
  ({ id, name: id, adapter: { command: id, args: [] }, leg: {} } as unknown as Installed)

const ONE = rowFor("one")
const OTHER = rowFor("other")

const stored = (
  id: string,
  updatedAt: string | null,
  said: { readonly messageCount?: number; readonly supersededBy?: string } = {},
): Stored => ({
  id,
  title: null,
  updatedAt,
  messageCount: said.messageCount ?? null,
  supersededBy: said.supersededBy ?? null,
})

/** What each agent answers, and how many times it was actually asked. */
interface Answers {
  readonly [agent: string]: ReadonlyArray<Stored> | AgentGone
}

const asking = (
  where: Partial<Where> & { readonly answers: Answers },
) => {
  const asked: Array<string> = []
  const running: Array<string> = []
  const answer = (row: Installed): Effect.Effect<ReadonlyArray<Stored>, AgentGone> =>
    Effect.suspend(() => {
      asked.push(row.id)
      const said = where.answers[row.id] ?? []
      return said instanceof AgentGone ? Effect.fail(said) : Effect.succeed(said)
    })
  // FROM A BARE NUMBER, because what this file is about is two instants a
  // known distance apart rather than a moment anybody reads back.
  const time = clock(1_000)
  const built: Where = {
    roster: where.roster ?? [ONE, OTHER],
    running: where.running ?? (() => null),
    aside: where.aside ?? ((row) => {
      // The whole round trip, so a test can say whether the process was still
      // up when the next question came. `keep: true` is the ordinary probe —
      // the caller only says otherwise for the agent it turns out to be
      // talking to.
      running.push(row.id)
      return Effect.map(
        Effect.ensuring(answer(row), Effect.sync(() => running.pop())),
        (stored) => ({ stored, keep: true }),
      )
    }),
    now: where.now ?? time.now,
  }
  return { where: built, asked, running, time }
}

const listOf = (listings: Listings) => Effect.runPromise(listings.all)

describe("asking every installed agent", () => {
  test("both of them, and each row says whose it is", async () => {
    const { where } = asking({
      answers: {
        one: [stored("cc", "2026-08-01T00:00:00Z")],
        other: [stored("oc", "2026-08-22T00:00:00Z")],
      },
    })
    const listings = await Effect.runPromise(make(where))
    const listed = await listOf(listings)
    // Newest first, across agents — one history rather than two piles.
    expect(listed.sessions.map((row) => [row.id, row.agent])).toEqual([
      ["oc", "other"],
      ["cc", "one"],
    ])
    expect(listed.unreachable).toEqual([])
  })

  test("what the adapter said ABOUT a conversation rides its row", async () => {
    // The count and the link are the picker's material for the row's second
    // half — the projection must drop neither.
    const { where } = asking({
      answers: {
        one: [
          stored("older", "2026-08-01T00:00:00Z", { messageCount: 47, supersededBy: "newer" }),
          stored("newer", "2026-08-02T00:00:00Z", { messageCount: 3 }),
        ],
      },
    })
    const listed = await listOf(await Effect.runPromise(make(where)))
    expect(listed.sessions.map((row) => [row.id, row.messageCount, row.supersededBy]))
      .toEqual([
        ["newer", 3, null],
        ["older", 47, "newer"],
      ])
  })

  test("an UNDATED row sorts last, never first", async () => {
    // An agent that gave no timestamp has said nothing about when. Reading that
    // as "just now" would put it over every conversation that did say.
    const { where } = asking({
      answers: {
        one: [stored("undated", null)],
        other: [stored("dated", "2026-08-01T00:00:00Z")],
      },
    })
    const listed = await listOf(await Effect.runPromise(make(where)))
    expect(listed.sessions.map((row) => row.id)).toEqual(["dated", "undated"])
  })

  test("the agent ALREADY RUNNING is asked where it is running, never started", async () => {
    // Asking it costs one round trip, and its list is the one most likely to
    // have just changed — this conversation is in it.
    const { where, running } = asking({
      answers: { other: [stored("oc", null)] },
      running: (row) =>
        row.id === "one" ? Effect.succeed([stored("live", null)]) : null,
    })
    const listed = await listOf(await Effect.runPromise(make(where)))
    expect(listed.sessions.map((row) => row.id)).toEqual(["live", "oc"])
    expect(running).toEqual([])
  })
})

describe("what an answer is worth", () => {
  test("an agent that had to be STARTED is not started again for a while", async () => {
    const { where, asked, time } = asking({ answers: { one: [stored("cc", null)] } })
    const listings = await Effect.runPromise(make(where))
    await listOf(listings)
    await listOf(listings)
    expect(asked.filter((id) => id === "one")).toHaveLength(1)
    time.pass(KEEP_FOR_MS)
    await listOf(listings)
    // The list's whole warrant is that the agent's answer is the only one that
    // is right — a terminal session opened in this directory changes it.
    expect(asked.filter((id) => id === "one")).toHaveLength(2)
  })

  test("AN EMPTY ANSWER IS AN ANSWER", async () => {
    // An agent with no stored conversation has answered as definitely as one
    // with ten. Read as "nothing kept", every open of the picker would pay a
    // handshake to be told the same nothing.
    const { where, asked } = asking({ answers: { one: [], other: [] } })
    const listings = await Effect.runPromise(make(where))
    await listOf(listings)
    await listOf(listings)
    expect(asked).toHaveLength(2)
  })

  test("the agent BEING TALKED TO is asked every time", async () => {
    // It is already running, so there is nothing to save — and it is the one
    // whose list this panel is actively changing.
    const { where, asked } = asking({
      answers: {},
      roster: [ONE],
      running: () => Effect.succeed([stored("live", null)]),
    })
    const listings = await Effect.runPromise(make(where))
    await listOf(listings)
    await listOf(listings)
    expect(asked).toEqual([])
  })

  test("and what this panel has just changed is dropped", async () => {
    // A cache is only ever wrong in one direction that matters: a list that
    // does not name the conversation you were just in reads as a lost one,
    // which is the complaint this module exists to answer.
    const { where, asked } = asking({ answers: { one: [stored("cc", null)] } })
    const listings = await Effect.runPromise(make(where))
    await listOf(listings)
    listings.forget("one")
    await listOf(listings)
    expect(asked.filter((id) => id === "one")).toHaveLength(2)
  })

  test("one agent's answer says nothing about another's", async () => {
    const { where, asked } = asking({ answers: { one: [stored("cc", null)] } })
    const listings = await Effect.runPromise(make(where))
    await listOf(listings)
    listings.forget("one")
    await listOf(listings)
    // the other was asked once and kept; only the first was asked twice.
    expect(asked.filter((id) => id === "other")).toHaveLength(1)
  })
})

describe("an answer the caller says not to keep", () => {
  test("is used and NOT remembered", async () => {
    // The one way `running` goes stale: the row became the agent this panel is
    // talking to while the question queued. The caller notices and says so,
    // and caching that answer would be caching the list this panel is busy
    // changing — the very thing the bound agent is never cached for.
    const { where, asked } = asking({
      answers: { one: [stored("cc", null)] },
      roster: [ONE],
      aside: (row) =>
        Effect.map(
          Effect.suspend(() => {
            asked.push(row.id)
            return Effect.succeed([stored("cc", null)])
          }),
          (stored) => ({ stored, keep: false }),
        ),
    })
    const listings = await Effect.runPromise(make(where))
    expect((await listOf(listings)).sessions.map((row) => row.id)).toEqual(["cc"])
    await listOf(listings)
    expect(asked.filter((id) => id === "one")).toHaveLength(2)
  })
})

describe("an agent that could not be asked", () => {
  test("is NAMED, in its own words", async () => {
    // `no stored conversations` is a claim about somebody's disk. Standing in
    // for "we never reached them" is the picker's oldest bug.
    const { where } = asking({
      answers: {
        one: new AgentGone({ gone: "unreachable", why: "the conversation store is unreadable" }),
        other: [stored("oc", null)],
      },
    })
    const listed = await listOf(await Effect.runPromise(make(where)))
    expect(listed.unreachable).toEqual([
      { agent: "one", why: "the conversation store is unreadable" },
    ])
  })

  test("... and does not take the other one's conversations with it", async () => {
    // The shape of the bug this whole module is the fix for, one agent along:
    // a list that vanishes because something else broke.
    const { where } = asking({
      answers: {
        one: new AgentGone({ gone: "unreachable", why: "not running" }),
        other: [stored("mine", null)],
      },
    })
    const listed = await listOf(await Effect.runPromise(make(where)))
    expect(listed.sessions.map((row) => row.id)).toEqual(["mine"])
  })

  test("is asked AGAIN next time, because a refusal is not kept", async () => {
    // An agent held broken for fifteen seconds is one that stays broken on
    // screen after it has been mended.
    const { where, asked } = asking({
      answers: { one: new AgentGone({ gone: "unreachable", why: "not running" }) },
    })
    const listings = await Effect.runPromise(make(where))
    await listOf(listings)
    await listOf(listings)
    expect(asked.filter((id) => id === "one")).toHaveLength(2)
  })

  test("and the one being talked to is named the same way", async () => {
    // The panel's own agent refusing is the case that used to fail the whole
    // call. It is the same sentence about the same subject.
    const { where } = asking({
      answers: {},
      roster: [ONE],
      running: () => Effect.fail(new AgentGone({ gone: "refused", why: "no" })),
    })
    const listed = await listOf(await Effect.runPromise(make(where)))
    expect(listed.unreachable).toEqual([{ agent: "one", why: "no" }])
    expect(listed.sessions).toEqual([])
  })
})

describe("what opening the list costs", () => {
  test("ONE agent started at a time, however many are installed", async () => {
    // Three handshakes racing each other is the cost a person pays for a click,
    // and the reason this holds a permit at all.
    let live = 0
    let most = 0
    const { where } = asking({
      answers: { one: [], other: [] },
      aside: () =>
        Effect.gen(function*() {
          most = Math.max(most, ++live)
          // A beat with the probe UP, so a second start would overlap it.
          yield* Effect.sleep("5 millis")
          live--
          return { stored: [], keep: true }
        }),
    })
    await listOf(await Effect.runPromise(make(where)))
    expect(most).toBe(1)
  })
})

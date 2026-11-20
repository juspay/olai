import { describe, expect, test } from "bun:test"
import { Effect } from "effect"

import { AgentGone } from "@kolu/acp-client"
import type { Installed } from "./agents/roster.ts"
import { clock } from "./clock.testlib.ts"
import type { Stored } from "@kolu/acp-client"
import { KEEP_FOR_MS, type Listings, make, type Where } from "./listings.ts"

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
  const time = clock(1_000)
  const built: Where = {
    roster: where.roster ?? (() => [ONE, OTHER]),
    running: where.running ?? (() => null),
    aside: where.aside ?? ((row) => {
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
    expect(listed.sessions.map((row) => [row.id, row.agent])).toEqual([
      ["oc", "other"],
      ["cc", "one"],
    ])
    expect(listed.unreachable).toEqual([])
  })

  test("what the adapter said ABOUT a conversation rides its row", async () => {
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
        ["older", 47, { agent: "one", session: "newer" }],
      ])
  })

  test("an UNDATED row sorts last, never first", async () => {
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
    expect(asked.filter((id) => id === "one")).toHaveLength(2)
  })

  test("AN EMPTY ANSWER IS AN ANSWER", async () => {
    const { where, asked } = asking({ answers: { one: [], other: [] } })
    const listings = await Effect.runPromise(make(where))
    await listOf(listings)
    await listOf(listings)
    expect(asked).toHaveLength(2)
  })

  test("the agent BEING TALKED TO is asked every time", async () => {
    const { where, asked } = asking({
      answers: {},
      roster: () => [ONE],
      running: () => Effect.succeed([stored("live", null)]),
    })
    const listings = await Effect.runPromise(make(where))
    await listOf(listings)
    await listOf(listings)
    expect(asked).toEqual([])
  })

  test("and what this panel has just changed is dropped", async () => {
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
    expect(asked.filter((id) => id === "other")).toHaveLength(1)
  })
})

describe("an answer the caller says not to keep", () => {
  test("is used and NOT remembered", async () => {
    const { where, asked } = asking({
      answers: { one: [stored("cc", null)] },
      roster: () => [ONE],
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
    const { where, asked } = asking({
      answers: { one: new AgentGone({ gone: "unreachable", why: "not running" }) },
    })
    const listings = await Effect.runPromise(make(where))
    await listOf(listings)
    await listOf(listings)
    expect(asked.filter((id) => id === "one")).toHaveLength(2)
  })

  test("and the one being talked to is named the same way", async () => {
    const { where } = asking({
      answers: {},
      roster: () => [ONE],
      running: () => Effect.fail(new AgentGone({ gone: "refused", why: "no" })),
    })
    const listed = await listOf(await Effect.runPromise(make(where)))
    expect(listed.unreachable).toEqual([{ agent: "one", why: "no" }])
    expect(listed.sessions).toEqual([])
  })
})

describe("what opening the list costs", () => {
  test("ONE agent started at a time, however many are installed", async () => {
    let live = 0
    let most = 0
    const { where } = asking({
      answers: { one: [], other: [] },
      aside: () =>
        Effect.gen(function*() {
          most = Math.max(most, ++live)
          yield* Effect.sleep("5 millis")
          live--
          return { stored: [], keep: true }
        }),
    })
    await listOf(await Effect.runPromise(make(where)))
    expect(most).toBe(1)
  })
})

import { beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"

import { type LocalHarness, localHarness } from "./local.testlib.ts"
import { forLocalState, ROWS } from "./scopes.ts"

const TELLABLE = (): boolean => true

let local: LocalHarness

beforeEach(() => {
  local = localHarness()
})

const forDirectory = (cwd: string) => forLocalState(local.forDirectory(cwd))
const files = (): ReadonlyArray<string> => local.writes(HERE) === 0 ? [] : ["record"]

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)
const outcome = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.result(effect))

const HERE = "/tmp/olai-doorbell-here"
const ELSEWHERE = "/tmp/olai-doorbell-elsewhere"

const IN = { agent: "claude", session: "sess-1" }

describe("a pick, across a restart", () => {
  test("a directory nobody has scoped has no doorbells", async () => {
    expect((await run(forDirectory(HERE))).rows()).toEqual([])
    expect(files()).toEqual([])
  })

  test("what was picked is what comes back", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    expect((await run(forDirectory(HERE))).rows()).toEqual([
      { agent: "claude", session: "sess-1", plugin: "kolu", pick: "Fleet.olai" },
    ])
  })

  test("a second pick for the same doorbell replaces the first", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    await run(scopes.set(IN, "kolu", "Other.olai"))
    expect(scopes.rows()).toEqual([
      { agent: "claude", session: "sess-1", plugin: "kolu", pick: "Other.olai" },
    ])
  })

  test("`null` clears it, and clearing is how a doorbell goes off", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    await run(scopes.set(IN, "kolu", null))
    expect(scopes.rows()).toEqual([])
    expect((await run(forDirectory(HERE))).rows()).toEqual([])
  })

  test("two plugins in one conversation are two picks", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    await run(scopes.set(IN, "odu", "Runs.olai"))
    await run(scopes.set(IN, "kolu", null))
    expect(scopes.rows()).toEqual([
      { agent: "claude", session: "sess-1", plugin: "odu", pick: "Runs.olai" },
    ])
  })

  test("the same session id under another agent is another conversation", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set({ agent: "claude", session: "sess-1" }, "kolu", "A.olai"))
    await run(scopes.set({ agent: "opencode", session: "sess-1" }, "kolu", "B.olai"))
    expect(scopes.rows()).toEqual([
      { agent: "claude", session: "sess-1", plugin: "kolu", pick: "A.olai" },
      { agent: "opencode", session: "sess-1", plugin: "kolu", pick: "B.olai" },
    ])
  })

  test("another directory's picks are not this one's", async () => {
    await run((await run(forDirectory(HERE))).set(IN, "kolu", "Fleet.olai"))
    expect((await run(forDirectory(ELSEWHERE))).rows()).toEqual([])
  })

  test("a trailing slash is the same directory, not a second one", async () => {
    await run((await run(forDirectory(HERE))).set(IN, "kolu", "Fleet.olai"))
    expect((await run(forDirectory(`${HERE}/`))).rows().length).toBe(1)
    expect(files().length).toBe(1)
  })

  test("the section holds the picks and never a message", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    const written = local.read(HERE, "wake") ?? {}
    expect(Object.keys(written)).toEqual(["scopes"])
  })
})

describe("two picks at once", () => {
  test("both land, rather than one racing the other's staging file", async () => {
    const scopes = await run(forDirectory(HERE))
    const both = await Promise.all([
      outcome(scopes.set(IN, "kolu", "Fleet.olai")),
      outcome(scopes.set(IN, "odu", "Runs.olai")),
    ])
    expect(both.map((one) => one._tag)).toEqual(["Success", "Success"])
    expect((await run(forDirectory(HERE))).rows().map((row) => row.plugin).sort())
      .toEqual(["kolu", "odu"])
  })
})

describe("the cap", () => {
  test("the least recently touched pick goes, and only it", async () => {
    const scopes = await run(forDirectory(HERE))
    for (let n = 0; n <= ROWS; n++) {
      await run(scopes.set({ agent: "claude", session: `sess-${n}` }, "kolu", "F.olai"))
    }
    const kept = scopes.rows()
    expect(kept.length).toBe(ROWS)
    expect(kept.some((row) => row.session === "sess-0")).toBe(false)
    expect(kept.some((row) => row.session === `sess-${ROWS}`)).toBe(true)
    expect((await run(forDirectory(HERE))).rows().length).toBe(ROWS)
  })

  test("touching a pick again keeps it, whatever its position", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set({ agent: "claude", session: "old" }, "kolu", "F.olai"))
    for (let n = 0; n < ROWS - 1; n++) {
      await run(scopes.set({ agent: "claude", session: `sess-${n}` }, "kolu", "F.olai"))
    }
    await run(scopes.set({ agent: "claude", session: "old" }, "kolu", "G.olai"))
    await run(scopes.set({ agent: "claude", session: "fresh" }, "kolu", "H.olai"))
    expect(scopes.rows().some((row) => row.session === "old")).toBe(true)
    expect(scopes.rows().some((row) => row.session === "sess-0")).toBe(false)
    expect(scopes.rows().length).toBe(ROWS)
  })
})

describe("a section that cannot be trusted", () => {
  test("a damaged ROW is dropped and the rest still open their doorbells", async () => {
    local.write(HERE, "wake", {
      scopes: [
        { agent: "claude", session: "sess-1", plugin: "kolu" },
        { agent: "claude", session: "sess-2", plugin: "odu", pick: "Runs.olai" },
        7,
      ],
    })
    expect((await run(forDirectory(HERE))).rows()).toEqual([
      { agent: "claude", session: "sess-2", plugin: "odu", pick: "Runs.olai" },
    ])
  })
})

describe("what a write says it removed", () => {
  test("a write answers with the rows it removed, so a caller can take their doorbells back", async () => {
    const scopes = await run(forDirectory(HERE))
    expect(await run(scopes.set(IN, "kolu", "Fleet.olai"))).toEqual([])
    const moved = await run(scopes.set(IN, "kolu", "Other.olai"))
    expect(moved.map((row) => row.pick)).toEqual(["Fleet.olai"])
    const cleared = await run(scopes.set(IN, "kolu", null))
    expect(cleared.map((row) => row.pick)).toEqual(["Other.olai"])
  })

  test("an EVICTED row is reported too, which is the one nobody made a gesture about", async () => {
    const scopes = await run(forDirectory(HERE))
    for (let n = 0; n < ROWS; n++) {
      await run(scopes.set({ agent: "claude", session: `sess-${n}` }, "kolu", `File-${n}.olai`))
    }
    const left = await run(scopes.set({ agent: "claude", session: "sess-new" }, "kolu", "New.olai"))
    expect(left.map((row) => row.session)).toEqual(["sess-0"])
    expect(scopes.rows().some((row) => row.session === "sess-0")).toBe(false)
  })
})

test("picks are opaque JSON, survive restart and revoke on replacement", async () => {
  const scopes = await run(forDirectory(HERE))
  const choice = { enabled: true, nested: ["arbitrary", 3, false] }
  await run(scopes.set(IN, "mail", choice))
  const issued = scopes.recipient(scopes.rows()[0]!)
  expect(issued.pick).toEqual(choice)
  expect(Object.keys(issued).sort()).toEqual(["agent", "current", "pick", "session"])
  expect((await run(forDirectory(HERE))).rows()[0]?.pick).toEqual(choice)
  await run(scopes.set(IN, "mail", true))
  expect(issued.current()).toBe(false)
})

/**
 * WHAT OLAI OVERHEARD A CONVERSATION DO, across a restart.
 *
 * `scopes.test.ts`'s shape one record over, and now for its reasons all the way
 * down: it comes back, it belongs to ONE directory, a file that will not read is
 * an empty mirror rather than a throw, and it is CAPPED with the front of the
 * array evicted — because nobody hand-writes this one. The binding it used to
 * hold beside these two facts is a property in the vault since the human's
 * ruling of 2026-09-02 (`@olai/format`'s `agents.ts`), which is what left this
 * record keyed on the conversation and one shape simpler.
 *
 * It is still read LENIENTLY, field by field: an older olai's file is read by a
 * newer one, and a row that will not parse is a session taught once more rather
 * than a serve that will not start.
 *
 * `XDG_STATE_HOME` is pointed at a temp directory per test, which is also the
 * assertion that the variable is honoured at all.
 */

import { beforeEach, describe, expect, test } from "bun:test"
import { Effect, Result } from "effect"

import { type LocalHarness, localHarness } from "./local.testlib.ts"
import { ROWS } from "./scopes.ts"
import { forLocalState } from "./sessions.ts"

let local: LocalHarness

beforeEach(() => {
  local = localHarness()
})

const forDirectory = (cwd: string) => forLocalState(local.forDirectory(cwd))
const files = (): ReadonlyArray<string> => local.writes(HERE) === 0 ? [] : ["record"]

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)
const outcome = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.result(effect))

const HERE = "/tmp/olai-heard-here"
const ELSEWHERE = "/tmp/olai-heard-elsewhere"

const IN = { agent: "claude", session: "sess-1" }

/** A section already handed through the door, in an older shape. */
const already = (cwd: string, heard: unknown): void => {
  local.write(cwd, "heard", { heard })
}

const written = (cwd: string): Record<string, unknown> => local.read(cwd, "heard") ?? {}

describe("what a record says", () => {
  test("a directory olai has never served has overheard nothing", async () => {
    const heard = await run(forDirectory(HERE))
    expect(heard.rows()).toEqual([])
    expect(heard.at(IN)).toBeUndefined()
    // ... and nothing was written to find that out.
    expect(files()).toEqual([])
  })

  test("the PAIR is the key: a session id means nothing to the wrong agent", async () => {
    already(HERE, [{ agent: "claude", session: "sess-1", taught: true }])
    const heard = await run(forDirectory(HERE))
    expect(heard.at(IN)?.taught).toBe(true)
    expect(heard.at({ agent: "opencode", session: "sess-1" })).toBeUndefined()
  })

  test("a record about ANOTHER directory is not this one's", async () => {
    already(ELSEWHERE, [{ agent: "claude", session: "sess-1", taught: true }])
    expect((await run(forDirectory(ELSEWHERE))).rows()).toHaveLength(1)
    expect((await run(forDirectory(HERE))).rows()).toEqual([])
  })
})

describe("what it does with a file it cannot make sense of", () => {
  test("a row missing a name is dropped, and the rest of the file stands", async () => {
    already(HERE, [
      { session: "sess-0" },
      { agent: "claude", session: "sess-1" },
      { agent: "claude" },
      "not a row at all",
    ])
    expect((await run(forDirectory(HERE))).rows().map((row) => row.session)).toEqual(["sess-1"])
  })

  test("`taught` is only `true`; anything else is a session that has not been told", async () => {
    already(HERE, [{ agent: "claude", session: "sess-1", taught: "yes" }])
    expect((await run(forDirectory(HERE))).at(IN)?.taught).toBeUndefined()
  })

  test("`assigned` is only `true`, the way `taught` is", async () => {
    already(HERE, [{ agent: "claude", session: "sess-1", assigned: "yes" }])
    expect((await run(forDirectory(HERE))).at(IN)?.assigned).toBeUndefined()
  })

  test("a `superseded` that names nothing is a conversation nothing replaced", async () => {
    already(HERE, [{ agent: "claude", session: "sess-1", superseded: "" }])
    expect((await run(forDirectory(HERE))).at(IN)?.superseded).toBeUndefined()
  })

  test("a half-written `said` is a door with no line, not a record refused", async () => {
    already(HERE, [{ agent: "claude", session: "sess-1", said: { text: "hello" } }])
    const row = (await run(forDirectory(HERE))).at(IN)
    expect(row?.session).toBe("sess-1")
    expect(row?.said).toBeUndefined()
  })
})

describe("what olai writes back", () => {
  test("teaching is remembered, and remembered across a restart", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.teach(IN))
    expect(heard.at(IN)?.taught).toBe(true)
    // A SECOND store over the same directory: the point is the disk, since the
    // next boot is a different process and must not teach the session again.
    expect((await run(forDirectory(HERE))).at(IN)?.taught).toBe(true)
  })

  test("a session olai has overheard nothing from is a row this makes", async () => {
    // The shape change the ruling brought: there is no pointer here to find
    // first, so the first thing overheard is what brings a row into being.
    const heard = await run(forDirectory(HERE))
    await run(heard.said(IN, { text: "on it", at: "2026-09-02T09:00:00Z" }))
    expect(heard.rows()).toEqual([{ ...IN, said: { text: "on it", at: "2026-09-02T09:00:00Z" } }])
  })

  test("teaching a session already taught writes nothing at all", async () => {
    already(HERE, [{ agent: "claude", session: "sess-1", taught: true }])
    const heard = await run(forDirectory(HERE))
    await run(heard.teach(IN))
    expect(written(HERE)["heard"]).toEqual([
      { agent: "claude", session: "sess-1", taught: true },
    ])
  })

  test("that a chat was ASSIGNED comes back, which is what teaches it once", async () => {
    // The migration mark: nothing in a transcript says a conversation was
    // moved to a node, so a serve that forgot would teach the ordinary
    // contract and the distillation order would never go out.
    const heard = await run(forDirectory(HERE))
    await run(heard.assign(IN))
    expect((await run(forDirectory(HERE))).at(IN)?.assigned).toBe(true)
  })

  test("assigning a session already assigned writes nothing at all", async () => {
    already(HERE, [{ agent: "claude", session: "sess-1", assigned: true }])
    const heard = await run(forDirectory(HERE))
    await run(heard.assign(IN))
    expect(written(HERE)["heard"]).toEqual([
      { agent: "claude", session: "sess-1", assigned: true },
    ])
  })

  test("what olai replaced a session WITH is written on the session left behind", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.supersede(IN, "sess-2"))
    expect((await run(forDirectory(HERE))).at(IN)?.superseded).toBe("sess-2")
  })

  test("a session replaced twice names the conversation that is bound now", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.supersede(IN, "sess-2"))
    await run(heard.supersede(IN, "sess-3"))
    expect(heard.at(IN)?.superseded).toBe("sess-3")
  })

  test("the marks sit beside each other on one row rather than replacing it", async () => {
    // A chat assigned to a node, taught, and later given a fresh session is one
    // conversation with three things overheard about it.
    const heard = await run(forDirectory(HERE))
    await run(heard.assign(IN))
    await run(heard.teach(IN))
    await run(heard.supersede(IN, "sess-2"))
    expect((await run(forDirectory(HERE))).at(IN)).toEqual({
      ...IN,
      assigned: true,
      taught: true,
      superseded: "sess-2",
    })
  })

  test("the last line an agent said is written down, and comes back", async () => {
    const heard = await run(forDirectory(HERE))
    const said = { text: "the mirror lane is in flight", at: "2026-09-01T16:41:00Z" }
    await run(heard.said(IN, said))
    expect((await run(forDirectory(HERE))).at(IN)?.said).toEqual(said)
  })

  test("the same line twice is one write — an agent repeating itself costs the disk once", async () => {
    const heard = await run(forDirectory(HERE))
    const said = { text: "still working", at: "2026-09-01T16:41:00Z" }
    await run(heard.said(IN, said))
    const after = written(HERE)
    await run(heard.said(IN, said))
    expect(written(HERE)).toEqual(after)
  })

  test("two writes in one process both land — the permit, and the record after", async () => {
    const heard = await run(forDirectory(HERE))
    const other = { agent: "claude", session: "sess-2" }
    const both = await Promise.all([
      outcome(heard.teach(IN)),
      outcome(heard.said(other, { text: "ci is green", at: "2026-09-01T17:00:00Z" })),
    ])
    expect(both.every(Result.isSuccess)).toBe(true)
    const back = (await run(forDirectory(HERE))).rows()
    expect(back.find((row) => row.session === "sess-1")?.taught).toBe(true)
    expect(back.find((row) => row.session === "sess-2")?.said?.text).toBe("ci is green")
  })

  test("the same WORDS with a fresher instant write nothing — a resume must not age them forward", async () => {
    // A replay re-mints the rows it replays, so a resumed conversation offers
    // its old prose with a new instant beside it. Writing on that would move
    // the door's *7m ago* forward over words that are days old.
    const heard = await run(forDirectory(HERE))
    await run(heard.said(IN, { text: "still working", at: "2026-09-01T16:41:00Z" }))
    const after = written(HERE)
    await run(heard.said(IN, { text: "still working", at: "2026-09-02T09:00:00Z" }))
    expect(written(HERE)).toEqual(after)
    expect(heard.at(IN)?.said?.at).toBe("2026-09-01T16:41:00Z")
  })
})

describe("the cap, which this record gained when olai became its only writer", () => {
  test("the oldest touched row leaves, and the newest is kept", async () => {
    const heard = await run(forDirectory(HERE))
    for (let n = 0; n <= ROWS; n++) {
      await run(heard.teach({ agent: "claude", session: `sess-${n}` }))
    }
    const kept = heard.rows()
    expect(kept.length).toBe(ROWS)
    expect(kept.some((row) => row.session === "sess-0")).toBe(false)
    expect(kept.some((row) => row.session === `sess-${ROWS}`)).toBe(true)
    // ... and the disk agrees, which is the half a restart reads.
    expect((await run(forDirectory(HERE))).rows().length).toBe(ROWS)
  })

  test("overhearing a session again walks it to the back of the queue", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.teach(IN))
    for (let n = 0; n < ROWS - 1; n++) {
      await run(heard.teach({ agent: "claude", session: `sess-other-${n}` }))
    }
    // The row that would fall out next, touched — so the row after it goes
    // instead and this one survives one more arrival.
    await run(heard.said(IN, { text: "still here", at: "2026-09-02T09:00:00Z" }))
    await run(heard.teach({ agent: "claude", session: "sess-newest" }))
    expect(heard.at(IN)?.said?.text).toBe("still here")
  })
})

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

const AT = "2026-09-01T16:41:00Z"
const LATER = "2026-09-01T16:44:00Z"

const already = (cwd: string, heard: unknown): void => {
  local.write(cwd, "heard", { heard })
}

const written = (cwd: string): Record<string, unknown> => local.read(cwd, "heard") ?? {}

describe("what a record says", () => {
  test("a directory olai has never served has overheard nothing", async () => {
    const heard = await run(forDirectory(HERE))
    expect(heard.rows()).toEqual([])
    expect(heard.at(IN)).toBeUndefined()
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

  test("a mark this olai no longer keeps is read past rather than refused", async () => {
    already(HERE, [{ agent: "claude", session: "sess-1", assigned: true, taught: true }])
    const row = (await run(forDirectory(HERE))).at(IN)
    expect(row).toEqual({ ...IN, taught: true })
  })

  test("`taken` is only a positive whole number; anything else is a session that has taken nothing", async () => {
    for (const taken of ["3", -1, 0, 1.5, null]) {
      already(HERE, [{ agent: "claude", session: "sess-1", taught: true, taken }])
      const row = (await run(forDirectory(HERE))).at(IN)
      expect(row?.taught).toBe(true)
      expect(row?.taken).toBeUndefined()
    }
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

  test("a `seen` that will not read is a conversation nobody has acknowledged", async () => {
    already(HERE, [{ agent: "claude", session: "sess-1", said: { text: "hello", at: AT }, seen: 1750000000 }])
    const row = (await run(forDirectory(HERE))).at(IN)
    expect(row?.said?.at).toBe(AT)
    expect(row?.seen).toBeUndefined()
  })

  test("an older olai's file has no `seen` at all, and every line in it is unread", async () => {
    already(HERE, [{ agent: "claude", session: "sess-1", said: { text: "still working", at: AT } }])
    expect((await run(forDirectory(HERE))).at(IN)?.seen).toBeUndefined()
  })
})

describe("what olai writes back", () => {
  test("teaching is remembered, and remembered across a restart", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.took(IN, true))
    expect(heard.at(IN)?.taught).toBe(true)
    expect((await run(forDirectory(HERE))).at(IN)?.taught).toBe(true)
  })

  test("the message that teaches is the first one counted, in the one write", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.took(IN, true))
    expect(written(HERE)["heard"]).toEqual([
      { agent: "claude", session: "sess-1", taught: true, taken: 1 },
    ])
  })

  test("the count survives a restart and goes on from where it was — neither reset nor counted twice", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.took(IN, true))
    await run(heard.took(IN, false))
    const back = await run(forDirectory(HERE))
    expect(back.at(IN)?.taken).toBe(2)
    await run(back.took(IN, false))
    expect(back.at(IN)?.taken).toBe(3)
    expect((await run(forDirectory(HERE))).at(IN)).toEqual({ ...IN, taught: true, taken: 3 })
  })

  test("a message counted after the teaching keeps the mark, and one counted without it never makes it", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.took(IN, false))
    expect(heard.at(IN)).toEqual({ ...IN, taken: 1 })
    await run(heard.took(IN, true))
    await run(heard.took(IN, false))
    expect(heard.at(IN)).toEqual({ ...IN, taught: true, taken: 3 })
  })

  test("a row taught before olai counted starts its count from none", async () => {
    already(HERE, [{ agent: "claude", session: "sess-1", taught: true }])
    const heard = await run(forDirectory(HERE))
    await run(heard.took(IN, false))
    expect(written(HERE)["heard"]).toEqual([
      { agent: "claude", session: "sess-1", taught: true, taken: 1 },
    ])
  })

  test("a session olai has overheard nothing from is a row this makes", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.said(IN, { text: "on it", at: "2026-09-02T09:00:00Z" }))
    expect(heard.rows()).toEqual([{ ...IN, said: { text: "on it", at: "2026-09-02T09:00:00Z" } }])
  })

  test("what olai replaced a session WITH is written on the session left behind", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.supersede(IN, { agent: "claude", session: "sess-2" }))
    expect((await run(forDirectory(HERE))).at(IN)?.superseded).toEqual({ agent: "claude", session: "sess-2" })
  })

  test("a session replaced twice names the conversation that is bound now", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.supersede(IN, { agent: "claude", session: "sess-2" }))
    await run(heard.supersede(IN, { agent: "claude", session: "sess-3" }))
    expect(heard.at(IN)?.superseded).toEqual({ agent: "claude", session: "sess-3" })
  })

  test("a fresh start that kept the engine away writes the successor pair down", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.supersede(IN, { agent: "codex", session: "codex-fresh" }))
    expect((await run(forDirectory(HERE))).at(IN)?.superseded).toEqual({ agent: "codex", session: "codex-fresh" })
  })

  test("an older olai's bare-id link is read as this row's own engine", async () => {
    already(HERE, [{ agent: "claude", session: "sess-1", superseded: "sess-2" }])
    expect((await run(forDirectory(HERE))).at(IN)?.superseded).toEqual({ agent: "claude", session: "sess-2" })
  })

  test("the marks sit beside each other on one row rather than replacing it", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.took(IN, true))
    await run(heard.supersede(IN, { agent: "claude", session: "sess-2" }))
    expect((await run(forDirectory(HERE))).at(IN)).toEqual({
      ...IN,
      taught: true,
      taken: 1,
      superseded: { agent: "claude", session: "sess-2" },
    })
  })

  test("what a person has READ is written down beside the line, and comes back", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.said(IN, { text: "on it", at: AT }))
    await run(heard.seen(IN, AT))
    const row = (await run(forDirectory(HERE))).at(IN)
    expect(row?.seen).toBe(AT)
    expect(row?.said?.at).toBe(AT)
    expect(row).toEqual({ ...IN, said: { text: "on it", at: AT }, seen: AT })
  })

  test("acknowledging one line twice writes nothing at all", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.said(IN, { text: "on it", at: AT }))
    await run(heard.seen(IN, AT))
    const after = written(HERE)
    await run(heard.seen(IN, AT))
    expect(written(HERE)).toEqual(after)
  })

  test("a line said AFTER the acknowledgement is unread again, which is the point", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.said(IN, { text: "on it", at: AT }))
    await run(heard.seen(IN, AT))
    await run(heard.said(IN, { text: "and done", at: LATER }))
    expect(heard.at(IN)?.seen).toBe(AT)
    expect(heard.at(IN)?.said?.at).not.toBe(heard.at(IN)?.seen)
  })

  test("an acknowledgement that arrives LATE does not move the mark backwards", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.said(IN, { text: "on it", at: AT }))
    await run(heard.said(IN, { text: "and done", at: LATER }))
    await run(heard.seen(IN, LATER))
    const after = written(HERE)
    await run(heard.seen(IN, AT))
    expect(heard.at(IN)?.seen).toBe(LATER)
    expect(written(HERE)).toEqual(after)
  })

  test("acknowledging a conversation olai has heard nothing from makes the row rather than refusing", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.seen(IN, AT))
    expect(heard.rows()).toEqual([{ ...IN, seen: AT }])
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
      outcome(heard.took(IN, true)),
      outcome(heard.said(other, { text: "ci is green", at: "2026-09-01T17:00:00Z" })),
    ])
    expect(both.every(Result.isSuccess)).toBe(true)
    const back = (await run(forDirectory(HERE))).rows()
    expect(back.find((row) => row.session === "sess-1")?.taught).toBe(true)
    expect(back.find((row) => row.session === "sess-2")?.said?.text).toBe("ci is green")
  })

  test("two counts on one conversation at once are two — the increment is the writer's, under the permit", async () => {
    const heard = await run(forDirectory(HERE))
    await Promise.all([run(heard.took(IN, false)), run(heard.took(IN, false))])
    expect((await run(forDirectory(HERE))).at(IN)?.taken).toBe(2)
  })

  test("the same WORDS with a fresher instant write nothing — a resume must not age them forward", async () => {
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
      await run(heard.took({ agent: "claude", session: `sess-${n}` }, true))
    }
    const kept = heard.rows()
    expect(kept.length).toBe(ROWS)
    expect(kept.some((row) => row.session === "sess-0")).toBe(false)
    expect(kept.some((row) => row.session === `sess-${ROWS}`)).toBe(true)
    expect((await run(forDirectory(HERE))).rows().length).toBe(ROWS)
  })

  test("overhearing a session again walks it to the back of the queue", async () => {
    const heard = await run(forDirectory(HERE))
    await run(heard.took(IN, true))
    for (let n = 0; n < ROWS - 1; n++) {
      await run(heard.took({ agent: "claude", session: `sess-other-${n}` }, true))
    }
    await run(heard.said(IN, { text: "still here", at: "2026-09-02T09:00:00Z" }))
    await run(heard.took({ agent: "claude", session: "sess-newest" }, true))
    expect(heard.at(IN)?.said?.text).toBe("still here")
  })
})

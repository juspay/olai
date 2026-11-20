import type { OutlineSet, Reading } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import { Effect } from "effect"
import { describe, expect, test } from "bun:test"

import { type AgendaGroup, door, KEY, readingIn, WORD } from "./agenda.ts"
import { name } from "./wire.ts"

const SET = (): OutlineSet =>
  setOf({
    "work.olai": [
      `{"id":"permit","ord":"a0","title":"file the permit","todo":true,"date":"2026-08-03"}`,
      `{"id":"posts","ord":"a1","title":"dig the post holes","doing":true,"date":"2026-08-09"}`,
      `{"id":"slab","ord":"a2","title":"pour the slab","todo":true,"date":"2026-09-02"}`,
    ].join("\n"),
    "life.olai": [
      `{"id":"mum","ord":"a0","title":"mum's birthday","date":"2026-08-09"}`,
    ].join("\n"),
  })

const reading = (): Reading => readingOf(SET())

const read = (at: unknown, date: string) => Effect.runSync(door.read({ at, date }))

const refused = (at: unknown, date: string) =>
  Effect.runSync(Effect.result(door.read({ at, date })))

const titles = (groups: ReadonlyArray<AgendaGroup>): ReadonlyArray<string> =>
  groups.flatMap((group) => group.nodes.map((one) => one.title))

describe("journal.agenda", () => {
  test("the key is the plugin's own name composed with the local word", () => {
    expect(KEY).toBe("journal.agenda")
    expect(KEY).toBe(`${name}.${WORD}`)
  })

  test("the day's own rows come back situated, occurrences included", () => {
    const answer = read(reading(), "2026-08-09")
    expect(answer.date).toBe("2026-08-09")
    expect([...titles(answer.dated)].sort()).toEqual(["dig the post holes", "mum's birthday"])
    expect(answer.dated.map((group) => group.file).sort()).toEqual(["life.olai", "work.olai"])
  })

  test("...and what is owed as of that day, on the same reading", () => {
    const answer = read(reading(), "2026-08-09")
    expect(answer.agenda.overdue.map((day) => day.date)).toEqual(["2026-08-03"])
    expect(titles(answer.agenda.overdue.flatMap((day) => day.groups)))
      .toEqual(["file the permit"])
    expect(titles(answer.agenda.today)).toEqual(["dig the post holes"])
    expect(answer.agenda.upcoming.map((day) => day.date)).toEqual(["2026-09-02"])
  })

  test("a row is four fields, and the mark is `null` on an occurrence", () => {
    const [group] = read(reading(), "2026-08-09").dated
      .filter((one) => one.file === "life.olai")
    const [birthday] = group?.nodes ?? []
    expect(birthday).toEqual({
      id: "mum",
      title: "mum's birthday",
      date: "2026-08-09",
      status: null,
    })
    const [work] = read(reading(), "2026-08-09").agenda.today
      .flatMap((one) => one.nodes)
    expect(work?.status).toBe("doing")
  })

  test("the answer is about the reading handed in, not one the journal chose", () => {
    const empty = readingOf(setOf({ "work.olai": "" }))
    expect(titles(read(empty, "2026-08-09").dated)).toEqual([])
    expect(titles(read(reading(), "2026-08-09").dated)).toHaveLength(2)
  })

  test("a date that is not a day is refused in words that quote it", () => {
    const answer = refused(reading(), "2026-08")
    expect(answer._tag).toBe("Failure")
    expect(answer._tag === "Failure" ? answer.failure.reason : "")
      .toContain("`2026-08` is not a day")
  })

  test("a value that is not a reading is refused rather than guessed at", () => {
    for (const wrong of [null, undefined, "a reading", 7, {}, { derived: null }]) {
      const answer = refused(wrong, "2026-08-09")
      expect(answer._tag).toBe("Failure")
      expect(answer._tag === "Failure" ? answer.failure.reason : "")
        .toContain("is not a vault reading")
    }
  })

  test("the narrowing is a claim about `derived`, and says so", () => {
    expect(readingIn(reading())).not.toBeNull()
    expect(readingIn({ derived: {} })).not.toBeNull()
    expect(readingIn({ set: {} })).toBeNull()
  })
})

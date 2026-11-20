import type { Derived, OutlineSet } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import { describe, expect, test } from "bun:test"

import { dated, owed } from "./readings.ts"

const derivedOf = (set: OutlineSet): Derived => readingOf(set).derived

const DAYS = (): OutlineSet =>
  setOf({
    "work.olai": [
      `{"id":"permit","ord":"a0","title":"file the permit","todo":true,"date":"2026-08-03"}`,
      `{"id":"posts","ord":"a1","title":"dig the post holes","doing":true,"date":"2026-08-09"}`,
      `{"id":"survey","ord":"a2","title":"the boundary survey","done":"2026-08-21","date":"2026-08-28"}`,
      `{"id":"filed","ord":"a3","title":"chase the filing","todo":"2026-08-17"}`,
      `{"id":"next","ord":"a4","title":"pour the slab","todo":true,"date":"2026-09-02"}`,
    ].join("\n"),
    "life.olai": [
      `{"id":"visas","ord":"a0","title":"send the visa forms","todo":true,"date":"2026-08-05"}`,
      `{"id":"mum","ord":"a1","title":"mum's birthday","date":"2026-08-09"}`,
    ].join("\n"),
  })

describe("the journal's two derived readings", () => {
  test("the dots are sorted days from only the requested month", () => {
    expect(dated(derivedOf(DAYS()), { month: "2026-08" })).toEqual({
      days: ["2026-08-03", "2026-08-05", "2026-08-09", "2026-08-21", "2026-08-28"],
    })
    expect(dated(derivedOf(DAYS()), { month: "2026-09" })).toEqual({
      days: ["2026-09-02"],
    })
    expect(dated(derivedOf(DAYS()), { month: "2019-11" })).toEqual({ days: [] })
  })

  test("what is owed counts journal work at the reader's day", () => {
    expect(owed(derivedOf(DAYS()), { today: "2026-08-09", cap: 5 }))
      .toMatchObject({ overdue: 2, today: 1 })
    expect(owed(derivedOf(DAYS()), { today: "2026-08-04", cap: 5 }))
      .toMatchObject({ overdue: 1, today: 0 })
    expect(owed(derivedOf(DAYS()), { today: "2026-08-01", cap: 5 }))
      .toMatchObject({ overdue: 0, today: 0 })
    expect(owed(derivedOf(DAYS()), { today: "2026-09-01", cap: 5 }))
      .toMatchObject({ overdue: 3, today: 0 })
  })

  test("the rows ride the same answer: oldest day first, then today's", () => {
    expect(owed(derivedOf(DAYS()), { today: "2026-08-09", cap: 5 }).rows).toEqual([
      { id: "permit", file: "work.olai", title: "file the permit", date: "2026-08-03", status: "todo" },
      { id: "visas", file: "life.olai", title: "send the visa forms", date: "2026-08-05", status: "todo" },
      { id: "posts", file: "work.olai", title: "dig the post holes", date: "2026-08-09", status: "doing" },
    ])
    expect(owed(derivedOf(DAYS()), { today: "2026-08-09", cap: 2 })).toEqual({
      overdue: 2,
      today: 1,
      rows: [
        { id: "permit", file: "work.olai", title: "file the permit", date: "2026-08-03", status: "todo" },
        { id: "visas", file: "life.olai", title: "send the visa forms", date: "2026-08-05", status: "todo" },
      ],
    })
    expect(owed(derivedOf(DAYS()), { today: "2026-08-01", cap: 5 }))
      .toEqual({ overdue: 0, today: 0, rows: [] })
  })
})

import { describe, expect, test } from "bun:test"

import { rangRow } from "./rang.ts"

const RANG = [
  "kolu wake · file-delete-op author waiting — a report is owed · 14:13",
  "",
  "Written by olai's kolu watcher, not by a person.",
  "`54fe62f9` went waiting after 31m working.",
  "Clearing the file on this conversation's wake control stops it.",
].join("\n")

describe("how much of a machine's sentence the row draws", () => {
  test("a row nobody has opened is its essence line, and the account is not on screen", () => {
    const shut = rangRow(RANG, false)
    expect(shut.folds).toBe(true)
    expect(shut.open).toBe(false)
    expect(shut.byline).toBe(
      "kolu wake · file-delete-op author waiting — a report is owed · 14:13",
    )
    expect(shut.body).toContain("`54fe62f9`")
    expect(RANG).toContain(shut.body)
  })

  test("the press reveals the account, and takes nothing off the line above it", () => {
    const open = rangRow(RANG, true)
    expect(open.open).toBe(true)
    expect(open.body).toBe(rangRow(RANG, false).body)
    expect(open.byline).toBe(rangRow(RANG, false).byline)
  })

  test("a body with no essence line is drawn whole, with nothing to press", () => {
    const one = rangRow("the terminal went quiet", false)
    expect(one.folds).toBe(false)
    expect(one.open).toBe(true)
    expect(one.byline).toBe("")
    expect(one.body).toBe("the terminal went quiet")
  })

  test("... and the reader's fold bit cannot hide such a body", () => {
    for (const unfolded of [false, true]) {
      expect(rangRow("the terminal went quiet", unfolded).open).toBe(true)
    }
  })

  test("every shape answers with the words it would draw", () => {
    for (const text of ["", "\n", "one", "one\ntwo", RANG]) {
      for (const unfolded of [false, true]) {
        const row = rangRow(text, unfolded)
        expect(row.body === "" || text.includes(row.body)).toBe(true)
        expect(row.open).toBe(!row.folds || unfolded)
      }
    }
  })
})

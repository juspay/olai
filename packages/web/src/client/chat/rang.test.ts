/**
 * The fold on a machine's row: hidden by default, revealed by the press.
 *
 * Two claims, and they are the whole feature. A doorbell's body is folded to
 * its essence line UNTIL somebody opens it — the row a reader has not touched
 * shows one line and never the account — and a body with NO essence line to
 * fold to is drawn whole, with nothing to press, because this client composes
 * no summary of its own.
 *
 * The words below are a plugin's and are here only to have a shape to split;
 * nothing asserts them. Nothing asserts how the row is DRAWN either — the
 * label's weight, the control's glyph and the ground under it are the panel's,
 * and a test that pinned them would fail on a palette rather than on a defect
 * — tests assert behaviour, not styling.
 */

import { describe, expect, test } from "bun:test"

import { rangRow } from "./rang.ts"

/** A doorbell's body as kolu writes one: the essence line, a blank line, then
 *  the account a reader who presses is asking for — the terminal id, the
 *  derivation, the standing set, the how-to-stop line. */
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
    // The one line a glance absorbs — and it is the plugin's own, not a
    // headline composed here.
    expect(shut.byline).toBe(
      "kolu wake · file-delete-op author waiting — a report is owed · 14:13",
    )
    // The account is carried, so the press has something to reveal, and it is
    // exactly what the agent was handed: nothing was dropped in the folding.
    expect(shut.body).toContain("`54fe62f9`")
    expect(RANG).toContain(shut.body)
  })

  test("the press reveals the account, and takes nothing off the line above it", () => {
    const open = rangRow(RANG, true)
    expect(open.open).toBe(true)
    expect(open.body).toBe(rangRow(RANG, false).body)
    // Who spoke stays true whether or not the row is open: the byline is an
    // attribution, not a stand-in for the words.
    expect(open.byline).toBe(rangRow(RANG, false).byline)
  })

  test("a body with no essence line is drawn whole, with nothing to press", () => {
    // The refusal at the heart of this: where the sentence names no author and
    // offers no summary, the panel invents neither — so there is no fold, and
    // the words are on screen without anybody having to find that out.
    const one = rangRow("the terminal went quiet", false)
    expect(one.folds).toBe(false)
    expect(one.open).toBe(true)
    expect(one.byline).toBe("")
    expect(one.body).toBe("the terminal went quiet")
  })

  test("... and the reader's fold bit cannot hide such a body", () => {
    // A row with no fold has no control, so `unfolded` is never about it — and
    // the answer must not depend on it either, or the same id opened for some
    // other row would blank a paragraph nobody can get back.
    for (const unfolded of [false, true]) {
      expect(rangRow("the terminal went quiet", unfolded).open).toBe(true)
    }
  })

  test("every shape answers with the words it would draw", () => {
    // Total on purpose, like the split under it: the component draws `body`
    // without first asking which case it is in.
    for (const text of ["", "\n", "one", "one\ntwo", RANG]) {
      for (const unfolded of [false, true]) {
        const row = rangRow(text, unfolded)
        expect(row.body === "" || text.includes(row.body)).toBe(true)
        expect(row.open).toBe(!row.folds || unfolded)
      }
    }
  })
})

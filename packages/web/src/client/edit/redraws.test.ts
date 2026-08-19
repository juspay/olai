/**
 * Which writes can move the row they were made in.
 *
 * A list rather than a flag at each call site is what makes this testable at
 * all — and testable is the point: the `!` and `((` widgets do not move the row
 * they are typed in, and nothing in a browser can prove it, because saying they
 * do only opens a race window that the very next frame closes again
 * (`./redraws.ts` has the measurement). What CAN be pinned is the rule.
 *
 * So this is the regression test for that decision: move `date` or `mirror`
 * onto the moving side and it fails here, immediately, with no timing in it.
 */

import { expect, test } from "bun:test"
import type { Edit } from "@olai/surface"

import { redraws } from "./redraws.ts"

/** An edit of that verb, with whatever else the arm needs — nothing here reads
 *  a field, so the rest is filler the type demands. */
const of = (verb: Edit["verb"]): Edit => {
  switch (verb) {
    case "add":
      return { verb, at: { kind: "after", id: "a" }, title: "t" }
    case "move":
      return { verb, id: "a", how: "in" }
    case "toggle":
      return { verb, id: "a", mark: "done" }
    case "mark":
      return { verb, id: "a", mark: "todo" }
    case "date":
      return { verb, id: "a", date: "2026-09-01" }
    case "title":
      return { verb, id: "a", title: "t" }
    case "desc":
      return { verb, id: "a", desc: null }
    case "split":
      return { verb, id: "a", title: "t", rest: "r" }
    case "place":
      return { verb, id: "a", parent: null, after: null }
    case "mirror":
      return { verb, target: "a", at: { kind: "after", id: "b" } }
    case "unarchive":
      return { verb, id: "a" }
    case "doc":
      return { verb, file: "a.md", text: "" }
    case "docNew":
      return { verb, file: "a.md" }
    case "docDay":
      return { verb, date: "2026-09-01" }
    case "emptyTrash":
      return { verb }
    default:
      return { verb, id: "a" } as Edit
  }
}

// THE FINDING THIS PINS. Both widget writes leave the row exactly where it is:
// a day changes what the agenda and the day pages list, and a placement is a
// new row AFTER the one that made it. Neither is owed a redraw, so neither may
// suppress the blur of somebody clicking away mid-write.
test("neither input widget's write moves the row it was typed in", () => {
  expect(redraws(of("date"))).toBe(false)
  expect(redraws(of("mirror"))).toBe(false)
})

// A DUPLICATE is the placement's case exactly: the copy is a new row AFTER the
// one the key was pressed in, and the row itself does not move — so the caret
// stays where it is and nothing suppresses a blur waiting for a frame that
// changes nothing about this line.
test("a duplicate leaves the row it was made in exactly where it was", () => {
  expect(redraws(of("duplicate"))).toBe(false)
})

// ...and neither does plain text, which is why a committed title never took
// the caret back in the first place.
test("text does not move the row either", () => {
  expect(redraws(of("title"))).toBe(false)
  expect(redraws(of("desc"))).toBe(false)
})

// The MARKS do, and that is not an oversight to be tidied away later: with
// done rows hidden, ticking the row you are typing in takes it off the page.
test("a mark can take the row off the page, so it does", () => {
  expect(redraws(of("toggle"))).toBe(true)
  expect(redraws(of("walk"))).toBe(true)
  expect(redraws(of("mark"))).toBe(true)
})

test("everything structural moves it", () => {
  for (const verb of ["move", "place", "split", "merge", "add"] as const) {
    expect(redraws(of(verb))).toBe(true)
  }
})

test("so does a row leaving the page, or coming back to it", () => {
  for (const verb of ["remove", "archive", "unarchive", "unmirror"] as const) {
    expect(redraws(of(verb))).toBe(true)
  }
})

// EMPTYING THE TRASH is the one destructive write, and it still does not move
// a row this editor is in: the records it deletes are archived ones, which no
// outline page draws, and the verb is sent from the Trash's own heading where
// there is no caret at all. Stated rather than left to the default, because a
// verb that removes records is exactly the one a later reader would assume
// belongs on the moving side.
test("emptying the trash moves no row an editor could be standing in", () => {
  expect(redraws(of("emptyTrash"))).toBe(false)
})

// A DOCUMENT is not a row at all, so nothing about it is owed a caret in a
// tree. Stated rather than left to the default, because "not in the list" and
// "asked and answered no" read the same from the call site.
test("a document write is not a row moving", () => {
  for (const verb of ["doc", "docNew", "docDay"] as const) {
    expect(redraws(of(verb))).toBe(false)
  }
})

import { expect, test } from "bun:test"
import type { Edit } from "@olai/surface"

import { redraws, rekeys } from "./redraws.ts"

const moving = (how: "in" | "out" | "up" | "down"): Edit => ({ verb: "move", id: "a", how })

const of = (verb: Edit["verb"]): Edit => {
  switch (verb) {
    case "add":
      return { verb, at: { kind: "after", id: "a" }, title: "t" }
    case "move":
      return moving("in")
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
    case "untrash":
      return { verb, id: "a" }
    case "doc":
      return { verb, file: "a.md", text: "" }
    case "docNew":
      return { verb, file: "a.md" }
    case "emptyTrash":
      return { verb }
    default:
      return { verb, id: "a" } as Edit
  }
}

test("neither input widget's write moves the row it was typed in", () => {
  expect(redraws(of("date"))).toBe(false)
  expect(redraws(of("mirror"))).toBe(false)
})

test("a duplicate leaves the row it was made in exactly where it was", () => {
  expect(redraws(of("duplicate"))).toBe(false)
})

test("text does not move the row either", () => {
  expect(redraws(of("title"))).toBe(false)
  expect(redraws(of("desc"))).toBe(false)
})

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
  for (const verb of ["remove", "trash", "untrash", "unmirror"] as const) {
    expect(redraws(of(verb))).toBe(true)
  }
})

test("emptying the trash moves no row an editor could be standing in", () => {
  expect(redraws(of("emptyTrash"))).toBe(false)
})

test("a document write is not a row moving", () => {
  for (const verb of ["doc", "docNew"] as const) {
    expect(redraws(of(verb))).toBe(false)
  }
})

test("indenting and outdenting give the row a new address; reordering does not", () => {
  expect(rekeys(moving("in"))).toBe(true)
  expect(rekeys(moving("out"))).toBe(true)
  expect(rekeys(moving("up"))).toBe(false)
  expect(rekeys(moving("down"))).toBe(false)
})

test("a landing and its undo name a new parent, so they rekey", () => {
  expect(rekeys(of("place"))).toBe(true)
  expect(rekeys(of("under"))).toBe(true)
})

test("a mark redraws the row without giving it a new address", () => {
  for (const verb of ["toggle", "walk", "mark"] as const) {
    expect(redraws(of(verb))).toBe(true)
    expect(rekeys(of(verb))).toBe(false)
  }
})

test("a split and a merge carry their own caret, so they are not on this list", () => {
  expect(rekeys(of("split"))).toBe(false)
  expect(rekeys(of("merge"))).toBe(false)
})

test("text, a date, a placement and a duplicate leave the address alone", () => {
  for (const verb of ["title", "desc", "date", "mirror", "duplicate"] as const) {
    expect(rekeys(of(verb))).toBe(false)
  }
})

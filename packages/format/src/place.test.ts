/** What a chat row's title stands for, on the server, and which chat wins a
 *  place — the two rules the browser's faces and the server's refusal share. */
import { TEST_CLAIMS } from "@olai/format/testlib"
import { describe, expect, test } from "bun:test"

import { type Place, placeKey, placeWritten, samePlace, standIns } from "./address.ts"

const file = (path: string): Place => ({ kind: "file", path })
const row = (id: string): Place => ({ kind: "row", id })
const page = (href: string): Place => ({ kind: "page", href })

describe("the place a title names", () => {
  const cases: ReadonlyArray<readonly [string, string, Place | null]> = [
    ["a plain title stands for nothing", "Compare the three cabinet quotes", null],
    ["a bare file address", "/notes/plan.md", file("notes/plan.md")],
    ["a named link to a file", "[plan](/notes/plan.md)", file("notes/plan.md")],
    ["a whole outline", "[house](/house.olai)", file("house.olai")],
    ["a heading inside a file is the file", "/notes/plan.md#budget", file("notes/plan.md")],
    ["a row by its bare id", "/#order", row("order")],
    ["the same row, zoomed", "/zoom/#order", row("order")],
    ["the same row, at its file", "/house.olai#order", row("order")],
    ["a picture", "[kitchen](/photos/kitchen.png)", file("photos/kitchen.png")],
    ["a plugin page", "[Swatch](/plugins/swatch)", page("/plugins/swatch")],
    ["a filter is dropped", "/agenda?q=hinges", page("/agenda")],
    ["a file of a kind nobody serves", "/etc/passwd.conf", null],
    ["a sentence around a link", "see [plan](/notes/plan.md) first", null],
    ["a link outside olai", "[olai](https://olai.page)", null],
    ["an escape nothing could have written", "/#%ZZ", null],
  ]
  for (const [said, title, place] of cases) {
    test(said, () => expect(placeWritten(TEST_CLAIMS, title)).toEqual(place))
  }
})

describe("same place", () => {
  test("a row spelled three ways is one place", () => {
    const spelled = ["/#order", "/zoom/#order", "/house.olai#order"].map((title) => placeWritten(TEST_CLAIMS, title)!)
    expect(new Set(spelled.map(placeKey)).size).toBe(1)
  })
  test("a heading and its file are one place", () => {
    expect(samePlace(placeWritten(TEST_CLAIMS, "/notes/plan.md#dates")!, file("notes/plan.md"))).toBe(true)
  })
  test("a file and a row are not", () => {
    expect(samePlace(file("house.olai"), row("house.olai"))).toBe(false)
  })
})

describe("which chat is at a place", () => {
  interface Chat { readonly id: string; readonly title: string }
  const places = (chats: ReadonlyArray<Chat>) => standIns(chats, (chat) => placeWritten(TEST_CLAIMS, chat.title))

  test("a plain chat row is its own row's chat", () => {
    const chats = places([{ id: "c1", title: "Which extractor fan is quiet?" }])
    expect(chats.at(row("c1"))?.id).toBe("c1")
    expect(chats.of({ id: "c1" })).toEqual(row("c1"))
  })
  test("a stand-in is the chat of its place, and still of its own row", () => {
    const plan = { id: "c2", title: "[plan](/notes/plan.md)" }
    const chats = places([plan])
    expect(chats.at(file("notes/plan.md"))).toBe(plan)
    expect(chats.at(row("c2"))).toBe(plan)
    expect(chats.of(plan)).toEqual(file("notes/plan.md"))
    expect(chats.standsIn(plan)).toBe(true)
  })
  test("a row's own chat wins over a stand-in for it", () => {
    const own = { id: "order", title: "order the new cabinets" }
    const standIn = { id: "c3", title: "/#order" }
    const chats = places([standIn, own])
    expect(chats.at(row("order"))).toBe(own)
    expect(chats.standsIn(standIn)).toBe(false)
    expect(chats.of(standIn)).toEqual(row("c3"))
  })
  test("between two stand-ins the first wins and the second is ordinary", () => {
    const first = { id: "c4", title: "[plan](/notes/plan.md)" }
    const second = { id: "c5", title: "/notes/plan.md#budget" }
    const chats = places([first, second])
    expect(chats.at(file("notes/plan.md"))).toBe(first)
    expect(chats.standsIn(second)).toBe(false)
    expect(chats.at(row("c5"))).toBe(second)
  })
  test("a chat titled with its own address stands for nothing else", () => {
    const self = { id: "c6", title: "/#c6" }
    const chats = places([self])
    expect(chats.standsIn(self)).toBe(false)
    expect(chats.at(row("c6"))).toBe(self)
  })
  test("a place nobody stands for has no chat", () => {
    expect(places([]).at(file("notes/plan.md"))).toBeUndefined()
  })
})

/**
 * Which NODES an `@` query means — `./nodes.ts`'s whole rule, over a set spelled
 * out here rather than served.
 *
 * What is asserted is mostly that this door does NOT decide things: the words
 * are the format's grammar, the order is the format's ranking, and the archive
 * is out because the matcher says so. So these are the tests of a caller — that
 * the query reaches the matcher whole, that the answer arrives ranked and
 * capped, and that what a ROW says is built from the node rather than from the
 * query.
 */

import { derive } from "@olai/format"
import { expect, test } from "bun:test"

import { matchNodes } from "./nodes.ts"

/** A directory in two files and an archive beside them: one deep chain, two
 *  nodes of ONE TITLE in two places, a note carrying a word its title does not,
 *  and something finished. */
const SET = derive([
  { file: "house.olai", line: 1, node: { id: "kitchen", ord: "a0", title: "kitchen remodel" } },
  {
    file: "house.olai",
    line: 2,
    node: { id: "install", parent: "kitchen", ord: "a1", title: "install the cabinets" },
  },
  {
    file: "house.olai",
    line: 3,
    node: {
      id: "hinges",
      parent: "install",
      ord: "a0",
      title: "pick the hinges",
      desc: "brass, if the budget survives",
    },
  },
  {
    file: "house.olai",
    line: 4,
    node: {
      id: "chase-order",
      parent: "install",
      ord: "a1",
      title: "chase the supplier",
      done: "2026-08-02",
    },
  },
  {
    file: "garden.olai",
    line: 1,
    node: { id: "garden", ord: "a0", title: "garden" },
  },
  {
    file: "garden.olai",
    line: 2,
    node: { id: "chase-beds", parent: "garden", ord: "a0", title: "chase the supplier" },
  },
  {
    file: "Archive.olai",
    line: 1,
    node: { id: "tiles", ord: "a0", title: "the tiles nobody liked" },
  },
])

const TODAY = "2026-08-13"

const ids = (query: string, limit = 8): ReadonlyArray<string> =>
  matchNodes(SET, query, TODAY, limit).map((node) => node.id)

test("a word finds the nodes that hold it, best first", () => {
  // `install the cabinets` starts with the word (+100) where `pick the hinges`
  // buries it, and both beat the two `chase the supplier` rows, which hold it
  // nowhere.
  expect(ids("install")).toEqual(["install"])
  expect(ids("the")).toEqual(["install", "hinges", "chase-beds", "chase-order"])
})

test("an empty query offers nothing, because a bare `@` is the directory", () => {
  // Not a floor invented here: nothing typed is the grammar's own `nothing`
  // filter, and a filter that asks nothing selects nothing.
  expect(ids("")).toEqual([])
})

test("a query the grammar refuses draws nothing rather than a lesson", () => {
  // Every other door says why. Here the word may be prose on its way to an
  // agent, and a popped-up grammar lesson over `@example.com:8080` would be
  // worse than the silence the box already promises for a word nothing matches.
  expect(ids("is:everywhere")).toEqual([])
  expect(ids(`"open`)).toEqual([])
})

test("the operators that fit in one token work, because the grammar reads it", () => {
  expect(ids("is:done")).toEqual(["chase-order"])
  expect(ids("-is:done supplier")).toEqual(["chase-beds"])
})

test("what was put away is out, and `is:archived` is how it is asked for", () => {
  expect(ids("tiles")).toEqual([])
  expect(ids("is:archived")).toEqual(["tiles"])
})

test("the list is capped, and the cap keeps the best", () => {
  expect(ids("the", 2)).toEqual(["install", "hinges"])
})

test("a row reads the title, and says where it sits", () => {
  // Nearest ancestor first — `../search/place.ts`, the same line the ⌘K palette
  // draws — because a line that must be ellipsized loses its end.
  expect(matchNodes(SET, "hinges", TODAY, 8)).toEqual([
    { id: "hinges", label: "pick the hinges", place: "install the cabinets · kitchen remodel", note: false },
  ])
  // ...and the FILE for a node at the top of one, which has no ancestors to
  // name.
  expect(matchNodes(SET, "remodel", TODAY, 8)[0]?.place).toBe("house.olai")
})

test("two nodes of one title are told apart by where they are", () => {
  expect(matchNodes(SET, "supplier", TODAY, 8).map((node) => node.place))
    .toEqual(["garden", "install the cabinets · kitchen remodel"])
})

test("a row says it is here for a note, and only then", () => {
  // `brass` is in `hinges`'s note and in nothing else — a row whose label holds
  // none of what was typed, which reads as a bug until it says why.
  expect(matchNodes(SET, "brass", TODAY, 8)[0]).toEqual({
    id: "hinges",
    label: "pick the hinges",
    place: "install the cabinets · kitchen remodel",
    note: true,
  })
  // The other three fields are on the row already: the title IS the label, the
  // id is written beside it, and a tag is inside the title.
  expect(matchNodes(SET, "hinges", TODAY, 8)[0]?.note).toBe(false)
})

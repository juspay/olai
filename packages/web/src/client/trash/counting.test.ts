/**
 * The count the emptying confirm names, over a set rather than over a page.
 *
 * Every case here is a value in and a number out, which is the whole reason
 * the count is a function: the sentence it goes into promises that this is
 * what the write deletes, and the two ways a page could disagree with the set
 * are exactly the two this file pins.
 */

import { derive } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { inTrash } from "./counting.ts"

const derivedOf = (files: Record<string, string>) => derive(setOf(files).nodes)

test("it counts the records of every archive, signposts included", () => {
  const derived = derivedOf({
    "house.olai": `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
    "Archive.olai": [
      // The scaffold title `archive` wrote, and the subtree under it.
      `{"id":"sc1","ord":"a0","title":"Kitchen remodel"}`,
      `{"id":"install","parent":"sc1","ord":"a0","title":"install them"}`,
      `{"id":"knobs","parent":"install","ord":"a0","title":"pick the knobs"}`,
    ].join("\n"),
  })
  expect(inTrash(derived, ["Archive.olai"])).toBe(3)
  // The live outline is not one of the files it is asked about, and would not
  // be counted if it were handed one by mistake — it is asked per FILE.
  expect(inTrash(derived, [])).toBe(0)
})

test("several archives add up, and an emptied one contributes nothing", () => {
  const derived = derivedOf({
    "house.olai": `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
    "Archive.olai": "",
    "garden/plot.olai": `{"id":"beds","ord":"a0","title":"the beds"}`,
    "garden/Archive.olai": [
      `{"id":"sc2","ord":"a0","title":"garden"}`,
      `{"id":"slugs","parent":"sc2","ord":"a0","title":"the slugs"}`,
    ].join("\n"),
  })
  expect(inTrash(derived, ["Archive.olai", "garden/Archive.olai"])).toBe(2)
})

test("a MIRROR in an archive counts as the one record it is", () => {
  // The reason this cannot be read off the rows: the page draws the mirror
  // AND the children of the node it shows, which live in a file this write
  // does not touch. Three rows on screen, one record in the pile.
  const derived = derivedOf({
    "garden.olai": [
      `{"id":"herbs","ord":"a0","title":"the herb bed"}`,
      `{"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil"}`,
      `{"id":"mint","parent":"herbs","ord":"a1","title":"split the mint"}`,
    ].join("\n"),
    "Archive.olai": `{"id":"echo","ord":"a0","mirror":"herbs"}`,
  })
  expect(inTrash(derived, ["Archive.olai"])).toBe(1)
})

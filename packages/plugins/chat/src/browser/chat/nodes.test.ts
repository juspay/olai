/**
 * What an `@` ROW says — `./nodes.ts`'s whole remaining rule, over hits spelled
 * out here rather than searched for.
 *
 * WHAT MOVED OUT OF THIS FILE, and why it is not a gap: which nodes a query
 * means used to be decided here, over the set the tab held, and the cases that
 * pinned it were cases of a caller — the words reach the matcher whole, the
 * answer arrives ranked and capped, the archive is out unless it is named. All
 * of that is the SERVER's now (`search-server-side`), so it is asked where it
 * is decided: the grammar and the ranking in `@olai/format`'s `filter.test.ts`,
 * the cap, the scope and the situating in `@olai/ops`' `query.test.ts`, and
 * that the box reaches them at all in `features/chat_at_nodes.feature`, which
 * is a browser's question.
 *
 * What is left here is the ROW, and it is worth its own test for the reason it
 * always was: it is what a person reads to choose, and the one thing it has to
 * explain about itself is a rule (a row owes an explanation only when the
 * reason is not already on it) rather than a rendering.
 */

import { expect, test } from "bun:test"

import type { NodeHit } from "@olai/surface"

import { nodeMatches } from "./nodes.ts"

/** One hit, as the server situates it — `id`, `title`, the `file:line` and the
 *  ancestor titles OUTERMOST FIRST, which is the order `@olai/ops` answers in
 *  and the order `../search/place.ts` reverses. */
const hit = (one: {
  id: string
  title: string
  file?: string
  path?: ReadonlyArray<string>
  matched?: NodeHit["matched"]
}): NodeHit => ({
  at: { kind: "node", id: one.id as never },
  id: one.id,
  title: one.title,
  file: one.file ?? "house.olai",
  line: 1,
  path: one.path ?? [],
  see: undefined,
  after: undefined,
  ...(one.matched === undefined ? {} : { matched: one.matched }),
}) as NodeHit

test("a row reads the title, and says where it sits", () => {
  // Nearest ancestor first — `../search/place.ts`, the same line the ⌘K palette
  // draws — because a line that must be ellipsized loses its end.
  expect(
    nodeMatches([
      hit({
        id: "hinges",
        title: "pick the hinges",
        path: ["kitchen remodel", "install the cabinets"],
        matched: "title",
      }),
    ]),
  ).toEqual([{
    id: "hinges",
    label: "pick the hinges",
    from: "house.olai",
    place: "install the cabinets · kitchen remodel",
    note: false,
  }])
})

test("a node at the top of a file is placed by the file, which is all it has", () => {
  expect(nodeMatches([hit({ id: "kitchen", title: "kitchen remodel" })])[0]?.place)
    .toBe("house.olai")
})

test("two nodes of one title are told apart by where they are", () => {
  expect(
    nodeMatches([
      hit({ id: "chase-beds", title: "chase the supplier", file: "garden.olai", path: ["garden"] }),
      hit({
        id: "chase-order",
        title: "chase the supplier",
        path: ["kitchen remodel", "install the cabinets"],
      }),
    ]).map((node) => node.place),
  ).toEqual(["garden", "install the cabinets · kitchen remodel"])
})

test("a row says it is here for a note, and only then", () => {
  // A row whose label holds none of what was typed reads as a bug until it says
  // the word is in the note underneath.
  expect(nodeMatches([hit({ id: "hinges", title: "pick the hinges", matched: "desc" })])[0]?.note)
    .toBe(true)
  // The other three fields are on the row already — the title IS the label, the
  // id is written beside it, a tag is inside the title — so a word found in one
  // of them owes no explanation.
  for (const field of ["title", "id", "tag"] as const) {
    expect(nodeMatches([hit({ id: "hinges", title: "pick the hinges", matched: field })])[0]?.note)
      .toBe(false)
  }
  // ...and neither does a query that named no words at all (`@is:done`), which
  // is what an absent `matched` MEANS: nothing carried it.
  expect(nodeMatches([hit({ id: "hinges", title: "pick the hinges" })])[0]?.note).toBe(false)
})

test("a node with nothing written in it is labelled by its id", () => {
  // A label has to say something, and the id is the only thing such a node has.
  expect(nodeMatches([hit({ id: "blank", title: "   " })])[0]?.label).toBe("blank")
})

test("no answer is no rows, which is what draws no block", () => {
  expect(nodeMatches([])).toEqual([])
})

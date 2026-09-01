/**
 * WHAT AN AGENT-ASSOCIATED SESSION IS TOLD.
 *
 * The words themselves are asserted rather than merely their shape, because the
 * words ARE the feature: the whole of node agents rests on the agent believing
 * that its subtree is its memory and that the transcript is not, and a line
 * that stopped saying so would break nothing anywhere else in this repo.
 */

import { expect, test } from "bun:test"

import { annotated } from "./prompt.ts"
import { teachingFor } from "./teaching.ts"

const SPACES = {
  id: "spaces",
  title: "Xyne Spaces — the org OS",
  file: "lanes.olai",
  memory: 14,
}

test("it names the node, by title and by the id a read would take", () => {
  const [who] = teachingFor(SPACES)
  expect(who).toContain("Xyne Spaces — the org OS")
  expect(who).toContain("spaces")
  expect(who).toContain("lanes.olai")
})

test("it says the subtree is the memory, and how much of it there is", () => {
  const [, law] = teachingFor(SPACES)
  expect(law).toContain("SUBTREE is your memory")
  expect(law).toContain("14 rows")
})

test("... and that the transcript is history rather than memory", () => {
  const [, law] = teachingFor(SPACES)
  expect(law).toContain("HISTORY")
  expect(law).toContain("write standing facts back into it")
})

test("a node agent with nothing under it yet is told so, not told it has zero", () => {
  const [, law] = teachingFor({ ...SPACES, memory: 0 })
  expect(law).toContain("nothing under it yet")
  expect(law).not.toContain("0 rows")
})

test("one row is `1 row`", () => {
  expect(teachingFor({ ...SPACES, memory: 1 })[1]).toContain("(1 row)")
})

test("it is TWO lines, so the standing law reads the same under every agent", () => {
  const one = teachingFor(SPACES)
  const other = teachingFor({ id: "odu", title: "Odu", file: "ci.olai", memory: 14 })
  expect(one).toHaveLength(2)
  // The first line differs — it is about this node — and the second does not.
  expect(one[0]).not.toBe(other[0])
  expect(one[1]).toBe(other[1] as string)
})

test("under a message it rides the seam every other annotation rides", () => {
  // A blank line between what a person wrote and what olai added, which is
  // `./prompt.ts`'s one rule — so the message stays the message.
  const said = annotated("what is blocking the connector?", teachingFor(SPACES))
  expect(said.startsWith("what is blocking the connector?\n\n[olai] ")).toBe(true)
})

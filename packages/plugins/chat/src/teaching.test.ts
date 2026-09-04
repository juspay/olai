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
  engine: "grok",
  session: "sess-1",
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
  const other = teachingFor({ id: "odu", title: "Odu", file: "ci.olai", engine: "opus", session: null, memory: 14 })
  expect(one).toHaveLength(2)
  // The first line differs — it is about this node — and the second does not.
  expect(one[0]).not.toBe(other[0])
  expect(one[1]).toBe(other[1] as string)
})

// ── the migration variant ─────────────────────────────────────────────

test("an ASSIGNED session is told it was moved here, and what it was before", () => {
  // The one fact the ordinary contract cannot carry: this conversation existed
  // before the node claimed it, so its transcript is the only copy of what it
  // knows.
  const [who] = teachingFor(SPACES, "assigned")
  expect(who).toContain("ASSIGNED")
  expect(who).toContain("Xyne Spaces — the org OS")
  expect(who).toContain("ordinary chat until now")
})

test("... and is ordered to BANK what it knows rather than to write as it learns", () => {
  // The distillation order, which is the whole of why the variant exists: an
  // assigned session is not going to learn its standing facts, it already has
  // them, and they are about to be in the wrong place.
  const [, law] = teachingFor(SPACES, "assigned")
  expect(law).toContain("NOW your memory")
  expect(law).toContain("WRITE INTO IT")
  expect(law).toContain("only copy")
  // The same law underneath, in the same words: the transcript is history.
  expect(law).toContain("HISTORY")
  expect(law).toContain("14 rows")
})

test("it is the same two lines in the same order, however the session arrived", () => {
  // One contract rather than two: a reader comparing an assigned agent's first
  // turn with an opened one's should see the same shape.
  expect(teachingFor(SPACES, "assigned")).toHaveLength(2)
  for (const line of teachingFor(SPACES, "assigned")) expect(line.startsWith("[olai] ")).toBe(true)
})

test("... and both end on the SAME standing law, word for word", () => {
  // The half that must not differ: what the law says is the whole contract, and
  // two spellings of it is two contracts.
  const law = "This transcript is HISTORY, not memory —"
  const [, opened] = teachingFor(SPACES, "opened")
  const [, assigned] = teachingFor(SPACES, "assigned")
  expect((opened as string).slice((opened as string).indexOf(law)))
    .toBe((assigned as string).slice((assigned as string).indexOf(law)))
})

test("an empty subtree is still said rather than counted, on the variant too", () => {
  const [, law] = teachingFor({ ...SPACES, memory: 0 }, "assigned")
  expect(law).toContain("nothing under it yet")
  expect(law).not.toContain("0 rows")
})

test("`opened` is the default, so every existing caller teaches what it taught", () => {
  expect(teachingFor(SPACES, "opened")).toEqual(teachingFor(SPACES))
})

test("under a message it rides the seam every other annotation rides", () => {
  // A blank line between what a person wrote and what olai added, which is
  // `./prompt.ts`'s one rule — so the message stays the message.
  const said = annotated("what is blocking the connector?", teachingFor(SPACES))
  expect(said.startsWith("what is blocking the connector?\n\n[olai] ")).toBe(true)
})

/**
 * What a keystroke turns into.
 *
 * Value in, value out — a snapshot and an intent, and the ops request they add
 * up to. No store, no socket and no browser, which is the whole reason
 * {@link ./edit.ts} is a pure function over a reading: the arithmetic of "the
 * row above this one" is exactly the part a keyboard editor gets wrong, and it
 * is answerable here with a fixture.
 *
 * The assertions are on the REQUEST rather than on the file it would produce.
 * What an `add` or a `move` does to the records is `@olai/ops`' own suite,
 * already written and not worth a second opinion; what is this layer's is
 * which request the key names.
 */

import { derive, type OpFailure, type OutlineSet } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import type { Reading, Request } from "@olai/ops"
import type { Edit } from "@olai/surface"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { requestFor } from "./edit.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","doing":true}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  `{"id":"handles","parent":"install","ord":"a0","title":"pick the handles"}`,
  `{"id":"loose","ord":"a1","title":"a node with no children"}`,
  `{"id":"echo","ord":"a2","mirror":"order"}`,
].join("\n")

const reading = (set: OutlineSet = setOf({ "house.jsonl": HOUSE })): Reading => ({
  set,
  derived: derive(set.nodes),
})

/** The request, or a refusal quoted well enough to fix the test without a
 *  debugger. */
const asked = (edit: Edit, at: Reading = reading()): Request => {
  const outcome = requestFor(at, edit)
  if (Result.isFailure(outcome)) {
    throw new Error(
      `expected \`${edit.verb}\` to resolve, and it refused: ` +
        `${outcome.failure._tag} — ${outcome.failure.message}`,
    )
  }
  return outcome.success
}

const refused = (edit: Edit, at: Reading = reading()): OpFailure => {
  const outcome = requestFor(at, edit)
  if (Result.isSuccess(outcome)) {
    throw new Error(`expected \`${edit.verb}\` to be refused, and it resolved`)
  }
  return outcome.failure
}

// ── a new row ──────────────────────────────────────────────────────────

test("Enter under a parent adds a sibling in that parent", () => {
  expect(asked({ verb: "add", at: { kind: "after", id: "order" }, title: "measure" }))
    .toEqual({ op: "add", parent: "kitchen", after: "order", title: "measure" })
})

test("Enter on a top-level row names the FILE, because there is no parent", () => {
  expect(asked({ verb: "add", at: { kind: "after", id: "kitchen" }, title: "garage" }))
    .toEqual({ op: "add", file: "house.jsonl", after: "kitchen", title: "garage" })
})

test("the first child of a branch goes under it, last among nothing", () => {
  expect(asked({ verb: "add", at: { kind: "under", id: "loose" }, title: "a first" }))
    .toEqual({ op: "add", parent: "loose", title: "a first" })
})

test("the first row of an empty outline is the one place a file is named", () => {
  expect(asked({ verb: "add", at: { kind: "first", file: "new.jsonl" }, title: "one" }))
    .toEqual({ op: "add", file: "new.jsonl", title: "one" })
})

test("a new row after a MIRROR is a sibling of the mirror", () => {
  // Where the reader is looking, rather than beside the node the placement
  // stands for — which is somewhere else, in another parent, possibly in
  // another file. A mirror carries a parent and an `ord` like any record, so
  // there is nothing to resolve through.
  expect(asked({ verb: "add", at: { kind: "after", id: "echo" }, title: "x" }))
    .toEqual({ op: "add", file: "house.jsonl", after: "echo", title: "x" })
})

test("a new row after a node nothing declares is not found", () => {
  expect(refused({ verb: "add", at: { kind: "after", id: "ghost" }, title: "x" })._tag)
    .toBe("NotFoundFailure")
})

// ── the four moves ─────────────────────────────────────────────────────

test("Tab goes under the sibling above, last among its children", () => {
  expect(asked({ verb: "move", id: "install", how: "in" }))
    .toEqual({ op: "move", id: "install", parent: "order" })
})

test("Tab on the first of its siblings has nothing to go under", () => {
  const failure = refused({ verb: "move", id: "demo", how: "in" })
  expect(failure._tag).toBe("UsageFailure")
  expect(failure.message).toContain("no row above it")
})

test("Shift+Tab goes up a level, immediately after the old parent", () => {
  expect(asked({ verb: "move", id: "handles", how: "out" }))
    .toEqual({ op: "move", id: "handles", parent: "kitchen", after: "install" })
})

test("Shift+Tab one level down lands at top level, spelled `null`", () => {
  // `parent: null` is what a move means by "top level" — absent would mean
  // "leave the parent alone", which is a reorder rather than an outdent.
  expect(asked({ verb: "move", id: "demo", how: "out" }))
    .toEqual({ op: "move", id: "demo", parent: null, after: "kitchen" })
})

test("Shift+Tab at the top level is refused", () => {
  expect(refused({ verb: "move", id: "kitchen", how: "out" }).message)
    .toContain("already at the top level")
})

test("Alt+Shift+↑/↓ swaps with the sibling above or below", () => {
  expect(asked({ verb: "move", id: "order", how: "up" }))
    .toEqual({ op: "move", id: "order", before: "demo" })
  expect(asked({ verb: "move", id: "order", how: "down" }))
    .toEqual({ op: "move", id: "order", after: "install" })
})

test("there is nothing to move past at either end of a row", () => {
  expect(refused({ verb: "move", id: "demo", how: "up" })._tag).toBe("UsageFailure")
  expect(refused({ verb: "move", id: "install", how: "down" })._tag).toBe("UsageFailure")
})

test("a MIRROR moves as itself — a placement is a row a reader can reorder", () => {
  // The opposite of a text edit, which the ops layer refuses on a mirror: the
  // mirror has no title of its own, but it does have a place among siblings.
  expect(asked({ verb: "move", id: "echo", how: "up" }))
    .toEqual({ op: "move", id: "echo", before: "loose" })
})

test("moving a row nothing declares is not found", () => {
  expect(refused({ verb: "move", id: "ghost", how: "up" })._tag).toBe("NotFoundFailure")
})

// ── the mark, and the text ─────────────────────────────────────────────

test("toggling reads the stored mark rather than being told it", () => {
  // Unmarked and `doing` both mean "put it on"; only the mark itself undoes.
  expect(asked({ verb: "toggle", id: "install", mark: "done" }))
    .toEqual({ op: "done", id: "install" })
  expect(asked({ verb: "toggle", id: "order", mark: "done" }))
    .toEqual({ op: "done", id: "order" })
  expect(asked({ verb: "toggle", id: "demo", mark: "done" }))
    .toEqual({ op: "done", id: "demo", undo: true })
})

test("a mirror toggles what it shows, exactly as its checkbox draws it", () => {
  // `order` is `doing`, so the mirror is too — and the toggle is therefore a
  // set rather than an undo. The ops layer is what refuses the write itself,
  // naming the node to use instead; this layer must not answer a different
  // question on the way there.
  expect(asked({ verb: "toggle", id: "echo", mark: "done" }))
    .toEqual({ op: "done", id: "echo" })
})

test("a title and a note are what they say", () => {
  expect(asked({ verb: "title", id: "order", title: "order the new cabinets" }))
    .toEqual({ op: "title", id: "order", title: "order the new cabinets" })
  expect(asked({ verb: "desc", id: "order", desc: "oak" }))
    .toEqual({ op: "desc", id: "order", desc: "oak" })
  expect(asked({ verb: "desc", id: "order", desc: null }))
    .toEqual({ op: "desc", id: "order", desc: null })
})

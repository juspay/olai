/**
 * When two answers to a filter are the same answer.
 *
 * The predicate is a memo's `equals` (`./asking.ts`), and what it buys is the
 * second full prune of the page that a re-ask over an unmoved set used to force
 * (docs/brainstorming/reactivity-after-the-flip.md §3.5). So the cases here are
 * about the two ways it could be WRONG rather than about the happy one: a
 * predicate too eager holds a stale answer on screen for ever, and one too shy
 * buys nothing.
 */

import { expect, test } from "bun:test"

import { NodeId } from "@olai/format"

import { type Matches, sameMatches } from "./matches.ts"

const answer = (
  ...rows: ReadonlyArray<readonly [string, "title" | "desc" | undefined]>
): Matches =>
  new Map(rows.map(([id, matched]) => [id, {
    id: NodeId.make(id),
    ...(matched === undefined ? {} : { matched }),
  }]))

test("the same ids matched in the same fields are the same answer", () => {
  expect(sameMatches(answer(["a", "title"], ["b", "desc"]), answer(["a", "title"], ["b", "desc"])))
    .toBe(true)
})

test("the order the server listed them in is not part of the answer", () => {
  // A `Map` keyed by id: what a row looks itself up by is the key, so two
  // answers holding the same pairs say the same thing whichever order they
  // arrived in.
  expect(sameMatches(answer(["a", "title"], ["b", "desc"]), answer(["b", "desc"], ["a", "title"])))
    .toBe(true)
})

test("a row that joined the answer is a new answer", () => {
  expect(sameMatches(answer(["a", "title"]), answer(["a", "title"], ["b", "title"]))).toBe(false)
})

test("a row that left the answer is a new answer", () => {
  expect(sameMatches(answer(["a", "title"], ["b", "title"]), answer(["a", "title"]))).toBe(false)
})

test("the same ids swapped for others of the same count is a new answer", () => {
  // The size check alone would pass this; the walk is what refuses it.
  expect(sameMatches(answer(["a", "title"]), answer(["b", "title"]))).toBe(false)
})

test("a row matched in another field is a new answer", () => {
  // `matched` is what `./why.ts` draws the excerpt from, so a row that now
  // matches in its note rather than its title has something else to say.
  expect(sameMatches(answer(["a", "title"]), answer(["a", "desc"]))).toBe(false)
})

test("a row that gained or lost a field is a new answer", () => {
  expect(sameMatches(answer(["a", undefined]), answer(["a", "title"]))).toBe(false)
  expect(sameMatches(answer(["a", "title"]), answer(["a", undefined]))).toBe(false)
})

test("nothing answered yet is not the empty answer", () => {
  // The distinction `./asking.ts`'s `Asked.matched` is built on: a query that
  // selected nothing empties the page, and a query nobody has answered may not.
  expect(sameMatches(undefined, answer())).toBe(false)
  expect(sameMatches(answer(), undefined)).toBe(false)
  expect(sameMatches(undefined, undefined)).toBe(true)
})

test("two empty answers are the same answer", () => {
  expect(sameMatches(answer(), answer())).toBe(true)
})

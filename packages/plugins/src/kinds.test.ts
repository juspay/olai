/**
 * THE KIND VOCABULARY, ASSEMBLED — the two halves, and the collision that must
 * not be silent.
 *
 * `kindsOf` is where two lists this composition root already holds become the
 * table `@olai/format` judges with, and there are exactly two claims worth
 * pinning: that BUILT and ENABLED stay apart, because a declaration and a value
 * are refused against different ones, and that two plugins claiming one word is
 * a throw rather than a last-writer-wins overwrite.
 */

import { expect, test } from "bun:test"

import { kindsOf, type PropKind } from "./server.ts"

const kind = (word: string): PropKind => ({
  kind: word,
  takes: `\`${word}\` (a word)`,
  admits: () => true,
})

const KOLU = { name: "kolu", kinds: [kind("terminal")] }
const ODU = { name: "odu", kinds: [kind("worktree")] }

test("BUILT is every plugin's word and ENABLED is only this serve's", () => {
  // The distance between the two IS `--plugins`: a vault declaring `terminal`
  // on a serve running only odu has written a legal row — refusing it would
  // make one file broken on one machine and clean on the next, off a flag the
  // file cannot see — while its VALUES are plain text, because `admits` is a
  // promise only a plugin that is here can make.
  const table = kindsOf([KOLU, ODU], [ODU])
  expect([...table.built.keys()]).toEqual(["terminal", "worktree"])
  expect([...table.enabled.keys()]).toEqual(["worktree"])
})

test("a serve with no plugins composes an empty vocabulary rather than a special state", () => {
  const table = kindsOf([KOLU, ODU], [])
  expect([...table.built.keys()]).toEqual(["terminal", "worktree"])
  expect(table.enabled.size).toBe(0)
})

test("a plugin that teaches no word contributes nothing, which is a whole plugin", () => {
  expect(kindsOf([{ name: "quiet" }], [{ name: "quiet" }]).built.size).toBe(0)
})

test("two plugins claiming one word is a throw, naming both", () => {
  // The assembly underneath is a `Map.set`, so a collision resolves silently in
  // favour of whichever was composed last — one plugin's `admits` quietly
  // judging another plugin's values, with nothing red anywhere. The wire has
  // `assertTagSegment` to make sibling keys disjoint by construction; a kind
  // word has nothing of the sort, so it is asserted.
  const clash = { name: "other", kinds: [kind("terminal")] }
  expect(() => kindsOf([KOLU, clash], [])).toThrow(/"kolu" and "other"/)
  expect(() => kindsOf([KOLU, clash], [])).toThrow(/terminal/)
})
